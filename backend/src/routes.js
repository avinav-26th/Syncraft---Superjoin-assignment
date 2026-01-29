// backend/src/routes.js
const express = require('express');
const router = express.Router();
const { pool } = require('./db');
const { handleSheetUpdate } = require('./sync');
const { updateSheetCell } = require('./googleSheet');
const { sanitizeColumnName, sanitizeTableName } = require('./schema');

// 1. LIST TABLES
router.get('/api/tables', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE 'sheet_%'
    `, [process.env.DB_NAME]);
    connection.release();
    
    const tables = rows.map(r => ({
      raw: r.TABLE_NAME,
      display: r.TABLE_NAME.replace('sheet_', '').replace(/_/g, ' ')
    }));
    res.json(tables);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list tables' });
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

module.exports = router;