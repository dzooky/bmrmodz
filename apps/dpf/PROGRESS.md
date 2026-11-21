# DPF Status — Progress

## Settings UI (2026-11-21)

- Implemented on `fix/dpf-settings-actions-20261121`: Main Settings **Done** button moved from top right to bottom right while nested choice **Back** remains at top.
- Implemented: **Reload car equipment** action with **Perform** button.
- Implemented: **Show notification message** action with **Proceed** button; existing test behavior (four regeneration alert states) remains unchanged.
- Implemented: auxiliary action-status text is hidden from these two rows; internal logging and status handling are retained.
- Settings layout change is opt-in via `bottomDone` to avoid changing unrelated applications.

## Verification

- Source-level changes: completed.
- CI/automated tests: not run/verified.
- BMW MGU iDrive 7 in-car verification: not performed.
