---
slug: qc-data
machine: b
owns: ["data/qc/**", "db/migrations/qc/**", "data/golden/**", "worker/src/features/qc/**", "worker/src/features/docgen/**", "worker/fixtures/qc/**", "worker/fixtures/docgen/**", "scripts/qc-*.ts"]
reads: ["packages/contracts/**"]
touches_module: false
needs_deps: []
status: claimed        # claimed | in-review | merged
---
## Needs from the other machine
## Notes
