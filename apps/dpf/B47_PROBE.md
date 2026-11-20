# B47 DDE read-only probe (draft)

This is an **opt-in diagnostic experiment**, not validated B47 support.

## Purpose
A 2021 BMW 520d owner with MGU iDrive 7 can send photos of the vehicle's actual
DDE identification and raw UDS responses, without a laptop or log export.

The existing B57 path remains gated on the previously validated SGBD index
`0F1FE8`. Unknown DDEs do **not** get B57 scaling, regeneration-state bits or
cluster notifications.

## In-car procedure
1. Park the vehicle safely, keep the ignition on and the DDE awake.
2. Open **DPF Status → B47 Probe**. This starts one sequential read-only scan.
3. Wait until the status says **Complete** (or shows a diagnostic error).
4. Take a clear photo of the full screen and send it to the developer. There
   are no VIN, registration or other identifying fields on this screen.
5. Leave the tab, then reopen it to take another scan if needed.

This reads physical ECU `0x12` using UDS service `0x22` only. It reads
`F150` for the ECU index and then one at a time:
`44BE`, `44BD`, `44BF`, `44BB`, `467E`, `44ED`, `4502`, `44C7`.

The second group comes from diagnostic mappings attributed to B47
`D83BX7C0` in publicly available project documentation. It is *not*
yet confirmed to be compatible with every B47 DDE variant. A positive
response, error NRC or timeout is recorded in hex; values are not
decoded or presented as validated measurements.

## Constraints and follow-up
- No programming, coding, actuator control, service routine or reset.
- Avoid running the probe during vehicle programming or while driving.
- Verify any candidate B47 value against ISTA/Tool32 or BimmerLink before
  enabling the regular DPF dashboard for that ECU variant.
- Confirm the tester's SGBD index and actual response lengths; never
  reuse the B57 status-bit interpretation without separate verification.
- No in-car verification or BMW SDK build has been performed for this draft.
