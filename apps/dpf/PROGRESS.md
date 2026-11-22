# DPF Status progress

## v0.1.56 — Notification Tool integration candidate (2026-11-22)

- Replace DPF-owned cluster socket and canvas drawing with shared Notification Tool calls.
- Preserve B57 regeneration events: Requested, Started, In Progress, Finished; original blinking/repeat cadence, locale translation and manual four-step test.
- Preserve vehicle equipment gate 6WB/6U3, B47 safety restrictions, existing UDS readings, and user settings.
- Require bmrmodz-notification >=0.1.1 in addition to Car Equipment >=0.1.5.
- Tool owns a single transient overlay at the existing 745,539 430x76 position; app no longer opens cluster-render.
- Tests: local service mock-renderer passed; DPF state-machine regression is present; GitHub CI pending.
- **Real-car test pending**. Do not label KOMBI display, factory BC restoration, DPF events or installer as verified.
- Known blocker: same underlying panel overlay can suppress original BMW BC screen; this release does not solve that.

## Vehicle test checklist (parked)
1. Install the tool automatically as DPF dependency; check service health.
2. Trigger the four alerts and confirm correct colours, multilingual text, 500ms blink, 3s per state.
3. Check original BC cycling before/during/after notification and after HMI restart.
4. Observe natural B57 regeneration (Requested/Started/In Progress/Finished); verify repeated In Progress once per minute.
5. Confirm no unsupported B47 live regen messages.
