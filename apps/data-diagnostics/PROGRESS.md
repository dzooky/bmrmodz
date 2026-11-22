# Data Tool Diagnostics progress

## v0.1.2 — LAN HTTP manual report upload (2026-11-23)
- **Implemented on draft PR #48:** `apps/data-diagnostics/upload.js` sends sanitized reports only on explicit **Send report** to `http://192.168.0.10/bmrmodz.php` using HTTP port 80, with no DNS fallback, internet hostname, or authentication token. All allowlist, request-size and response-ID checks remain.
- **Updated:** English What's New `0.1.2 — LAN report upload`, app manifest version, README and mock upload regression checks. The prior HTTPS flow remains documented below as historical v0.1.1 implementation.
- **Server smoke test confirmed by user:** DietPi returned HTTP 201 and created a JSON file with mode 0600 plus `index.html`. This verifies local server-side receipt, not MGU operation.
- **Not verified in car:** LAN reachability and actual MGU upload, UI, Data Tool ECU/CDS reads. Reports are stored under the web root and may be accessed by their direct URLs; temporary isolated LAN testing only.


## PHP LAN receiver storage adjustment (2026-11-23)
- **Implemented on draft PR #48:** PHP receiver now stores reports in `__DIR__/bmrmodz_reports` beside `bmrmodz.php`, matching the shared Nginx/PHP-FPM mount without Docker or Nginx configuration changes. Requires an existing writable directory; creates an empty `index.html` to prevent ordinary directory listings.
- **Limitation:** `index.html` does not protect individual JSON files from direct HTTP access. Use only on a non-public test LAN; do not include identifying data. Source IP restriction may see a Docker/proxy IP instead of the client IP and needs verification during the HTTP test.
- **Still pending:** in-container runtime test and real-car validation. The MGU client upload endpoint is still the old external HTTPS address; it has not been changed in this PHP-only step.


## LAN receiver draft (2026-11-23)
- **Implemented on draft PR #48:** `server/bmrmodz.php` switched to LAN-only no-token acceptance from peer IPv4 `192.168.0.0/24`, with private storage outside the web root. Default directory is `../bmrmodz_reports`, which must be created writable on the home server. The server does not trust forwarding headers. HTTPS is not required on this isolated LAN.
- **Not yet integrated:** MGU app `upload.js` still sends authenticated HTTPS to `dzooky.eu`, and must be switched to LAN HTTP before it can send to this receiver. Neither part has been validated on the home server or in the car. Home server must not be exposed to public internet.
- No app release/version change from this PHP-only edit.


## v0.1.1 — manual HTTPS report sender (2026-11-22)
- **Implemented on draft PR #48:** one-shot explicit **Send report** control posts the sanitized JSON report to `https://dzooky.eu/bmrmodz.php` using HTTPS with the existing MGU uplink DNS fallback. It never auto-uploads. The screen shows the returned anonymous report ID or a safe error.
- Added `server/bmrmodz.php`: private report storage, authentication header, strict POST/HTTPS/size/schema checks, and no public report read API. Server requires token and private directory configured outside GitHub.
- **Language:** user approved English-only for this experimental test app; removed the other languages from its manifest and active catalogs. Visible 0.1.1 What's New is in English.
- **Tests:** mock HTTPS destination/header/redaction test and CI PHP syntax check added; verify current CI status independently. No actual deployment to dzooky.eu, no token provisioned, no real vehicle test.
- **Remaining:** one-time server and MGU secret provisioning and HTTPS connectivity verification. No token is included in source or release package.

## v0.1.0 — MGU parked-car feasibility tester (2026-11-22)

- **Implemented on draft PR #48:** new independent OAP diagnostic application using MGU App Kit. Info is the first tab and initial view with the mandatory development notice. Diagnostics, Results and Share tabs provide a manual read-only test sequence and results. Never contacts any ECU directly.
- Uses local Unix socket to Data Tool 0.1.5, explicitly checks service, SOME/IP environment/config/native load, DDE, EGS, IHKA, BDC and ACSM read-only samples, CDS temperature and RPM subscription. Missing service/config/native capability yields FAIL or SKIP, never a fabricated PASS.
- Stores a sanitized JSON report in the app data directory on Export and renders a compact, VIN-free QR code for phone scanning (no external server, network transfer or credentials). Failed operations include short error details; raw ECU data, vehicle order and VIN are excluded.
- Originally localized in 22 languages; deliberately simplified to English-only in v0.1.1 per user direction. The tester itself does not subscribe to vehicle HMI/ECU signals.
- **Automated tests:** read-only runner, UDS echo validation, safe failures, socket protocol, 22 language catalogs, static notice, full mock QR encoding and offline MGU preview build all passed in GitHub Actions Data Tool feasibility on PR #48 (head a83829cab387, run 45080774732). This is CI validation only, not in-car operation.
- **In-car:** NOT TESTED. Hardware-visible UI, QR scanning on screen, tool installation and actual ECU/CDS reads remain unverified.
- **Known limitation:** Tool-only SOME/IP config/ACL provisioning is not proven; the CDS tests may fail or be skipped. Export writes to application data; the QR transfers only a sanitized compact report, not full JSON.
- **Safety:** operator-triggered only, parked vehicle required; no CC actuator, UDS 0x31/0x2E or unattended polling.

## Next
1. Review CI/PR and MGU Store deployment on test branch.
2. Parked-car smoke check: Info notice, menu buttons, native module/config report, service startup and tool-only connection.
3. Parked-car read-only ECU sampling and QR scanning; send sanitized report to development.
4. Investigate SOME/IP identity/ACL without borrowing private app config or bypassing permissions.
5. Only after full functional coverage is proven, decide on migration.
