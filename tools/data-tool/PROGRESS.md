# Data Tool feasibility progress

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
