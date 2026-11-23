# DPF Status progress

## v0.1.70 — separate transport read diagnostics (2026-11-23)
- **In-car report (v0.1.69):** with experimental Data Tool enabled, TASU connection `Ready`, Data Tool connection `Responding` (status only), DDE identification `No response`, last DID `0xF150`, last issue `DDE did not respond`. This **does not** prove the Tool diagnostic read succeeds, and does not identify the underlying failure.
- **Implemented:** preserve each existing Data Tool `read` attempt result and last categorized error separately from the subsequent legacy TASU fallback. Show `Data Tool read`, `Data Tool error`, `TASU read`, `TASU error`, identification and last DID on the existing Diagnostics tab. Display stable technical error codes (e.g. `NO_MATCHING_RESPONSE`, `UDS_NRC_31`, `SOCKET_ENOENT`, `TOOL_TIMEOUT`, `INVALID_RESPONSE`) rather than adding ECU requests. `Not checked` explicitly indicates a path not attempted.
- **No behavioral migration:** unchanged DDE DID profiles, timings, legacy fallback and default-OFF experimental setting. Tool status availability must not be mistaken for successful ECU reads.
- **Translations and notes:** five user-facing labels/release-note strings across 21 non-English locales; About What's New bumped to 0.1.70.
- **Verification:** code and mock tests prepared; CI and real-car behavior must be recorded separately. In-car verification pending.


## v0.1.69 — in-app connection diagnostics (2026-11-23)
- **Vehicle report:** after installing DPF 0.1.68, user reported no DPF readings even when `Use Data Tool (experimental)` was OFF. Root cause remains unknown; this is not evidence that Data Tool or TASU is specifically at fault.
- **Implemented:** fifth `Diagnostics` tab in the existing canvas with TASU availability, passive Data Tool `status` socket check, selected transport, DDE F150 identification status/index, last DDE read, last DID and categorised last failure. Tool probe sends **only** `{op:'status'}`, no ECU read; ordinary poll cadence and read-only DPF protocol are unchanged. Live legacy and tool read outcomes are observed, not duplicated.
- **Translations:** 29 new diagnostic screen/status/release-note strings added across all 21 non-English locale catalogs; release note `0.1.69 — Built-in DPF connection diagnostics` visible in About.
- **Automated:** status socket mock and legacy outcome test, DPF translation completeness and existing DPF CI. New screen and failure classification **not verified in car** until user installs v0.1.69 and shares the Diagnostics tab contents.


## v0.1.68 — Data Tool dependency declared (2026-11-23)
- **Implemented:** declare `bmrmodz-data-tool >=0.1.8` in DPF's app manifest so MGU Store resolves the experimental service dependency when updating DPF. Existing `experimentalDataTool` setting remains OFF by default; legacy TASU reading is preserved.
- **Release note:** add visible What's New entry and translate into all 21 non-English DPF locales. No changes to vehicle decoding or timing.
- **Testing:** manifest and release-note regression through CI; new vehicle version and tool installation are pending direct user confirmation. Requiring the Data Tool can block DPF installation if tool health fails; this is a test-stage change, not a production guarantee.


## v0.1.67 — experimental Data Tool transport (2026-11-23)
- **Implemented on PR #48 development branch only:** a default-OFF `Use Data Tool (experimental)` boolean setting. When enabled, DPF sends allowlisted DDE 0x22 reads through the local Data Tool socket, checking positive response echo and byte structure. When unavailable, timed out, or malformed, it falls back to the unchanged legacy ReadOnlyDiag/TASU request for that read. The setting is evaluated at each read and is reversible without removing legacy support.
- **No source-of-truth migration:** default remains legacy; existing B57/B47 profile decoding, calibration, regeneration notification logic, equipment behavior and polling cadence remain unchanged. No automatic retry storm beyond existing DPF polling, no ECU writes, and no changes to OSA/CC.
- **Translation:** new setting and release note translated across all 21 non-English catalogs; English comes from the original text. Added standalone mocked transport regression and DPF CI wiring. CI pending, in-car behavior **not verified**.
- **Security caveat:** Data Tool v0.1.7 production package identity verification is NOT implemented, socket access is permissive in the feasibility build. Use only for parked testing; no authorization GO or general migration approval.


## v0.1.66 — Prevent accumulated Recorder text auto-fit (2026-11-22)

- **In-car user report:** selected `English (auto)` in the collapsed DPF Settings row remains visually too small through v0.1.65. OSA renders this correctly; the full DPF language picker works correctly.
- **Confirmed root cause in code:** `Display.canvas()` reuses `Recorder` instances and `Recorder.reset()` does not remove overridden instance methods. DPF `render()` reassigned `cv.text` on each non-Settings frame, recursively stacking auto-fit wrappers. Rendering Settings first did not undo those wrappers.
- **Implemented:** `delete cv.text` immediately after obtaining the Recorder on every render to restore its prototype method before Settings or the single DPF non-Settings fit wrapper. Keeps Overview, Detail and About fit rules; no changes to the OSA language module, 32 px selected-language size or 28 px language-picker size.
- **Regression:** new source-backed renderer test simulates multiple Overview renders and tab switches to Settings using the same Recorder, asserting the fit factor stays stable across frames and Settings draws `English (auto)` at the native 32 px.
- **Release notes:** 0.1.66 What's New translated across all 21 non-English catalogs. Version assertions updated.
- **Automated CI:** pending when authored. **In-car verification:** pending. Do not claim visual resolution until tested on MGU.
- No changes to DDE readings, regeneration state logic, notification tool or unrelated apps.


## v0.1.65 — Direct OSA language controller reuse (2026-11-22)

- **In-car user report:** DPF v0.1.64 still shows a too-small selected English value on the main Settings page, despite the prior option-parity and font changes. The language picker and other languages are legible.
- **Implemented:** replaced DPF's complete hand-written language/update/watch implementation with an `apps/dpf/language.js` copy of the working OSA controller. Only the translation catalog, DPF native button list, log prefix and string-bundle ID prefix differ.
- The DPF page continues to use the same shared Settings canvas as OSA. No new font-size workaround was added.
- **Implemented:** v0.1.65 English What's New entry, plus translations for each of the 21 non-English DPF locale catalogs.
- **Automated verification:** tests compare the complete language controller against the OSA implementation after the four DPF-specific substitutions, check no former inline logic remains, and retain 32px Settings / 28px picker text checks. CI pending at time of writing.
- **In-car verification:** pending for v0.1.65. Do not claim the English typography is fixed until a real-MGU test confirms it.
- No changes to DDE diagnostics, regeneration logic, notification transport, or other layouts.


## v0.1.64 — OSA-style language configuration (2026-11-22)

- **User report:** the selected English language value in DPF's main Settings remained too small through the v0.1.63 revision. The full language picker and other language values were reported legible.
- **Implemented:** DPF now mirrors OSA's language model: base `['en','English']` choice in `app.json`, dynamic `(auto)` suffix for detected iDrive language, and replacement of options on refresh. The old `['auto','English (auto)']` base value and special `englishAutoValueSize` workaround were removed.
- **Implemented:** shared Settings typography is back to the uniform 32 px for selected languages; picker remains unchanged.
- **Implemented:** visible v0.1.64 What's New note and matching translations across 21 non-English catalogs.
- **Regression tests:** cover DPF/OSA language option parity, English auto text size in Settings, other language sizes, and translation coverage.
- **Automated CI:** pending. **In-car verification:** pending. Previous vehicle report applies to v0.1.63, not 0.1.64.
- No changes to DDE diagnostics, DPF regeneration logic, Notification Tool, or other screens.


## v0.1.63 — Main Settings English auto readability (2026-11-22)

- **Reported in car** on v0.1.62: only the selected `English (auto)` value on the *main* Settings screen appears too small; English in the opened language list and all other selected languages look normal.
- **Implemented:** DPF-only opt-in `englishAutoValueSize: 38` for this collapsed value. The shared sheet uses this only for the exact `English (auto)` string; the other collapsed languages remain 32 px, the opened language list remains 28 px, and unrelated apps are unchanged.
- **Implemented:** visible About/What's New entries for v0.1.61, v0.1.62 and v0.1.63, with all three new entries translated in all 21 non-English DPF catalogs.
- **Implemented:** project-wide AGENTS.md rule requiring translated What's New on every new app version.
- **Automated tests:** expanded DPF translation tests to check 0.1.61-0.1.63 release-note coverage and recorder text-call sizes for English auto, another language and the opened picker. CI status: pending at writing.
- **Vehicle verification:** new 0.1.63 typography still unverified in car; all diagnostic/regeneration/notification behavior unchanged.


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
