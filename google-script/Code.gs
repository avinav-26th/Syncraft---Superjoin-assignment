// Phase 3: Google Apps Script Logic (Sprint 1: Robust Version)

// ---------------- CONFIGURATION ----------------
// REPLACE THIS with your actual Ngrok URL (No trailing slash)
var BACKEND_URL = "https://YOUR-NGROK-URL.ngrok-free.app"; 
// -----------------------------------------------

function syncToBackend(e) {
  if (!e) return;

  var sheet = e.source.getActiveSheet();
  var sheetName = sheet.getName();
  
  // 1. Handle Multi-Row Ranges
  var range = e.range;
  var startRow = range.getRow();
  var numRows = range.getNumRows();
  var lastCol = sheet.getLastColumn();

  // Ignore header edits
  if (startRow === 1) return;
  if (lastCol === 0) return;

  // 2. Fetch Headers (The Keys)
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  // 3. Prepare Batch Payload
  var changes = [];

  // Loop through every modified row
  for (var i = 0; i < numRows; i++) {
    var currentRow = startRow + i;
    
    // Fetch the entire row data to ensure context (Name + Age + City)
    var rowValues = sheet.getRange(currentRow, 1, 1, lastCol).getValues()[0];
    var rowObject = {};
    
    headers.forEach(function(header, index) {
      // FIX: Unnamed Columns -> "Column_3" fallback
      var key = header ? header : "Column_" + (index + 1);
      rowObject[key] = rowValues[index];
    });

    changes.push({
      row_id: currentRow,
      data: rowObject
    });
  }

  // 4. Send Batch Payload
  var payload = {
    sheet_name: sheetName,
    user: Session.getActiveUser().getEmail() || "Anonymous",
    timestamp: new Date().toISOString(),
    changes: changes // Sending an array of rows
  };

  try {
    var options = {
      'method' : 'post',
      'contentType': 'application/json',
      'payload' : JSON.stringify(payload)
    };
    UrlFetchApp.fetch(BACKEND_URL + "/webhook/sheet-update", options);
    Logger.log("Sent batch update for " + changes.length + " rows.");
  } catch (error) {
    Logger.log("Error sending webhook: " + error);
  }
}

function setup() {
  var ui = SpreadsheetApp.getUi();
  ui.alert("Syncraft Sprint 1 is Live!");
}