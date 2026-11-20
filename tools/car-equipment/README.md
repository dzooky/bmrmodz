# Car Equipment — BMRMODZ HU Tool

**Version:** 0.1.0 · **iDrive 7 MGU** · **Development preview: in-car testing required**

Car Equipment is a background HU Tool that provides a shared read-only BMW Vehicle Order (FA/VO) equipment-check API to **OSA, DPF Monitor**, and other BMRMODZ applications. A client may ask once for a single option or an entire list, and receive yes / no / unknown. Car Equipment does not render on the instrument cluster or HUD.

## How vehicle equipment is detected

The Tool uses the **same ECU and DID and the same strict FA/VO parser as BMRMODZ Climate Comfort** (`apps/climate-comfort/vehicle-order.js`).

1. MGU starts the Car Equipment systemd service.
2. The service uses the locally installed **hmictl** TASU SOME/IP helper from the **IterioDev Comfort** HU Tool (declared as a dependency in `component.json`).
3. A read-only `22 3F 06` request goes to gateway `0x10`, via the head unit's TASU diagnostic gateway `0xF8A6`.
4. The complete response is validated and decoded into the vehicle's SALAPA / SA option codes; results are cached in memory.
5. Clients check one or more codes through a **local-only Unix socket**.

No ECU coding, writes, actuator commands, or automatic display rendering. Vehicle configuration and installed equipment are not identical in every retrofit scenario; SA codes indicate what is **encoded in VO**, not guaranteed functioning hardware.

## Dependency / installation

The repository includes the Tool's `component.json`, service unit and its source files, and registers it under `mgu-repo.json > tools` for MGU Store. MGU Store must be able to resolve and install the dependency `iteriodev-comfort >= 0.6.3` (from a repository enabled in the Store). This is **another HU Tool, and its Comfort service has additional seat/ambient-light functions**; it is used here only to access its locally installed `hmictl` executable. Car Equipment does not invoke those functions.

The helper is searched at:
- `/var/opt/iteriodev-comfort/current/hmictl`
- `/var/opt/iteriodev-turnview/current/hmictl`
- `/var/opt/iteriodev-overlays/current/hmictl`

Advanced setups can supply `CAR_EQUIPMENT_HMICTL` (executable path) or `CAR_EQUIPMENT_ADAPTER` (Node adapter module path). No helper binary is redistributed with Car Equipment. Without a compatible helper the service fails clearly rather than inventing equipment data.

**Important:** this implementation and its packaging have not been verified on an actual MGU. The exact dependency-resolution behavior and tool startup need a car test before any public release.

## Local API (JSON Lines)

Socket: `/run/bmrmodz-car-equipment/ctl.sock`. Send one JSON object followed by `\\n` and read one JSON reply followed by `\\n`.

Request:
```json
{"op":"check","codes":["610","6WB","6U3"]}
```

Example reply from a *successfully read and validated* VO (illustrative, not a measurement of any particular car):
```json
{"ok":true,"results":{"610":true,"6WB":false,"6U3":true},"source":"vehicle_order","updatedAt":"2026-11-20T00:00:00.000Z","error":null}
```

If VO cannot be read or validated, requested items return `"unknown"` (never `false`). Every key is echoed as requested; case-insensitive 3-character BMW SA codes are supported. Aliases: `hud` -> `610`, `digital_cluster` -> `6WB`, `live_cockpit_professional` -> `6U3`.

Other operations: `{"op":"status"}` and `{"op":"refresh"}`. On service startup, VO is read automatically. A check waits for a pending read, and after failure retries at most once every 30 seconds. The cache is invalidated on a failed refresh to avoid using stale data from a different car.

**Equipment != feature permission:** a HUD option in FA does **not** prove that the app has a functioning renderer or is allowed to write to HUD. OSA/DPF must separately check actual rendering capability.

## Client API for OSA / DPF Monitor

The repository's App Kit now includes `kit/runtime/car-equipment.js`; packaged apps can use:

```js
const equipment = require('./kit/car-equipment');
const hud = await equipment.has('610'); // true, false, or 'unknown'
const options = await equipment.check(['610', '6WB', '6U3']);
// options.results['610'], options.results['6WB'], options.results['6U3']
```

`unknown` also covers a missing tool, an unreadable VO, and a communication timeout; clients must not treat it as `false`. The shared library is available for future app integration; existing OSA/DPF application behavior has not been changed by this PR.

## Development / verification

Run `node tools/car-equipment/test.js` from the repository root. The tests use synthetic VO frames; no vehicle is contacted. On the MGU, check the systemd service log and send `{"op":"refresh"}` then `{"op":"check","codes":["610","6WB","6U3"]}` via a Unix socket client. Cross-check against E-Sys FA/VO. Do not label it car-tested before doing so.

Source credit: Vehicle Order decoding is adapted from the project's **Climate Comfort**. The HU Tool packaging and TASU helper CLI integration follow the **IterioDev Comfort** tool's published interface. No third-party executable is bundled.
