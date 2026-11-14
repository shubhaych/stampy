# OWNERS

Static map of feature slug → machine → owned paths (master prompt 5.1 plus 0.5). `scripts/check-ownership.ts` parses the table below, so keep its format: one row per slug, paths in backticks, comma-separated.

A = Face (everything people see). B = Brain (data, rules, roles, voice, db).

| Feature slug | Machine | Owned paths |
|---|---|---|
| `home` | A | `web/app/(site)/**`, `web/components/home/**`, `web/styles/home.css`, `web/public/images/home/**`, `data/sources.json` |
| `web-core` | A | `web/components/ui/**`, `web/lib/**`, `web/styles/ui.css`, `web/app/globals.css`, `web/app/not-found.tsx`, `web/next.config.ts`, `web/postcss.config.mjs`, `web/tsconfig.json`, `web/public/*` |
| `demo-shell` | A | `web/app/demo/**`, `web/components/demo/**`, `web/styles/demo.css`, `data/states.json` |
| `case-workspace` | A | `web/app/case/**`, `web/components/case/**`, `web/styles/case.css` |
| `pipeline-ui` | A | `web/components/pipeline/**`, `web/styles/pipeline.css` |
| `resolve-ui` | A | `web/components/resolve/**`, `web/app/upload/**`, `web/styles/resolve.css` |
| `voice-ui` | A | `web/components/voice/**`, `web/app/voice/**`, `web/styles/voice.css` |
| `dashboard-ui` | A | `web/app/dashboard/**`, `web/components/dashboard/**`, `web/styles/dashboard.css` |
| `system-page` | A | `web/app/system/**`, `web/components/system/**`, `web/styles/system.css` |
| `rules` | B | `packages/snap-rules/**` |
| `qc-data` | B | `data/qc/**`, `db/migrations/qc/**`, `data/golden/**`, `worker/src/features/qc/**`, `worker/src/features/docgen/**`, `worker/fixtures/qc/**`, `worker/fixtures/docgen/**`, `scripts/qc-*.ts` |
| `seats` | B | `worker/src/features/seats/**`, `worker/src/features/recompute/**`, `worker/fixtures/seats/**`, `worker/fixtures/recompute/**` |
| `policy` | B | `worker/src/features/policy/**`, `worker/fixtures/policy/**`, `data/policy/**`, `scripts/policy-*.ts` |
| `voice-engine` | B | `worker/src/features/voice/**`, `worker/fixtures/voice/**`, `db/migrations/voice/**` |
| `ledger` | B | `worker/src/features/ledger/**`, `worker/fixtures/ledger/**`, `db/migrations/ledger/**` |
| `planner` | B | `worker/src/features/planner/**`, `db/migrations/planner/**`, `worker/fixtures/planner/**` |
| `db-core` | B | `db/migrate.ts`, `db/migrations/cases/**`, `db/migrations/flags/**`, `db/migrations/workflow/**`, `worker/src/core/**`, `worker/src/*.ts`, `worker/src/features/types.ts`, `worker/src/features/_template/**`, `worker/test/core/**` |
| `eval` | B | `worker/src/features/eval/**`, `worker/fixtures/eval/**` |
| `ops` | B | `scripts/**`, `.github/**`, `e2e/smoke*`, `env/ops.env`, `playwright.config.ts`, `vitest.config.ts`, `eslint.config.js`, `docs/ARCHITECTURE.md`, `docs/LIVE_CHECKLIST.md`, `docs/REAL_VS_SIMULATED.md` |

`scripts/qc-*` and `scripts/policy-*` belong to `qc-data` and `policy` (the more specific row wins).

## Always allowed on any branch
- the branch's own `.features/<slug>.md`
- `status/<machine>.md` for your machine
- `e2e/<slug>/**`, `env/<slug>.env`, `docs/<slug>.md`
- `worker/test/<slug>/**` (feature unit tests)
- your own gate rows in `PROGRESS.md` (evidence only)

## Frozen hot files (after `scaffold-v1`; `infra/` or `contract/` PR only, under 150 lines)
`packages/contracts/**`, `db/migrate.ts`, `worker/src/features/index.ts`, `web/app/layout.tsx`, `web/styles/tokens.css`, every `package.json`, `package-lock.json`, `.env.example`, `.npmrc`.

## Transfers
Ownership moves only through a claim file: the new owner lists the paths in `owns` and adds `transferred_from: <slug>`.
