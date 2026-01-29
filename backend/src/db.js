// backend/src/db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 4000,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0, // Start keep-alive immediately
  connectTimeout: 60000,
  ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: false }
});

async function initDB() {
  console.log("[DEBUG] initDB() called...");
  let connection;
  try {
    connection = await pool.getConnection();

    // CLEANUP (Ghost Table Check)
    await connection.query("DROP TABLE IF EXISTS sheets_data");

    // SYNC HISTORY TABLE
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sync_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sheet_name VARCHAR(255),
        row_id INT NOT NULL,
        prev_value TEXT, 
        new_value TEXT,  
        updated_by VARCHAR(255),
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // [MIGRATION] Add 'prev_value' if missing
    try {
      await connection.query(`ALTER TABLE sync_history ADD COLUMN prev_value TEXT AFTER row_id`);
    } catch (e) {
      if (e.errno !== 1060) console.error("History Migration Warning:", e.message);
    }

    // [MIGRATION] Add 'sheet_name' if missing
    try {
      await connection.query(`ALTER TABLE sync_history ADD COLUMN sheet_name VARCHAR(255) AFTER id`);
    } catch (e) {
      if (e.errno !== 1060) console.error("History Migration Warning:", e.message);
    }
    
    console.log("✅ Database Ready!");

  } catch (error) {
    console.error("❌ DB Init Error:", error);
  } finally {
    if (connection) connection.release();
  }
}

// The Heartbeat Mechanism - This pings the DB every 10 seconds to keep the connection "Hot".
// Prevents 'ECONNRESET' errors from cloud databases.
setInterval(async () => {
    try {
        await pool.query('SELECT 1');
        console.log('💓 DB Heartbeat');
    } catch (e) {
        console.error('⚠️ DB Heartbeat Failed (Reconnecting...):', e.message);
    }
}, 10000);

module.exports = { pool, initDB };