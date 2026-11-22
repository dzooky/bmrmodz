# Notification Tool progress

## v0.2.0 — DPF integration candidate (2026-11-22)

- Implemented local Unix socket service that controls one temporary cluster-render panel overlay.
- Fixed placement at x=745, y=539, 430x76 pixels (same as existing OSA/DPF).
- Shared kit/runtime/notification-tool.js client supports 1–8 colored text segments; apps choose localized texts, colors, duration, blink interval, repetitions and spacing.
- Timing, blink, repeat and cleanup belong to the tool. Frame rasterization uses the common app-kit Canvas font atlas, not DPF-specific drawing.
- DPF v0.1.56 sends regeneration events through the tool; original four state transitions, timers, manual test and translation calls are preserved.
- MGU Store manifest and systemd service added. Dependency required by DPF.
- **Implementation only**. GitHub CI pending; MGU installation and in-car visibility NOT VERIFIED.
- **Safety**: uses existing cluster-render panel overlay, which may suppress factory BC content. No verified OEM slot restoration. Do not use in traffic before parked validation. No HUD support.

## Next
1. CI: test notification API, state transitions, tool installation and DPF dependency.
2. Parked car: verify DPF test sequence, localization, automatic regeneration events, BC button before/during/after notifications.
3. Investigate BC-safe rendering before general deployment and HUD independently.
