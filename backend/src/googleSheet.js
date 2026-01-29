const { google } = require('googleapis');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Resolve the absolute path to the credentials file
// Use the Render secret path if available, otherwise local fallback
const CREDENTIALS_PATH = process.env.GOOGLE_CREDENTIALS_PATH 
    ? (process.env.GOOGLE_CREDENTIALS_PATH.startsWith('/') ? process.env.GOOGLE_CREDENTIALS_PATH : path.resolve(__dirname, '..', process.env.GOOGLE_CREDENTIALS_PATH))
    : path.resolve(__dirname, '..', 'service-account.json');

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

// 2. Get ALL Data from a Specific Tab (WITH BLANK COLUMN FIX)
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

    // Map headers. If a header is empty, name it "Column_Index"
    const rawHeaders = rows[0];
    const headers = rawHeaders.map((h, i) => {
        const cleanHeader = h ? h.trim() : '';
        return cleanHeader || `Column_${i + 1}`; 
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

// 3. Update a Single Cell (SMART LOOKUP FIX)
const updateSheetCell = async (spreadsheetId, sheetName, rowId, colHeader, value) => {
  try {
    // A. Fetch just the headers (Row 1)
    const headerRow = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!1:1`
    });
    
    if (!headerRow.data.values || headerRow.data.values.length === 0) {
        throw new Error(`Sheet '${sheetName}' appears to be empty.`);
    }

    const headers = headerRow.data.values[0];
    
    // B. Find the Column Index
    // Attempt 1: Exact Match (e.g., "Company" matches "Company")
    let colIndex = headers.indexOf(colHeader);
    
    // Attempt 2: Smart Match (e.g., "col_company" matches "Company")
    // If the DB column is 'col_model', we strip 'col_' and look for 'model' (case-insensitive)
    if (colIndex === -1 && colHeader.startsWith('col_')) {
        const cleanSearch = colHeader.replace(/^col_/, '').toLowerCase(); // "col_model" -> "model"
        
        colIndex = headers.findIndex(h => {
            // sanitize the sheet header to match our logic
            const cleanHeader = h.trim().toLowerCase().replace(/[^a-z0-9]/g, '_'); 
            return cleanHeader === cleanSearch;
        });
    }

    if (colIndex === -1) {
        throw new Error(`Column '${colHeader}' not found in sheet '${sheetName}' headers: [${headers.join(', ')}]`);
    }
    
    // C. Update the Cell
    const colLetter = getColumnLetter(colIndex); // Helper function
    const range = `${sheetName}!${colLetter}${rowId}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      resource: { values: [[value]] }
    });
    
    console.log(`✅ Updated Google Sheet: ${range} = ${value}`);

  } catch (error) {
    console.error("Update Sheet Error:", error.message);
    // We don't throw here to avoid crashing the whole request if just the sheet sync fails
  }
};

// Helper: Convert Index (0, 26) to Letter (A, AA)
function getColumnLetter(colIndex) {
  let letter = '';
  colIndex++; // 1-based
  while (colIndex > 0) {
    let temp = (colIndex - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    colIndex = (colIndex - temp - 1) / 26;
  }
  return letter;
}

module.exports = { getSheetNames, getSheetData, updateSheetCell };