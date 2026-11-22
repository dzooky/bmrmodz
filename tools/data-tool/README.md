# BMRMODZ Data Tool — feasibility v0.1.1

This is **not** a ready-for-migration data broker. It is an MGU-installable, on-demand, read-only experimental service to prove whether a standalone tool can read the diagnostic ECUs needed by OSA, DPF and Climate Comfort.

## Architecture
- Boot starts a Node service with a local Unix socket; **no ECU reads at startup**.
- First explicit read opens an installed **hmictl** transport via TASU.
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
{"op":"read","ecu":18,"did":17595}
```
The example reads DDE 0x12, DID 0x44BB (decimal 17595). `status` never opens diagnostic transport. A successful result includes an `uds` byte array and timestamp; errors are explicit. **A successful socket response is not proof of correct ECU data**. Inspect raw values, timing and ECU correctness against the existing app.

## Test sequence
1. Run `node tools/data-tool/test.js` and `node tools/data-tool/signal-environment.test.js` for offline safety/queue/transport and passive SOME/IP checks.
2. Install only on a review vehicle, with helper dependency available. Verify systemd active before requesting. Execute `node /var/opt/bmrmodz-data-tool/current/probe.js status` then `node /var/opt/bmrmodz-data-tool/current/probe.js signalEnvironment` and explicit `read 0x12 0x44BB` to collect one DDE sample. The Unix socket is accessible to local processes; keep it strictly read-only until access controls are defined.
3. With vehicle parked, compare single DDE/EGS/IHKA/BDC/ACSM reads to existing apps one by one; preserve a log of positive/negative/timeout, latency and VIN-free vehicle configuration.
4. Repeat on several sessions, then concurrency testing with one other app at a time, then controlled driving tests by a passenger.
5. Only after read verification, develop a **separate** authorized CC actuator test and signal provider experiment. No actuator operation can be performed by this version.

## Status
Implemented in source only. CI is checked separately; installation, native binding, SOME/IP ACL, signal reception and in-car diagnostic results are unverified. See `PROGRESS.md` for migration GO/NO-GO gates.
