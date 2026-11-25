'use strict';
// Temporary test app: English UI only.
const catalogs={
  "en": {
    "Share": "Share",
    "Info": "Info",
    "Diagnostics": "Diagnostics",
    "Results": "Results",
    "Run diagnostics": "Run diagnostics",
    "Export report": "Export report",
    "Previous page": "Previous page",
    "Next page": "Next page",
    "Read-only diagnostic test": "Read-only diagnostic test",
    "No vehicle controls will be activated": "No vehicle controls will be activated",
    "Open Diagnostics and press Run": "Open Diagnostics and press Run",
    "Status": "Status",
    "Not tested": "Not tested",
    "Running": "Running",
    "Completed": "Completed",
    "No report yet": "No report yet",
    "Exported to app data": "Exported to app data",
    "Export failed": "Export failed",
    "What's New": "What's New",
    "Initial read-only feasibility test application": "Initial read-only feasibility test application",
    "Stay parked during the test": "Stay parked during the test",
    "PASS": "PASS",
    "FAIL": "FAIL",
    "SKIP": "SKIP",
    "Send report": "Send report",
    "Sending report": "Sending report",
    "Report sent": "Report sent",
    "Send failed": "Send failed",
    "Upload token missing": "Upload token missing",
    "Secure upload": "Secure upload",
    "LAN report upload": "LAN report upload",
    "Data Tool dependency updated": "Data Tool dependency updated"
  }
};
function t(language,key){return catalogs.en[key]||key;}
module.exports={catalogs,t};
