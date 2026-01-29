// backend/src/sync.js
const { pool } = require('./db');
const { syncTableSchema, sanitizeColumnName, sanitizeTableName } = require('./schema');

async function handleSheetUpdate(payload) {
  const { sheet_name, user, changes } = payload;
  
  if (!changes || changes.length === 0) return;
  if (!sheet_name) return;

  console.log(`📦 Batch Sync: Processing ${changes.length} rows for sheet '${sheet_name}'`);

  let allHeaders = new Set();
  changes.forEach(row => Object.keys(row.data).forEach(k => allHeaders.add(k)));
  const tableName = await syncTableSchema(sheet_name, Array.from(allHeaders));

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const change of changes) {
      const { row_id, data } = change;
      
      // Fetch the "Loser" (Existing Data) first
      const [existingRows] = await connection.query(
        `SELECT * FROM \`${tableName}\` WHERE row_id = ?`,
        [row_id]
      );
      const prevData = existingRows.length > 0 ? existingRows[0] : null;

      const columns = [];
      const values = [row_id]; 
      const updates = [];     

      for (const [key, value] of Object.entries(data)) {
        const colName = sanitizeColumnName(key);
        if (colName) {
          columns.push(`\`${colName}\``);
          values.push(value);
          updates.push(`\`${colName}\` = VALUES(\`${colName}\`)`);
        }
      }

      if (columns.length === 0) continue;

      const placeholders = values.slice(1).map(() => '?').join(', ');
      
      const query = `
        INSERT INTO \`${tableName}\` (row_id, ${columns.join(', ')}) 
        VALUES (?, ${placeholders}) 
        ON DUPLICATE KEY UPDATE ${updates.join(', ')}
      `;

      await connection.query(query, values);

      // Log Both Values - If prevData is null, it means it was a pure INSERT (New Row)
      await connection.query(`
        INSERT INTO sync_history (sheet_name, row_id, prev_value, new_value, updated_by, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        sheet_name, 
        row_id, 
        prevData ? JSON.stringify(prevData) : null, // The Discarded Data
        JSON.stringify(data),     // The New Data
        user, 
        new Date()
      ]);
    }

    await connection.commit();
    console.log(`✅ Synced to table '${tableName}' with History`);

  } catch (error) {
    await connection.rollback();
    console.error(`❌ Sync Error (${tableName}):`, error);
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { handleSheetUpdate };