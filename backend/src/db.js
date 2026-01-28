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
  connectTimeout: 60000,
  ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: false }
});

async function initDB() {
  console.log("[DEBUG] initDB() called...");
  let connection;
  try {
    connection = await pool.getConnection();

    // 1. CLEANUP (Ghost Table Check)
    await connection.query("DROP TABLE IF EXISTS sheets_data");

    // 2. SYNC HISTORY TABLE (Now with 'prev_value')
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sync_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sheet_name VARCHAR(255),
        row_id INT NOT NULL,
        prev_value TEXT,  -- [NEW] Stores the 'Loser' data
        new_value TEXT,   -- [NEW] Stores the 'Winner' data
        updated_by VARCHAR(255),
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // [MIGRATION] Add 'prev_value' if missing
    try {
      await connection.query(`
        ALTER TABLE sync_history 
        ADD COLUMN prev_value TEXT AFTER row_id
      `);
      console.log("🔧 Migration: Added 'prev_value' to history.");
    } catch (e) {
      if (e.errno !== 1060) console.error("History Migration Warning:", e.message);
    }

    // [MIGRATION] Add 'sheet_name' if missing (Double check from last sprint)
    try {
      await connection.query(`
        ALTER TABLE sync_history 
        ADD COLUMN sheet_name VARCHAR(255) AFTER id
      `);
    } catch (e) {
      if (e.errno !== 1060) console.error("History Migration Warning:", e.message);
    }
    
    console.log("✅ Database Ready (Sprint 2 Enabled).");

  } catch (error) {
    console.error("❌ DB Init Error:", error);
  } finally {
    if (connection) connection.release();
  }
}

module.exports = { pool, initDB };