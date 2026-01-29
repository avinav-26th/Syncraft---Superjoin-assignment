// backend/src/sync.js
const { pool } = require('./db'); 
const { getSheetData } = require('./googleSheet'); 

// 1. Helper Functions

const sanitizeTableName = (name) => {
  if (!name) return '';
  let clean = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `sheet_${clean}`;
};

const sanitizeColumnName = (header) => {
  if (!header) return '';
  let clean = header.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `col_${clean}`;
};

// 2. Core Sync Logic (Sheet -> DB)

const syncSheetToDB = async (sheetName, data) => {
  const tableName = sanitizeTableName(sheetName);
  
  if (!data || data.length === 0) {
      console.log(`⚠️ Skipping sync for empty sheet: ${sheetName}`);
      return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // A. Infer Schema from the first row of data
    const firstRow = data[0];
    const columns = Object.keys(firstRow).filter(k => k !== 'row_id'); 
    
    // B. Create Table SQL
    let createTableSQL = `CREATE TABLE IF NOT EXISTS \`${tableName}\` (
      \`row_id\` INT PRIMARY KEY,
      \`last_updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      ${columns.map(col => `\`${sanitizeColumnName(col)}\` TEXT`).join(', ')}
    )`;

    await connection.query(createTableSQL);

    // C. Add Missing Columns (Dynamic Schema)
    const [existingCols] = await connection.query(`SHOW COLUMNS FROM \`${tableName}\``);
    const existingColNames = existingCols.map(c => c.Field);

    for (const col of columns) {
        const safeCol = sanitizeColumnName(col);
        if (!existingColNames.includes(safeCol)) {
            console.log(`⚠️ Adding new column: ${safeCol}`);
            await connection.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${safeCol}\` TEXT`);
        }
    }

    // D. Upsert Data
    const safeColumns = ['row_id', ...columns.map(sanitizeColumnName)];
    const placeholders = data.map(() => `(${safeColumns.map(() => '?').join(', ')})`).join(', ');
    
    const values = [];
    data.forEach(row => {
        values.push(row.row_id); 
        columns.forEach(col => values.push(row[col])); 
    });

    const updateClause = columns.map(col => {
        const safeCol = sanitizeColumnName(col);
        return `\`${safeCol}\` = VALUES(\`${safeCol}\`)`;
    }).join(', ');

    const upsertSQL = `
      INSERT INTO \`${tableName}\` (${safeColumns.map(c => `\`${c}\``).join(', ')})
      VALUES ${placeholders}
      ON DUPLICATE KEY UPDATE ${updateClause}
    `;

    await connection.query(upsertSQL, values);

    await connection.commit();
    console.log(`✅ Successfully synced table: ${tableName}`);

  } catch (error) {
    await connection.rollback();
    console.error(`❌ Sync Error for ${tableName}:`, error.message);
    throw error;
  } finally {
    connection.release();
  }
};


// 3. Webhook Handler (Self Healing Logic)
const handleSheetUpdate = async (payload) => {
  const { sheet_name, row_id, data } = payload;
  const tableName = sanitizeTableName(sheet_name);
  
  const connection = await pool.getConnection();
  let shouldFetchFull = false;

  try {
      // CHECK 1: Does table exist?
      const [tables] = await connection.query(`SHOW TABLES LIKE ?`, [tableName]);
      
      if (tables.length === 0) {
          shouldFetchFull = true; // Table missing -> Full Import
      } else {
          // CHECK 2: Is it a "Ghost Table" (only has 1 row or less)?
          const [countResult] = await connection.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
          if (countResult[0].count <= 1) {
              shouldFetchFull = true; // Table exists but is empty -> Full Import (Heal it)
          }
      }
  } catch (err) {
      console.error("Check Table Error:", err);
  } finally {
      connection.release();
  }

  if (shouldFetchFull) {
      console.log(`🆕 New or Empty table detected for ${sheet_name}. Triggering Full Import...`);
      
      // Fetch everything from Google
      const allData = await getSheetData(process.env.SPREADSHEET_ID, sheet_name);
      
      if (allData.length > 0) {
          await syncSheetToDB(sheet_name, allData);
      } else {
          // If google returns nothing, at least save the webhook row
          console.log("⚠️ Full fetch empty, falling back to single row.");
          const rowData = { ...data, row_id };
          await syncSheetToDB(sheet_name, [rowData]);
      }
  } else {
      // [Normal Mode] Table is healthy (lots of rows). Just update the one row.
      console.log(`⚡ Syncing single update for ${sheet_name} Row ${row_id}`);
      const rowData = { ...data, row_id };
      await syncSheetToDB(sheet_name, [rowData]);
  }
};

module.exports = {
  syncSheetToDB,
  handleSheetUpdate,
  sanitizeTableName,
  sanitizeColumnName
};