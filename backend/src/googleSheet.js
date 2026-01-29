const { google } = require('googleapis');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Resolve the absolute path to the credentials file
const CREDENTIALS_PATH = path.resolve(__dirname, '..', process.env.GOOGLE_CREDENTIALS_PATH || 'service-account.json');

console.log("🔑 Loading Google Credentials from:", CREDENTIALS_PATH);

const auth = new google.auth.GoogleAuth({
  keyFile: CREDENTIALS_PATH,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

// 1. Get List of All Tab Names
const getSheetNames = async (spreadsheetId) => {
  try {
    const response = await sheets.spreadsheets.get({ spreadsheetId });
    return response.data.sheets.map(s => s.properties.title);
  } catch (error) {
    console.error("❌ Error fetching sheet names:", error.message);
    return [];
  }
};

// 2. Get ALL Data from a Specific Tab (blank columns allowed)
const getSheetData = async (spreadsheetId, sheetName) => {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: sheetName, 
    });

    const rows = response.data.values;
    
    if (!rows || rows.length === 0) return [];

    if (rows.length === 1) {
      console.warn(`⚠️ Sheet '${sheetName}' has headers but NO DATA. Cannot infer SQL types.`);
      return []; 
    }

    // If a header is empty/undefined, name it "Column_Index"
    const rawHeaders = rows[0];
    const headers = rawHeaders.map((h, i) => {
        const cleanHeader = h ? h.trim() : '';
        return cleanHeader || `Column_${i + 1}`; // e.g., "Column_3"
    });

    const data = rows.slice(1).map((row, rowIndex) => {
      let obj = {};
      obj['row_id'] = rowIndex + 2; 
      headers.forEach((header, colIndex) => {
        obj[header] = row[colIndex] || ""; 
      });
      return obj;
    });

    return data;
  } catch (error) {
    console.error(`❌ Error getting data for ${sheetName}:`, error.message);
    return [];
  }
};

// 3. Update a Single Cell
const updateSheetCell = async (spreadsheetId, sheetName, rowId, colHeader, value) => {
  try {
    const headerRow = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!1:1`
    });
    const headers = headerRow.data.values[0];
    const colIndex = headers.indexOf(colHeader);
    
    // If we can't find by name, try finding by "Column_X" logic
    if (colIndex === -1) throw new Error(`Column ${colHeader} not found`);
    
    const colLetter = String.fromCharCode(65 + colIndex); 
    const range = `${sheetName}!${colLetter}${rowId}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      resource: { values: [[value]] }
    });
  } catch (error) {
    console.error("Update Sheet Error:", error.message);
  }
};

module.exports = { getSheetNames, getSheetData, updateSheetCell };