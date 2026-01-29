// [Code.gs]

var BACKEND_URL = "https://syncraft-backend.onrender.com"; 

function onEdit(e) {
  if (!e || !e.range) return;
  
  var sheet = e.range.getSheet();
  var sheetName = sheet.getName();
  var row = e.range.getRow();
  var col = e.range.getColumn();
  var value = e.value || ""; // New value
  
  // Skip editing headers (Row 1)
  if (row === 1) return;

  // Get the Header Name for the edited column
  var header = sheet.getRange(1, col).getValue();
  
  // Prepare payload matching Backend expectations exactly
  var payload = {
    "sheet_name": sheetName,
    "row_id": row,
    "data": {}
  };
  
  // Adding the changed data key-value pair
  payload.data[header] = value;

  var options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true
  };

  try {
    UrlFetchApp.fetch(BACKEND_URL + "/webhook/sheet-update", options);
    Logger.log("✅ Sent update for Row " + row);
  } catch (error) {
    Logger.log("❌ Error sending webhook: " + error.toString());
  }
}