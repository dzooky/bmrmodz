# BMRMODZ
## New app previews

At the start of development for each new app, make Info the first tab and the initial screen. Display the following notice verbatim on three lines:

> This application is still in development phase and not ready for public use.
> We still working on it and will be available soon.
> Thank you

## SP release notes

Keep the What’s New section in Spritmonitor’s About tab up to date as user-visible changes are implemented. Assign entries to the corresponding version when preparing a release. Write entries in English.

## Development workflow: local UI vs GitHub

- Use the local repository for UI-only development and preview: layout, colours, typography, labels, icons, and visual polish. Iterate and run available local checks without committing or pushing after every small change.
- Use the GitHub repository for non-visual work: application logic, diagnostics, vehicle data decoding, shared tools, integrations, bug fixes, and new functional features. Work in a branch, run relevant checks, and use a pull request for review and integration.
- When a UI change requires validation on the real MGU in the car, batch related local changes into a testable revision and then push it to GitHub for MGU Store deployment. Do not claim that local previews replace in-car verification.
- Avoid unnecessary repeated repository-wide analysis and Git operations solely for visual iterations. Never discard uncommitted local changes; coordinate when a change touches both UI and application logic.
