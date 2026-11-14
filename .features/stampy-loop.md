---
slug: stampy-loop
machine: b
owns: ["**"]
reads: ["**"]
touches_module: true
needs_deps: ["pg", "@types/pg"]
rebuild: true
status: claimed        # claimed | in-review | merged
---
## What this branch is
Machine B rebuilds Stampy around the demo loop (applicant upload → Claude reads documents → evidence ledger → open questions → AgentMail request → applicant calls the Vapi number → checklist email → reply with a paystub photo → PolicyEngine recompute → caseworker approves). Postgres replaces SQLite. The product is renamed from CleanCase to Stampy everywhere. Conflicts with machine A's branches are resolved at merge time.

## Needs from the other machine
- Nothing blocking. main (homepage v3 + warm theme) merged in; its @cleancase/* imports renamed to @stampy/*.

## Notes
