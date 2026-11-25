# BMRMODZ Data Tool — experimental v0.1.9

This is **not** a ready-for-migration data broker. It is an MGU-installable, on-demand, read-only experimental service to prove whether a standalone tool can read the diagnostic ECUs needed by OSA, DPF and Climate Comfort.

## Architecture
- Boot starts a Node service with a local Unix socket; **no ECU reads at startup**.
- Each explicit uncached read opens an installed **hmictl** transport via TASU and closes it immediately after the request, including failures. The tool does not retain a TASU helper between requests.
- Only preapproved UDS `0x22` ECU/DID combinations in `profiles.js` may be requested.
- One shared queue, 200 ms spacing, coalesced concurrent identical reads, 500 ms short cache. Forfeited/negative responses are not cached.
- The service does not send UDS 0x31/0x2E, does not control anything, and has no recurring background poll.
- CDS/SOME-IP standalone signal acquisition is unimplemented and must be separately proven.
- This tool is **independent** of Car Equipment Tool and changes no applications.

## API
Unix socket: `/run/bmrmodz-data-tool/ctl.sock`; UTF-8 JSON object + newline; response is JSON + newline. For example:
```json
{"op":"status"}
{"op":"capabilities"}
{"op":"signalEnvironment"}
{"op":"configCheck"}
{"op":"report"}
{"op":"ccPlan"}
{"op":"signalNative","mode":"load"}
{"op":"signalNative","mode":"sample","field":"statusEngineTemperature"}
{"op":"read","ecu":18,"did":17595}
```
The example reads DDE 0x12, DID 0x44BB (decimal 17595). `status` never opens diagnostic transport. A successful result includes an `uds` byte array and timestamp; errors are explicit. **A successful socket response is not proof of correct ECU data**. Inspect raw values, timing and ECU correctness against the existing app.

## Dedicated SOME/IP configuration\n\nThe bundled `signal-manifest.json` uses the BMW generator `proxies`/`services` manifest schema and documents the required CDS instance and read-only fields. It is **not** an installed OAP application's permission grant. A genuine per-tool configuration must be generated with the firmware-compatible BMW interface generator and successfully authorized on the MGU; do not reuse private app configs or bypass access controls. The isolated worker expects `BMRMODZ_CDS_CONFIG` or the tool-owned default `/var/opt/bmrmodz-data-tool/config/de_bmw_infotainment_vehicle_CDS.json`. Until that file and permissions exist, `signalNative sample` will correctly report a configuration failure.\n\n`probe.js report` yields a passive, structured, VIN-free readiness report and sends **no vehicle requests**. `probe.js configCheck` checks only the tool-owned config file. These are not proofs of vehicle communication.\n\n## In-car test companion app

`apps/data-diagnostics` is a separate OAP app that calls only this service. It offers manually triggered first-stage read-only diagnostics and a sanitized JSON plus offline QR summary export. Neither the app nor the tool is production ready. **Do not merge or deploy from a draft PR without review and test packaging.** The GUI does not send any 0x31/0x2E controls or poll in the background.

## Test sequence
1. Run `node tools/data-tool/test.js`, `node tools/data-tool/signal-environment.test.js` and `node tools/data-tool/signal-isolate.test.js` for offline safety/queue/transport and passive SOME/IP checks.
2. Install only on a review vehicle, with helper dependency available. Verify systemd active before requesting. Execute `node /var/opt/bmrmodz-data-tool/current/probe.js status` then `node /var/opt/bmrmodz-data-tool/current/probe.js signalEnvironment` and explicit `read 0x12 0x44BB` to collect one DDE sample. The Unix socket is accessible to local processes; keep it strictly read-only until access controls are defined.
3. Once passive environment checks pass, run `node /var/opt/bmrmodz-data-tool/current/probe.js signalNative load`. This launches a separate native-binding worker with a hard timeout. An isolated CDS sample additionally requires `BMRMODZ_CDS_CONFIG` in the **service environment** pointing to a generated CDS interface JSON created for this tool; invoke `probe.js signalNative sample statusEngineTemperature`. It does **not** search or borrow private app configs. If missing, expect an explicit `config` failure, not a claim of signal success. Keep the car parked and review test permission before using the experimental native loader.
4. With vehicle parked, compare single DDE/EGS/IHKA/BDC/ACSM reads to existing apps one by one; preserve a log of positive/negative/timeout, latency and VIN-free vehicle configuration.
5. Repeat on several sessions, then concurrency testing with one other app at a time, then controlled driving tests by a passenger.
6. Only after read verification, develop a **separate** authorized CC actuator test and signal provider experiment. No actuator operation can be performed by this version.

## Climate Comfort control feasibility\n\n`probe.js ccPlan` exposes an **inert** coverage matrix for IHKA seat press/release/stop, BDC wheel heating and ACSM belt routines. It does not execute any UDS 0x31 or 0x2E commands. Code for changing ECU state is intentionally absent. Vehicle-side validation and authorization are separate work.\n\n## Status
Implemented in source only. CI is checked separately; installation, native binding, SOME/IP configuration/ACL, signal reception and in-car diagnostic results are unverified. See `PROGRESS.md` for migration GO/NO-GO gates.
