---
slug: stampy-ui
machine: a
owns: ["web/components/stampy/**", "web/lib/stampy/**", "web/app/cases/**", "web/styles/stampy.css", "web/components/ui/deck-page.tsx"]
reads: ["packages/contracts/**", "worker/**"]
transferred_from: stampy-loop
touches_module: false
needs_deps: []
status: claimed
---
## Notes
User explicitly selected origin/b/stampy-loop as the integration base. Isolated at /Users/shubhaychoubey/Documents/GitHub/stampy-wt/a-stampy-ui; original checkout preserved. Only the frontend paths above are claimed for this integration.
## Needs from the other machine
- Public QC ingestion, release checksum, dictionary mapping and a provenance-aware replay API are absent. Download attempt returned HTTP 403; do not present sample uploads as public case records.
- Preserve human approval of each outreach and accepted-fact-only recomputation: current pipeline auto-sends checklists and has no fact acceptance endpoint.
- Run the selected Postgres worker on its own port; current 8787 health response belongs to the legacy SQLite scaffold.
