// backend/src/googleSheet.js
const { google } = require('googleapis');
const path = require('path');
const { sanitizeColumnName } = require('./schema'); // [NEW] Import sanitizer

const KEY_PATH = path.join(__dirname, '..', 'service-account.json');

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_PATH,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function updateSheetCell(spreadsheetId, sheetName, row, colHeader, value) {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    // 1. Fetch ALL Headers from the Sheet
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!1:1`,
    });

    if (!headerRes.data.values || headerRes.data.values.length === 0) {
      throw new Error(`Sheet '${sheetName}' is empty or not found.`);
    }

    const realHeaders = headerRes.data.values[0]; // e.g. ["Name", "Profit %", "Top Sub"]
    
    // 2. [FIX] Smart Match Logic
    // We loop through real headers, sanitize them, and see if they match the DB column name
    let colIndex = -1;

    for (let i = 0; i < realHeaders.length; i++) {
      const realHeader = realHeaders[i];
      // We sanitize the real header to see if it becomes the ID we are looking for
      // e.g. "Profit %" -> "profit__" === "profit__" (Match!)
      if (sanitizeColumnName(realHeader) === colHeader) {
        colIndex = i;
        break;
      }
    }

    // Fallback: exact match check (just in case)
    if (colIndex === -1) {
      colIndex = realHeaders.indexOf(colHeader);
    }

    if (colIndex === -1) {
        throw new Error(`Column '${colHeader}' not found in '${sheetName}' (could not map back to original).`);
    }

    const colLetter = String.fromCharCode(65 + colIndex);
    
    // 3. Construct Range & Write
    const range = `${sheetName}!${colLetter}${row}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      resource: {
        values: [[value]],
      },
    });

    console.log(`✅ Google Sheet Updated: ${range} (${realHeaders[colIndex]}) = ${value}`);
    return true;

  } catch (error) {
    console.error("❌ Google Sheet Write Error:", error);
    throw error;
  }
}

module.exports = { updateSheetCell };