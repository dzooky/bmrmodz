# DPF Status progress

## v0.1.62 — English language size and Run translation (2026-11-22)

- In-car user report for v0.1.61: only the selected `English (auto)` language value in Settings remains too small; other languages appear correct.
- Implemented: render the Settings page before installing DPF-only global text auto-fitting, matching OSA's shared Settings canvas path. This prevents `English (auto)` from being scaled down due to right-edge width calculations, while leaving all other DPF pages and their fitting logic untouched.
- Implemented: add the missing `Run` action-button translation in all 21 non-English DPF catalogs, directly reusing the corresponding OSA catalog values. English stays `Run`.
- Added regression coverage for the English auto label and unscaled Settings rendering, and `Run` translation coverage.
- Bumped app version to 0.1.62 and updated version assertions in two CI workflows.
- Automated CI: pending. In-car confirmation for 0.1.62: pending. Existing DPF notification and diagnostic logic unchanged.


## v0.1.61 — DPF locale coverage and typography (2026-11-22)

- Implemented: added 19 previously missing user-visible translation keys to each of 21 non-English locales (399 localized strings), covering B47 Detail guidance, average-regeneration text, historical release notes, and equipment reload status/action messages.
- Implemented: B47 Detail guidance now uses normal translation lookup rather than literal rendering.
- Implemented: right-column Detail measurements retain their normal 35 px nominal size (up to 700 px measured width) instead of shrinking to fit the distance to the right canvas edge.
- Implemented: selected language in shared Settings list uses 32 px instead of 26 px; other setting values retain 26 px.
- Added translation/typography regression test `apps/dpf/translations.test.js`.
- Version bumped from 0.1.60 to 0.1.61. Preserve Notification Tool 0.1.1 and the DPF 0.1.60 timing changes.
- Translation source audit: 21/21 non-English catalogs contain 87 aligned, nonempty entries; no untranslated identical long English strings detected.
- Automated test execution/CI: pending after PR creation. In-car typography and translation verification: pending.
- NOTE: PR #31 and #32 contain older parallel font fixes; this revision implements equivalent changes on current main. Avoid merging the old PRs without conflict review.


## v0.1.60 — Shorter In Progress notification (2026-11-22)

- Changed **only** the `In Progress` message to two blinks, each 333 ms ON / 333 ms OFF (1,332 ms total).
- Preserve the 60-second live regeneration reminder cadence and all other message timing at 500 ms ON/OFF for three seconds.
- Manual demonstration now advances to `Finished` after the shorter `In Progress` segment.
- Notification Tool stays at v0.1.1, no service change.
- Automated state-machine regression tests added; CI pending.
- Vehicle validation pending for new timings; the earlier DPF 0.1.57 preview was confirmed visible in car.


## v0.1.57 — DDE-independent preview and Settings cleanup (2026-11-22)

- User reported in-car: DPF 0.1.56 test showed no notification after Notification Tool 0.1.1 was installed.
- Confirmed application bug: the **manual preview button** required `profile.regeneration`, even though a visual demo should work with no identified DDE and on B47. Removed that condition from the manual preview, without changing the real-regeneration safety gate.
- Suppress automatic VO-detection status strings such as `6U3: detected` on the Settings reload row; retain hidden VO capability checks and explicit reload errors.
- Catch synchronous notification canvas exceptions and log the exact send/render failure. Accepting a command does not confirm physical display.
- Version 0.1.57; Notification Tool stays 0.1.1. CI and parked vehicle verification pending.


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
