// backend/src/schema.js
const { pool } = require('./db');

// Converts "Inventory List!" -> "sheet_inventory_list_" - Strictly enforces SQL naming conventions to prevent errors.
function sanitizeTableName(sheetName) {
  if (!sheetName) return 'sheet_unknown';
  // 1. Lowercase, replace non-alphanumeric with underscore
  const safeName = sheetName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  // 2. Prefix with 'sheet_' to avoid SQL keyword conflicts (e.g. 'order')
  return `sheet_${safeName}`;
}

// Ensures a table exists for the specific sheet. Also ensures all columns in 'headers' exist in that table.
async function syncTableSchema(rawSheetName, headers) {
  const connection = await pool.getConnection();
  const tableName = sanitizeTableName(rawSheetName);
  
  try {
    // 1. Create Table if it doesn't exist (Dynamic Table Creation)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`${tableName}\` (
        row_id INT PRIMARY KEY,
        last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // 2. Sync Columns (Add missing columns)
    const [rows] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
    `, [process.env.DB_NAME, tableName]);

    const existingColumns = new Set(rows.map(r => r.COLUMN_NAME.toLowerCase()));
    
    // Filter headers that need to be added
    const missingColumns = headers.filter(h => {
      const colName = sanitizeColumnName(h);
      return colName && !existingColumns.has(colName.toLowerCase());
    });

    for (const header of missingColumns) {
      const colName = sanitizeColumnName(header);
      console.log(`🔧 Schema: Adding column '${colName}' to table '${tableName}'`);
      await connection.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${colName}\` TEXT`);
    }

    return tableName; // Return the actual SQL table name for the Sync logic to use

  } catch (error) {
    console.error(`❌ Schema Sync Error (${tableName}):`, error);
    throw error;
  } finally {
    connection.release();
  }
}

function sanitizeColumnName(name) {
  if (!name) return null;
  // Remove special chars, keep alphanumeric + underscore, max 64 chars
  return name.toString().replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 64);
}

module.exports = { syncTableSchema, sanitizeTableName, sanitizeColumnName };