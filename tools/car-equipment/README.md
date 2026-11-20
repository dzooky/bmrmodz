# Car Equipment — BMRMODZ HU Tool
**Version:** 0.1.0 (development; not yet installable as a working vehicle reader)

A shared read-only BMW MGU / iDrive 7 service for OSA, DPF Monitor, and future BMRMODZ apps. Applications ask whether an option exists rather than independently reading vehicle coding.

## Intended functionality
- Read the vehicle's FA/VO through the gateway, **UDS 22 3F 06 on ECU 0x10**, using the **identical strict parser** from BMRMODZ Climate Comfort (apps/climate-comfort/vehicle-order.js).
- Cache the validated SA/SALAPA option set in memory; refresh on startup and on request.
- Batch and single code checks; aliases: hud=610, digital_cluster=6WB, live_cockpit_professional=6U3.
- Return true/false only for successfully read, validated FA; otherwise `"unknown"`. Do not assume a display is writable merely because the hardware option is present.
- No ECU write, coding, flash, remote exposure, or VIN logging.

## Local API
Unix socket: `/run/bmrmodz-car-equipment/ctl.sock`, newline-delimited JSON.
```json
{"op":"check","codes":["610","6WB","6U3"]}
```
Reply after successful read: `{"ok":true,"results":{"610":true,"6WB":false,"6U3":true},"source":"vehicle_order","updatedAt":"...","error":null}`
If the car could not be read, every requested item is `"unknown"`.
Other requests: `{"op":"status"}`, `{"op":"refresh"}`.
Do not use results from an earlier car after a failed refresh.

## Current limitation / integration
The existing Climate Comfort vehicle-order code lives inside an app and calls `ReadOnlyDiag(ctx.signals, ...)`. A background HU Tool does not have that app context. This repository version includes the **real Climate Comfort decoder and query logic**, service, API, manifest and an explicit diagnostic transport adapter boundary. It **does not include a verified standalone MGU TASU/SOME-IP diagnostic adapter**; without `CAR_EQUIPMENT_ADAPTER`, service deliberately refuses to start. This is **not yet vehicle-ready**. Implement and validate adapter access on MGU before installation. Do not ship or label as operational until the adapter is tested on the car.

The adapter should export `createLink()` providing `ready`, async `init()`, async `read(target,did,timeoutMs)`. Only target `0x10`, DID `0x3F06` are permitted.
The Unix socket is local and mode 0666 for app access; future permission hardening is recommended before general release.

## Dependencies / provenance
Decoder and VO handling adapted from **this repository's own Climate Comfort**, not from Light Show. HU Tool manifest structure follows the observed MGU Store tool format (e.g. IterioDev Comfort). Confirm deployment compatibility and licensing separately.

## Tests
Run `node test.js` on a development PC. No car is contacted in tests.
