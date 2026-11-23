# Data Tool feasibility progress

## In-car read-only report — 2026-11-23
- **Observed from user-provided after-wake MGU diagnostic export:** 24 PASS, 0 FAIL, 5 SKIP (five aggregated result records). SOME/IP native load, DDE B57 read, EGS read and shared CDS sample returned PASS. The report notes fresh CDS cache and a stopped lease. Values are informational; decoding accuracy and exact software build were not independently checked.
- **Remain NO-GO:** installed application identity and authorization, verified signal permissions, ECU controls, sustained multi-app concurrency, watchdog/recovery and background startup. Peer/kernel probes are preliminary and do not establish package identity. No actuator writes or routines were exercised.
- **Follow-up gate:** reconcile report's richer checks and totals with the older test runner present in PR #48, identify exact installed revisions, then add strictly read-only regression coverage before any migration or active controls.


## v0.1.5 — separate Data Tool Diagnostics MGU companion (2026-11-22)
- **Implemented on draft PR #48:** tool version increased to 0.1.5 for an explicitly read-only companion app (`apps/data-diagnostics`, 0.1.0). The app calls only the Data Tool socket and provides a parked-car smoke test and sanitized offline QR report.
- **Scope:** no ECU control, no automatic polling, no changes to OSA/DPF/CC/Spritmonitor, no migration. A QR summary is not equivalent to full JSON export.
- **Tests:** app/runner/translation/QR/manifest and tool CI passed on PR #48 at a83829cab387 (Data Tool feasibility run 45080774732; Car Equipment, Notification Tool, MGU Store manifest checks also passed). In-car validation remains pending.
- **Known blocker:** native SOME/IP module/config/ACL support from the independent systemd tool remains unproven. Full functional test coverage still requires the real MGU.

## v0.1.4 — static CC control contract and corrected BMW manifest (2026-11-22)\n- **Implemented on draft PR #48:** exact source-backed CC UDS operation matrix with status reads, ACSM `0x31` belt routines, IHKA press/release/stop, BDC wheel heat `0x2E`, response echo checks, safety requirements. The `ccPlan` operation is **static only**. No controls can be executed.\n- Corrected `signal-manifest.json` structure to BMW generator `proxies`/`services` format after comparing with `kit/tools/build.py`. Added schema regression test.\n- **Automated checks:** workflow validates CC matrix, no-UDS/no-control behavior, signal manifest, and launches the actual isolated worker against a fake SOME/IP binding to check load, subscription, temperature/RPM extraction, allowlist and missing configuration; CI status is recorded separately.\n- **Outstanding:** platform identity/ACL registration, standalone native SOME/IP field reception, real ECU control feedback and concurrency have not been demonstrated in-car.\n\n## v0.1.3 — tool-owned SOME/IP configuration checks and passive report (2026-11-22)
- **Implemented in feature branch:** dedicated signal manifest and local `configCheck`/`report` APIs; one-shot CLI support; checks generated CDS fields against a tool-owned configuration path (`/var/opt/bmrmodz-data-tool/config/de_bmw_infotainment_vehicle_CDS.json`). Report deliberately performs no ECU traffic, native loading or signal subscription.
- **Automated tests:** added report/config tests and no-UDS-report assertions. CI status must be checked for this commit.
- **Remaining blocker:** the MGU's BMW generator must produce the tool-owned SOME/IP interface JSON and authorization must be verified on the vehicle. Having the manifest or a JSON file alone does not register an ACL or prove access. Real-car tests are still pending.
- **Control path:** CC `0x31`/`0x2E` remains unimplemented; existing apps unchanged. No migration authorized.

## v0.1.2 — isolated native SOME/IP probe (2026-11-22)
- **Implemented:** explicit `signalNative load` and `signalNative sample` API. Native module loading and CDS proxy/subscription occur ONLY in a child process under an 8-second kill timeout; the service never loads the binding itself.
- **Scope:** read-only `statusEngineTemperature` and `statusEngineSpeed2` in instance `1`. Sample requires `BMRMODZ_CDS_CONFIG` pointing to a valid generated CDS interface configuration. No automatic subscriptions, unattended vehicle reading, app migration or ECU writes.
- **Regression:** fake worker checks allowlist, command isolation, successful subprocess reply and hard timeout; service checks mock API and no UDS read. CI status must be checked after push.
- **Known blocker:** a service-owned generated SOME/IP config and native module discoverability/ACL on the real MGU are not yet proven. This revision cannot count as vehicle validation.

## v0.1.1 — passive SOME/IP environment feasibility (2026-11-22)
- **Implemented:** passive `signalEnvironment` local API, reporting read-only catalog presence, requested signal fields, and whether a native `someip` module can be resolved without executing it.
- **Safety:** no native module loading, proxy creation, subscription, ECU request or actuator action during survey. Existing apps unchanged.
- **Tests:** offline catalog coverage / missing-module tests and local API no-UDS-traffic regression added; GitHub CI to be verified independently.
- **Limits:** native SOME/IP permissions, functional proxy, field subscriptions and background availability still **unverified in car**. `someip` module path and ACL may differ on MGU.

## v0.1.0 — first experimental build (2026-11-22)
- **Implemented on feature branch:** standalone systemd tool, local Unix socket JSON Lines API, explicit on-demand allowlisted UDS 0x22 reads to DDE, EGS, IHKA, BDC, ACSM, gateway.
- Uses installed hmictl helper; no executable bundled. Request serialization, identical-read coalescing, short TTL cache, response echo validation, TASU pending handling, error counters.
- Starts without ECU traffic; no automatic polling. Existing applications, Car Equipment and Notification Tool remain untouched.
- **Not implemented:** CDS / SOME-IP subscriptions, UDS routine controls (0x31) and writes (0x2E), per-app permission enforcement, sustained live streaming, vehicle-side full coverage.
- **Safety:** No actuator commands. Explicitly triggered tests only; test with vehicle parked and after reviewing logs. No claim of real vehicle verification.
- **Automated tests:** see test.js (run status to be recorded independently). **In-car:** not tested.

## Required GO/NO-GO gates before any migration
1. Prove each allowlisted DDE/EGS/IHKA/BDC/ACSM/gateway DID using a standalone tool on the real MGU.
2. Prove CDS/SOME-IP subscriptions from a service or establish an appropriate supported signal bridge.
3. Design and parked-vehicle-test tightly scoped CC operations (ACSM routine read, IHKA routine control, BDC write) with authorization, safety gates and physical confirmation.
4. Validate sustained read intervals, concurrency with BMRMODZ and third-party apps, collision rates, watchdog restart and recovery.
5. Preserve existing app behavior; do not migrate before complete coverage is demonstrated.
