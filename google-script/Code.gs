// [Code.gs] - Final Production Version

// ---------------- CONFIGURATION ----------------
// REPLACE WITH YOUR RENDER URL
var BACKEND_URL = "https://syncraft-backend.onrender.com"; 
// -----------------------------------------------

// 1. The Setup Function (Run this once to authorize)
function setup() {
  var ui = SpreadsheetApp.getUi();
  
  // Clear old triggers to prevent duplicates
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
  
  // Create a new Installable Trigger for "On Edit"
  ScriptApp.newTrigger('syncToBackend')
      .forSpreadsheet(SpreadsheetApp.getActive())
      .onEdit()
      .create();
      
  ui.alert("✅ Syncraft is listening! \nBackend linked to: " + BACKEND_URL);
}

// 2. The Main Sync Logic (Robust Batch Handling)
function syncToBackend(e) {
  if (!e) return;

  var sheet = e.source.getActiveSheet();
  var sheetName = sheet.getName();
  
  // Handle Range (Single or Multi-cell paste)
  var range = e.range;
  var startRow = range.getRow();
  var numRows = range.getNumRows();
  var lastCol = sheet.getLastColumn();

  // Ignore header edits (Row 1)
  if (startRow === 1) return;
  if (lastCol === 0) return;

  // Fetch Headers (The Keys)
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  // Loop through every modified row
  for (var i = 0; i < numRows; i++) {
    var currentRow = startRow + i;
    
    // Fetch the ENTIRE row data (Crucial for "Lazy Load" / New Rows)
    var rowValues = sheet.getRange(currentRow, 1, 1, lastCol).getValues()[0];
    var rowObject = {};
    
    headers.forEach(function(header, index) {
      // Clean header slightly (optional, but good safety)
      var key = header ? header.toString().trim() : "Column_" + (index + 1);
      rowObject[key] = rowValues[index];
    });

    // 3. Prepare Payload (Matches Backend Expectations EXACTLY)
    var payload = {
      sheet_name: sheetName,
      row_id: currentRow, // [FIX] This is what we fixed earlier
      data: rowObject     // Sends full row data: { "ID": 1, "Price": 500 ... }
    };

    // 4. Send Webhook
    var options = {
      'method' : 'post',
      'contentType': 'application/json',
      'payload' : JSON.stringify(payload),
      'muteHttpExceptions': true
    };

    try {
      // Send individual row update
      // (We send per-row to ensure the backend processes row_id correctly for each)
      UrlFetchApp.fetch(BACKEND_URL + "/webhook/sheet-update", options);
      Logger.log("✅ Sent update for Row " + currentRow);
    } catch (error) {
      Logger.log("❌ Error sending webhook: " + error.toString());
    }
  }
}