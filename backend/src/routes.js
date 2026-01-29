// backend/src/routes.js
const express = require('express');
const router = express.Router();
const { pool } = require('./db');
const { handleSheetUpdate } = require('./sync');
const { updateSheetCell } = require('./googleSheet');
const { getSheetNames, getSheetData } = require('./googleSheet');
const { syncSheetToDB, sanitizeTableName, sanitizeColumnName } = require('./sync');

// 1. GET ALL TABLES (SMART DISCOVERY MODE)
// Safe to poll frequently. Only syncs NEW or MISSING tables.
router.get('/api/tables', async (req, res) => {
  try {
    // A. Get Real Sheet Names from Google
    const googleSheets = await getSheetNames(process.env.SPREADSHEET_ID);
    
    // B. Get Existing DB Tables
    const [dbTables] = await pool.query("SHOW TABLES");
    const existingTables = dbTables.map(row => Object.values(row)[0]);

    // C. SMART SYNC LOOP
    for (const sheet of googleSheets) {
        const tableName = sanitizeTableName(sheet);
        
        // Skip history table
        if (tableName === 'sync_history') continue;

        // CHECK: Only sync if the table DOES NOT exist in MySQL
        if (!existingTables.includes(tableName)) {
            console.log(`🆕 Found New Sheet: ${sheet}. Syncing now...`);

            // 1. Fetch Data
            const data = await getSheetData(process.env.SPREADSHEET_ID, sheet);
            
            // 2. Sync (Create Table & Insert)
            if (data.length > 0) {
                await syncSheetToDB(sheet, data);
                console.log(`✅ Created & Synced table: ${tableName}`);
            } else {
                console.log(`⚠️ Sheet ${sheet} exists but is empty. Waiting for data...`);
            }
        }
        // If table exists, we do nothing. We assume the Webhook handles the updates.
    }

    // D. Return the Clean List
    const tablesList = googleSheets.map(name => ({
        display: name,
        tableName: sanitizeTableName(name)
    }));

    res.json(tablesList);

  } catch (error) {
    console.error("❌ Discovery Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 2. FETCH DATA + ACTIVE USERS (Multi-user-edit Upgrade)
router.get('/api/sheets/:sheetName', async (req, res) => {
  const rawName = req.params.sheetName;
  const tableName = sanitizeTableName(rawName); // e.g. sheet_inventory

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const sortBy = req.query.sortBy || 'row_id';
  const order = req.query.order === 'desc' ? 'DESC' : 'ASC';
  const offset = (page - 1) * limit;

  try {
    const connection = await pool.getConnection();
    
    // A. Check Table Exists
    const [exists] = await connection.query(`SHOW TABLES LIKE ?`, [tableName]);
    if (exists.length === 0) {
      connection.release();
      return res.json({ data: [], meta: { total: 0, activeUsers: [] } });
    }

    // B. Get Total Count
    const [countRows] = await connection.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
    const total = countRows[0].count;

    // C. Get Data Rows
    const [columns] = await connection.query(`SHOW COLUMNS FROM \`${tableName}\``);
    const validColumns = columns.map(c => c.Field);
    const safeSortBy = validColumns.includes(sortBy) ? sortBy : 'row_id';

    const [rows] = await connection.query(`
      SELECT * FROM \`${tableName}\` 
      ORDER BY \`${safeSortBy}\` ${order} 
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    // D. Get Recent Active Users (For Avatars)
    // We look at history for this sheet, get distinct users from last 10 mins
    const [users] = await connection.query(`
      SELECT updated_by 
      FROM sync_history 
      WHERE LOWER(sheet_name) = LOWER(?) 
      GROUP BY updated_by 
      ORDER BY MAX(timestamp) DESC 
      LIMIT 5
    `, [rawName.replace(/_/g, ' ')]); // Try to match "inventory" to "Inventory"

    connection.release();

    res.json({
      data: rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        activeUsers: users.map(u => u.updated_by) // Send list of emails
      }
    });

  } catch (error) {
    console.error("Fetch Error:", error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// 3. GET HISTORY LOG (case insensitive)
router.get('/api/history/:sheetName', async (req, res) => {
  const { sheetName } = req.params;
  try {
    const connection = await pool.getConnection();
    
    // Using LOWER() to match "inventory" with "Inventory"
    const [rows] = await connection.query(
      `SELECT * FROM sync_history WHERE LOWER(sheet_name) = LOWER(?) ORDER BY timestamp DESC LIMIT 50`,
      [sheetName.replace(/_/g, ' ')] 
    );
    connection.release();
    
    const parsedRows = rows.map(r => ({
      ...r,
      prev_value: r.prev_value ? JSON.parse(r.prev_value) : null,
      new_value: r.new_value ? JSON.parse(r.new_value) : null
    }));
    
    res.json(parsedRows);
  } catch (error) {
    console.error("History Error:", error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// 4. WEBHOOK FOR SHEET UPDATES
router.post('/webhook/sheet-update', async (req, res) => {
  try { await handleSheetUpdate(req.body); res.json({ status: 'success' }); } 
  catch (e) { res.status(500).json({ error: 'Sync Failed' }); }
});

// 5. ADMIN UPDATE (Reverse Sync + History)
router.post('/api/admin-update', async (req, res) => {
  const { sheet_name, row_id, col_header, value, user } = req.body;
  const tableName = sanitizeTableName(sheet_name);

  try {
    const connection = await pool.getConnection();

    // A. Fetch Previous Value (For History)
    const [existingRows] = await connection.query(
      `SELECT * FROM \`${tableName}\` WHERE row_id = ?`, [row_id]
    );
    const prevData = existingRows.length > 0 ? existingRows[0] : null;

    // B. Update Database
    const colName = sanitizeColumnName(col_header);
    if (colName) {
       await connection.query(
          `UPDATE \`${tableName}\` SET \`${colName}\` = ? WHERE row_id = ?`, 
          [value, row_id]
       );
    }

    // C. Create "New Value" Object (simulated)
    const newData = { ...prevData, [colName]: value };

    // D. Insert into History Table
    await connection.query(`
      INSERT INTO sync_history (sheet_name, row_id, prev_value, new_value, updated_by, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      sheet_name,
      row_id,
      prevData ? JSON.stringify(prevData) : null,
      JSON.stringify(newData),
      user || 'Admin',
      new Date()
    ]);

    connection.release();

    // 5. Update Google Sheet (Fire and Forget to avoid blocking)
    updateSheetCell(process.env.SPREADSHEET_ID, sheet_name, row_id, col_header, value)
      .catch(err => console.error("Sheet Update BG Error:", err));

    res.json({ status: 'success' });

  } catch (error) {
    console.error("❌ Update Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// 6. EMERGENCY MANUAL SYNC (for testing purposes)
router.get('/api/force-sync/:sheetName', async (req, res) => {
  const { sheetName } = req.params;
  try {
    console.log(`🚨 Manual Force Sync triggered for: ${sheetName}`);
    
    const tableName = sanitizeTableName(sheetName); // Get the SQL table name
    
    // 1. Nuke the existing table
    await pool.query(`DROP TABLE IF EXISTS \`${tableName}\``);
    console.log(`🗑️ Dropped table: ${tableName} (Clean Start)`);

    // 2. Fetch Data
    const data = await getSheetData(process.env.SPREADSHEET_ID, sheetName);
    
    // 3. Sync if data exists
    if (data.length > 0) {
        await syncSheetToDB(sheetName, data);
        res.send(`✅ Success! Dropped & Re-synced table: ${tableName}`);
    } else {
        res.send(`❌ Failed: Sheet '${sheetName}' found, but it is empty.`);
    }
  } catch (error) {
    console.error(error);
    res.send(`❌ Error: ${error.message}`);
  }
});

module.exports = router;