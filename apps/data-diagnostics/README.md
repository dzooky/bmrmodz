# BMRMODZ Data Tool Diagnostics v0.1.1

Development-only MGU OAP application, installed alongside experimental Data Tool v0.1.5. This application never opens TASU or CDS connections itself. It uses the local Unix socket provided by the systemd tool.

## Operation
1. Park securely. Install **both** components from an approved test build, not merely a draft GitHub PR.
2. Open the app. The first tab is Info with the required development notice.
3. Select Diagnostics and press **Run diagnostics**. This explicitly sends only allowlisted read-only operations to Data Tool. Nothing runs automatically.
4. On Results, review individual PASS/FAIL/SKIP states. Missing tool, module or configuration produces an explicit failure or skip.
5. Once the server and token are provisioned, press **Send report** to POST the sanitized JSON over HTTPS to `https://dzooky.eu/bmrmodz.php`; the server returns an anonymous report ID. This button never sends automatically. Without a configured token it reports an error and nothing is sent.
6. Press **Export report** to save the sanitized JSON in the app data folder and show a QR code carrying a compact summary. Scan it on a phone and paste the summary into the development chat. No internet connection or SSH is needed to share the compact summary. Full JSON is only available from the app data directory by a separately supported file-transfer method.

## One-time HTTPS upload setup

The PHP endpoint is in `server/bmrmodz.php`. Upload it as `/bmrmodz.php` to the `dzooky.eu` HTTPS web root. Configure **server-side** environment variables `BMRMODZ_REPORT_TOKEN` (at least 32 random characters, never put it in GitHub) and `BMRMODZ_REPORT_DIR` (a writable directory **outside** the public web root). Do not enable file uploads before those checks pass. The MGU app reads the matching token from its private application data file `report-upload-token.txt` (or from its process environment variable of the same name). **Secure provisioning of this private file to MGU is a remaining deployment step.** Do not send the token in chat or commit it. PHP does not serve report files; retrieve them using the hosting file manager/SFTP from the private report directory.

## Test coverage
- Service startup and socket API.
- Passive SOME/IP module/catalog/config checks, isolated module load.
- DDE `22 44BB`, EGS `22 6000`, IHKA `22 D8D7`, BDC `22 D074`, ACSM `22 4053`.
- CDS `statusEngineTemperature` and `statusEngineSpeed2` via the isolated service worker.
- No write/routine controls. CC 0x31 and 0x2E are intentionally **not** triggered.
- No autonomous background polling. This is a **first-stage smoke test**, not full coverage of every DID or signal.

## Interpretation
A PASS means a matching response was seen, not that the decoded vehicle value is correct. The report contains no raw UDS bytes, VIN, VO/FA, GPS coordinates or secrets. Actual vehicle operation and optical display require explicit in-car confirmation. Tests should run only while stationary; driving concurrency tests are future work.
