# BMRMODZ Data Tool Diagnostics v0.1.2

Development-only MGU OAP application, installed alongside experimental Data Tool v0.1.5. This application never opens TASU or CDS connections itself. It uses the local Unix socket provided by the systemd tool.

## Operation
1. Park securely. Install **both** components from an approved test build, not merely a draft GitHub PR.
2. Open the app. The first tab is Info with the required development notice.
3. Select Diagnostics and press **Run diagnostics**. This explicitly sends only allowlisted read-only operations to Data Tool. Nothing runs automatically.
4. On Results, review individual PASS/FAIL/SKIP states. Missing tool, module or configuration produces an explicit failure or skip.
5. With the MGU connected to the same isolated home LAN as `192.168.0.10`, press **Send report** to POST the sanitized JSON over HTTP to `http://192.168.0.10/bmrmodz.php`. The receiver returns an anonymous report ID. This button never sends automatically. There is no upload token.
6. Press **Export report** to save the sanitized JSON in the app data folder and show a QR code carrying a compact summary. Scan it on a phone and paste the summary into the development chat. No internet connection or SSH is needed to share the compact summary. Full JSON is only available from the app data directory by a separately supported file-transfer method.

## One-time LAN upload setup

The PHP endpoint is in `server/bmrmodz.php`. Deploy it as `/bmrmodz.php` on the home Nginx/PHP-FPM server; the `bmrmodz_reports` directory must exist alongside the PHP file, be writable by PHP, and be accessible only inside the trusted home LAN. The user confirmed a `201 Created` response and a saved test JSON via `curl` on DietPi; MGU transfer remains unverified. The receiver limits requests to `192.168.0.0/24` peers and accepts no token. The LAN HTTP transport is unencrypted; do not port-forward or publicly expose the endpoint. Report files within the web root may be retrievable if their random filename is known; `index.html` only suppresses directory listing. This is temporary test infrastructure, not a production-safe collector.

## Test coverage
- Service startup and socket API.
- Passive SOME/IP module/catalog/config checks, isolated module load.
- DDE `22 44BB`, EGS `22 6000`, IHKA `22 D8D7`, BDC `22 D074`, ACSM `22 4053`.
- CDS `statusEngineTemperature` and `statusEngineSpeed2` via the isolated service worker.
- No write/routine controls. CC 0x31 and 0x2E are intentionally **not** triggered.
- No autonomous background polling. This is a **first-stage smoke test**, not full coverage of every DID or signal.

## Interpretation
A PASS means a matching response was seen, not that the decoded vehicle value is correct. The report contains no raw UDS bytes, VIN, VO/FA, GPS coordinates or secrets. Actual vehicle operation and optical display require explicit in-car confirmation. Tests should run only while stationary; driving concurrency tests are future work.
