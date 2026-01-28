// backend/src/routes.js
const express = require('express');
const router = express.Router();
const { pool } = require('./db');
const { handleSheetUpdate } = require('./sync');
const { updateSheetCell } = require('./googleSheet');
const { sanitizeColumnName, sanitizeTableName } = require('./schema');

// 1. LIST TABLES (For Sidebar)
router.get('/api/tables', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    // Get all tables that start with 'sheet_'
    const [rows] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE 'sheet_%'
    `, [process.env.DB_NAME]);
    
    connection.release();
    
    // Convert 'sheet_inventory' -> 'Inventory' (Cleaner UI)
    const tables = rows.map(r => ({
      raw: r.TABLE_NAME,
      display: r.TABLE_NAME.replace('sheet_', '').replace(/_/g, ' ')
    }));

    res.json(tables);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to list tables' });
  }
});

// 2. FETCH DATA (Dynamic Table with Pagination & Sorting)
router.get('/api/sheets/:sheetName', async (req, res) => {
  const rawName = req.params.sheetName;
  const tableName = sanitizeTableName(rawName);

  // Sprint 3: Read Query Params
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const sortBy = req.query.sortBy || 'row_id';
  const order = req.query.order === 'desc' ? 'DESC' : 'ASC';
  const offset = (page - 1) * limit;

  try {
    const connection = await pool.getConnection();
    
    // Check if table exists
    const [exists] = await connection.query(`SHOW TABLES LIKE ?`, [tableName]);
    if (exists.length === 0) {
      connection.release();
      return res.json({ data: [], total: 0, page, limit });
    }

    // 1. Get Total Count (for Pagination UI)
    const [countRows] = await connection.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
    const total = countRows[0].count;

    // 2. Validate Sort Column (Prevent SQL Injection)
    // We check if the requested sort column actually exists in the table
    const [columns] = await connection.query(`SHOW COLUMNS FROM \`${tableName}\``);
    const validColumns = columns.map(c => c.Field);
    const safeSortBy = validColumns.includes(sortBy) ? sortBy : 'row_id';

    // 3. Fetch Paginated Data
    const query = `
      SELECT * FROM \`${tableName}\` 
      ORDER BY \`${safeSortBy}\` ${order} 
      LIMIT ? OFFSET ?
    `;
    
    const [rows] = await connection.query(query, [limit, offset]);
    connection.release();

    res.json({
      data: rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("Fetch Error:", error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// 3. WEBHOOK (Sync)
router.post('/webhook/sheet-update', async (req, res) => {
  try {
    await handleSheetUpdate(req.body);
    res.json({ status: 'success' });
  } catch (error) {
    res.status(500).json({ error: 'Sync Failed' });
  }
});

// 4. ADMIN UPDATE (Reverse Sync)
router.post('/api/admin-update', async (req, res) => {
  const { sheet_name, row_id, col_header, value } = req.body;
  const tableName = sanitizeTableName(sheet_name);

  console.log(`📝 Update ${tableName} Row ${row_id}: ${col_header} = ${value}`);

  try {
    // A. Update Google Sheet
    await updateSheetCell(process.env.SPREADSHEET_ID, sheet_name, row_id, col_header, value);

    // B. Update Database
    const connection = await pool.getConnection();
    const colName = sanitizeColumnName(col_header);
    if (colName) {
       await connection.query(
          `UPDATE \`${tableName}\` SET \`${colName}\` = ? WHERE row_id = ?`, 
          [value, row_id]
       );
    }
    connection.release();
    res.json({ status: 'success' });

  } catch (error) {
    console.error("❌ Update Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// [NEW] GET History Log (Sprint 2)
router.get('/api/history/:sheetName', async (req, res) => {
  const { sheetName } = req.params;
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      `SELECT * FROM sync_history WHERE sheet_name = ? ORDER BY timestamp DESC LIMIT 50`,
      [sheetName]
    );
    connection.release();
    
    // Parse the JSON strings back to objects for the frontend
    const parsedRows = rows.map(r => ({
      ...r,
      prev_value: r.prev_value ? JSON.parse(r.prev_value) : null,
      new_value: r.new_value ? JSON.parse(r.new_value) : null
    }));
    
    res.json(parsedRows);
  } catch (error) {
    console.error("History Fetch Error:", error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;