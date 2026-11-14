---
slug: stampy-ui
machine: a
owns: ["web/components/stampy/**", "web/lib/stampy/**", "web/app/cases/**", "web/styles/stampy.css", "web/components/ui/deck-page.tsx", "web/styles/qc.css", "worker/src/qc/**", "worker/test/qc/**", "scripts/qc-ingest.ts", "data/qc/**", "worker/src/app.ts", "worker/src/email/templates.ts", "worker/test/stampy-ui/**"]
reads: ["packages/contracts/**", "worker/**"]
transferred_from: stampy-loop
touches_module: false
needs_deps: []
status: claimed
---
## Notes
User explicitly selected origin/b/stampy-loop as the integration base. Isolated at /Users/shubhaychoubey/Documents/GitHub/stampy-wt/a-stampy-ui; original checkout preserved. Only the frontend paths above are claimed for this integration.
## Needs from the other machine
- Preserve human approval of each outreach and accepted-fact-only recomputation in the application backend; the current branch has automatic checklists and no fact acceptance endpoint.
- Postgres application worker and PolicyEngine service require runtime setup; the read-only public QC worker runs independently on 8791.

User authorized QC ingestion and evidence-desk rebuild on 2026-11-14. These additional paths are claimed for this task; worker app change is only QC route registration. Source projection excludes QC income/error/truth fields.
