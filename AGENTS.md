# BMRMODZ
## New app previews

At the start of development for each new app, make Info the first tab and the initial screen. Display the following notice verbatim on three lines:

> This application is still in development phase and not ready for public use.
> We still working on it and will be available soon.
> Thank you

## What's New release notes (all apps)

- Update the relevant application's visible **What's New** section for **every new app version**, including bug fixes, UI changes, translations and new features.
- Add the entry in the same change as the version update; use the actual version number and accurately describe user-visible changes.
- Translate each new user-visible release-note string into every language supported by that application, using its existing i18n catalog and keeping key sets aligned.
- Keep older notes readable within the app's existing layout and do not claim unverified vehicle behavior as verified.
- Apply these rules to production/user-facing applications such as Spritmonitor, DPF, OSA, and Climate Comfort.
- **Exception — experimental/test/diagnostic apps:** A visible What's New section and version-specific release-note translations are optional during rapid testing. Keep version numbers and PROGRESS.md accurate; ordinary user-facing strings still require translations into every supported language. This exemption does not apply to production apps.

## Explicit implementation authorization ("priprav")

- The user may send one requirement across multiple consecutive messages because pressing Enter submits the message. Treat these as an evolving specification, not as separate permissions to start implementing.
- Discuss, analyze, inspect source code, and collect requested changes normally. **Do not edit, commit, push, open implementation PRs, merge, or prepare a new release** merely because the user described a change, said "we will do this", or sent another part of the specification.
- Wait for the user's explicit **"priprav"** command before executing the accumulated implementation request. "Priprav" means **perform the authorized implementation now**, including relevant tests, versioning, `PROGRESS.md` updates and GitHub integration as appropriate; it does **not** mean merely drafting a plan or asking for the same authorization again.
- Changes arriving during an already authorized implementation update that implementation's scope; incorporate them before finalizing if feasible.
- Never silently implement old, unapproved, cancelled, or explicitly deferred requests. Only work on the changes the user currently authorizes.
- State accurately what was changed on a development branch, merged to `main`, CI-tested, and actually verified in a vehicle. Do not claim completion on `main` while the change exists only on another branch.

## Development workflow: local UI vs GitHub

- Use the local repository for UI-only development and preview: layout, colours, typography, labels, icons, and visual polish. Iterate and run available local checks without committing or pushing after every small change.
- Use the GitHub repository for non-visual work: application logic, diagnostics, vehicle data decoding, shared tools, integrations, bug fixes, and new functional features. Work in a branch, run relevant checks, and use a pull request for review and integration.
- When a UI change requires validation on the real MGU in the car, batch related local changes into a testable revision and then push it to GitHub for MGU Store deployment. Do not claim that local previews replace in-car verification.
- Avoid unnecessary repeated repository-wide analysis and Git operations solely for visual iterations. Never discard uncommitted local changes; coordinate when a change touches both UI and application logic.

## UI text and translation consistency

- Every new or changed user-visible string (labels, buttons, settings, status messages, notifications, hints, dialogs, and About text) must be translated consistently into **every language supported by the affected app**, in the same change.
- Use each app's existing i18n/translation mechanism and keys; do not introduce new English-only hard-coded UI text.
- When changing wording or introducing a translation key, update all language files and keep the key sets aligned. Preserve placeholders, variables, formatting, and meaningful technical identifiers (e.g. DPF, 6WB, 6U3) across languages.
- Before completing or pushing a UI/text change, run existing translation coverage/consistency checks where available and fix missing keys or untranslated new text. If no automated check exists, manually verify all supported languages.

## Shared project state for ChatGPT and Codex

- GitHub is the shared source of truth for code and documented project state. ChatGPT and Codex conversation histories are **not** synchronized; never assume either assistant has read the other's chats.
- Before working on an app, read this AGENTS.md, the app's `app.json`, its `PROGRESS.md`, and the relevant source files. Check the current repository state rather than relying only on chat history.
- Maintain `apps/<app>/PROGRESS.md` for each app. After a meaningful implementation, bug fix, in-car test result, or approved change of direction, update that file **in the same branch/PR as the code change**. Purely cosmetic micro-iterations may be grouped and recorded once when ready.
- In PROGRESS.md distinguish: **implemented** (present in source), **automated-tested** (checks passed), **in-car verified** (explicit real-car confirmation), **in progress**, **known issues**, and **approved next steps**. Do not equate CI passing or a merged PR with verification in the car.
- Record concrete version, relevant commit/PR references, test outcomes, and unresolved questions when known. Do not invent features, test results, vehicle readings, or approvals. Mark unknowns as unverified.
- Treat PROGRESS.md as a concise handoff, not a transcript. Do not copy secrets, VINs, personal data, or raw conversation histories into it. Keep notes in English for cross-tool consistency.
- At the beginning of a new ChatGPT or Codex session, read the latest PROGRESS.md and AGENTS.md. At the end, summarize changes and update PROGRESS.md if the project state changed. If a proposed change has not been approved, record it as a proposal, not an approved task.
