## v0.2.63 — Reliable oil warm-up notification trigger (2026-11-22)

- Trigger the oil warm-up notification immediately when OSA first observes live oil at or above the configured target; preserve 2 °C re-arm hysteresis.
- Track threshold detection independently of notification output availability and preserve the pending event until Notification Tool accepts it or the delivery attempt budget is exhausted.
- Remove the redundant 6WB/6U3 gate from the automatic send condition only; vehicle equipment detection and Settings visibility stay unchanged.
- Retry both returned errors and thrown failures, up to five total attempts spaced 500 ms apart. Log attempts and exhausted deliveries; avoid duplicate in-flight sends.
- Keep manual preview and shared Notification Tool rendering unchanged. Tool acceptance does not prove physical KOMBI display.
- Automated checks: pending. In-car verification: pending.

# Oil Service Assistant progress

## v0.2.62 — Notification text translations (2026-11-22)

- Added complete translations across all 21 non-English OSA catalogs for the new `Show notification message` setting, its `Run` action and the 0.2.60/0.2.61 About release-note strings.
- Existing oil-warm-up message translations, behavior, UI layout and notification routing are unchanged.
- Added regression assertions for translation key presence, nonempty localized values, and language coverage.
- Automated checks: GitHub Actions OSA Notification Tool migration, OSA Car Equipment integration and MGU Store dependency manifests passed on PR #40; in-car verification: not yet reported for 0.2.62.


## v0.2.61 — Manual notification preview button (2026-11-22)

- Changed the Settings `clusterBcTest` notification preview from a boolean toggle to an `action` button.
- User-visible label: `Show notification message`; button label: `Run`.
- Registered a direct `onAction` handler; preview still works without live oil temperature or engine identification and uses shared Notification Tool 0.1.1.
- Updated About release note and regression assertions. All automatic warm-up alert behavior stays unchanged.
- **In-car verification pending** for the new button; CI pending.


## v0.2.60 — Shared KOMBI notification service (2026-11-22)

- Migrated oil warm-up notification to shared `bmrmodz-notification` 0.1.1; no OSA-owned cluster-render socket, rasterizer or overlay lifecycle.
- OSA determines when the configured oil temperature is first reached and provides localized text, target temperature and original white/amber colors; Notification Tool renders the 4-second message.
- Manual notification preview is independent of oil temperature and engine/DDE identification; preview remains available as the single `clusterBcTest` settings control, renamed `Test cluster notification`.
- Removed `clusterLowerTest` and `clusterPassiveTest` settings and obsolete cluster observer. Removed former renderer implementation `turbo-icon-preview.js`.
- Automatic warm-up message is sent only on transition, with notification enabled, valid live oil data and 6WB/6U3 equipment gate. The connection to cluster renderer no longer delays the first threshold event; tool send errors are logged and temporary busy responses retried.
- OSA 0.2.60 retains engine, coolant, transmission, history and language features.
- **Real-car report (prior 0.2.57):** manual test worked, automatic warm-up message was absent, slower cluster output versus DPF Notification Tool. New behavior is code/CI validation only until tested in car.
- Vehicle tests: manual preview from Settings, cold-oil threshold crossing at configured limit, no duplicate after target reached, proper re-arm after cooling, translation and settings visibility, notification preference disabled, BC restoration.
