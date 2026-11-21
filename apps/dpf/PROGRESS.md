# DPF Status — Progress

## Current baseline
- Manifest version: `0.1.55` (check `app.json` for latest version)
- Scope: Read-only DPF monitoring for B57/B47, including soot, ash and regeneration distance gauges.
- Source of truth: current code and merged GitHub history; this note is a handoff, not a substitute for inspection.

## Implemented
- Read-only DPF monitoring for B57/B47, including soot, ash and regeneration distance gauges.

## Automated-tested
- Not independently revalidated for this handoff. Consult relevant CI runs for specific commits.

## In-car verified / reported
- 6WB or 6U3 equipment check implemented for cluster settings; real-car behavior of automatic notifications remains unverified.

## In progress and known issues
- DPF Detail right-column tiny text fix is proposed in PR #32, not yet merged or verified in car.

## Approved next steps
- No additional feature work is authorized by this document. Follow explicit user instructions and update this section when a next step is approved.

## Handoff rules
- After meaningful changes, update the version, implementation status, CI result, actual in-car verification, open issues, and approved next steps.
- Do not mark a feature verified solely because it was implemented or CI passed.
- Keep the note concise, factual, and free of private vehicle identifiers or credentials.
