# B47 DDE 0F2678 – BimmerLink comparison (20 November 2026)

Tester vehicle: B47, ECU 0x12, positive DDE identification `62 F1 50 0F 26 78`.

## Confirmed candidate values (same session, reported screenshot comparison)

| DID | Positive UDS response | Probe physical estimate | BimmerLink |
| --- | --- | --- | --- |
| 44BE (soot) | `62 44 BE 06 7E` | 25.36 g, 0.01525902 g/count | 25.36 g |
| 44BD (ash) | `62 44 BD 07 3B` | 28.24 g, 0.01525902 g/count | 28.24 g |
| 44BF (distance since success) | `62 44 BF 00 06 CB C4` | 445.38 km (raw metres / 1000) | 445 km |
| 44C7 (avg interval) | `62 44 C7 02 41` | 577 km (raw kilometres) | 577 km |

The first four scalings match this test but should be rechecked after another drive for robustness.

## Unknown conversion / state interpretation – preserve raw data

| DID | Readout | Decimal raw | External BimmerLink baseline |
| --- | --- | --- | --- |
| 44BB – regen request candidate | `62 44 BB 00` | 0 | Requested: No |
| 467E – regeneration mode candidate | `62 46 7E 00 21 00 01` | 2162689 | Running: No; Interrupted: No; Locked: No |
| 44ED – pressure candidate | `62 44 ED 55 ED` | 21997 | Before DPF: 1.00 bar; differential DPF: 0.01 bar; **field alignment unproven** |
| 4502 – temperature candidate | `62 45 02 13 F3` | 5107 | Exhaust temperature before DPF: 134 °C; **field alignment unproven** |

BimmerLink also showed coolant 62 °C, time since regeneration 12 h, fuel since regen 25.65 l, remaining DPF distance 164400 km. No corresponding probe DIDs were established.

**Do not infer** 44ED is differential pressure (could be another pressure); do not infer 4502 is DPF inlet exhaust temperature; and do not declare mode word 0x00210001 a general-purpose `idle` encoding from a single baseline. Confirm IDs via B47-specific PRG/diagnostic definitions and/or capture synchronized data during safely occurring natural regeneration or a changing sensor condition.

## Next tester run

1. Open B47 Probe v0.1.38, allow it to finish, record the full screen with timestamp.
2. Record BimmerLink soot, ash, distance/average, exhaust pressure before DPF, DPF differential pressure, exhaust temperature before DPF, and regen Requested / Running / Interrupted / Locked at the same engine state as closely in time as possible.
3. Repeat after normal warm-up to gather **multiple pairs** for pressure/temperature scaling. Note engine running vs stopped, RPM and vehicle movement.
4. If a **natural** regeneration happens, record raw 44BB/467E alongside BimmerLink status during its phases. **Do not request or force regeneration.**
5. Report both snapshots and approximate times. Keep unknown scalings disabled until confirmed.

This probe remains isolated on the `feature/dpf-b47-readonly-probe` branch; do not merge it with the main B57 app until values and states are verified.

## Deferred measurements for weekend / when convenient

**No special driving is requested.** The B47 core metrics (soot, ash, since last regeneration, average regeneration distance) have been repeatedly compared successfully with BimmerLink. The main DPF app can now show those in normal graphical gauges.

Still to identify and confirm when naturally available:
- Regen requested / active / interrupted / locked: capture simultaneous BimmerLink states and raw DID `44BB` and `467E`. A single idle snapshot cannot reveal bit layout. Do not manually trigger regen.
- Temperature: `4502` raw alongside BimmerLink exhaust temperature at naturally differing conditions; confirm the exact sensor.
- Pressure: `44ED` raw alongside BimmerLink before-DPF pressure and differential pressure; confirm which sensor, if either.
- Optional: engine time, fuel consumed and remaining DPF life, but only after identifying their appropriate B47 read-only DIDs.

These are follow-up diagnostics, **not blockers for B47 core support**. Keep the B47 probe as a separate tester branch until they can be validated; do not merge experimental raw display into main DPF.
