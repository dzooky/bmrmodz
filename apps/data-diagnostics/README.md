# BMRMODZ Data Tool Diagnostics v0.1.0

Development-only MGU OAP application, installed alongside experimental Data Tool v0.1.5. This application never opens TASU or CDS connections itself. It uses the local Unix socket provided by the systemd tool.

## Operation
1. Park securely. Install **both** components from an approved test build, not merely a draft GitHub PR.
2. Open the app. The first tab is Info with the required development notice.
3. Select Diagnostics and press **Run diagnostics**. This explicitly sends only allowlisted read-only operations to Data Tool. Nothing runs automatically.
4. On Results, review individual PASS/FAIL/SKIP states. Missing tool, module or configuration produces an explicit failure or skip.
5. Press **Export report** to save the sanitized JSON in the app data folder and show a QR code carrying a compact summary. Scan it on a phone and paste the summary into the development chat. No internet connection or SSH is needed to share the compact summary. Full JSON is only available from the app data directory by a separately supported file-transfer method.

## Test coverage
- Service startup and socket API.
- Passive SOME/IP module/catalog/config checks, isolated module load.
- DDE `22 44BB`, EGS `22 6000`, IHKA `22 D8D7`, BDC `22 D074`, ACSM `22 4053`.
- CDS `statusEngineTemperature` and `statusEngineSpeed2` via the isolated service worker.
- No write/routine controls. CC 0x31 and 0x2E are intentionally **not** triggered.
- No autonomous background polling. This is a **first-stage smoke test**, not full coverage of every DID or signal.

## Interpretation
A PASS means a matching response was seen, not that the decoded vehicle value is correct. The report contains no raw UDS bytes, VIN, VO/FA, GPS coordinates or secrets. Actual vehicle operation and optical display require explicit in-car confirmation. Tests should run only while stationary; driving concurrency tests are future work.
