# Data Tool Diagnostics progress

## v0.1.0 — MGU parked-car feasibility tester (2026-11-22)

- **Implemented on draft PR #48:** new independent OAP diagnostic application using MGU App Kit. Info is the first tab and initial view with the mandatory development notice. Diagnostics, Results and Share tabs provide a manual read-only test sequence and results. Never contacts any ECU directly.
- Uses local Unix socket to Data Tool 0.1.5, explicitly checks service, SOME/IP environment/config/native load, DDE, EGS, IHKA, BDC and ACSM read-only samples, CDS temperature and RPM subscription. Missing service/config/native capability yields FAIL or SKIP, never a fabricated PASS.
- Stores a sanitized JSON report in the app data directory on Export and renders a compact, VIN-free QR code for phone scanning (no external server, network transfer or credentials). Failed operations include short error details; raw ECU data, vehicle order and VIN are excluded.
- Localized screen/button/release-note strings in all 22 supported languages. Language is selected in Settings; the tester itself does not subscribe to vehicle HMI/ECU signals.
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
