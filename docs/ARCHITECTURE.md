# Architecture

```
browser (web/, Next.js 16)
   │  REST + GET /events (SSE)      web/lib/data: fixture | live, same contract types
   ▼
worker (Hono, Node)  ── the only process that opens SQLite (WAL)
   ├─ core/       authz (roles, segregation of duties), audit (append-only), control (kill switches, daily limits), truth (QC-verified values, debrief only)
   ├─ features/   qc · docgen · ledger · planner · seats · recompute · policy · voice · eval   (each: register(app), status())
   └─ adapters    fixture | live per integration (features/_template/adapter.ts); parse fails closed to needs_human
   ▼
data/db/cleancase.db   qc_history (main table) + app tables, migrations per feature folder
```

## Guarantees and where they are enforced

| Rule | Enforcement |
|---|---|
| Only humans accept, approve, override, certify | `worker/src/core/authz.ts` + tests (`worker/test/core/core.test.ts`) |
| Review by a different identity than the certifier | `authz.assertReview` + `review_segregation` trigger |
| `audit_log`, `fact` append-only | `BEFORE UPDATE/DELETE` triggers |
| Outreach needs approval; calls need consent | `outreach_needs_approval`, `call_needs_consent` triggers |
| Truth never leaves the server before debrief | `core/truth.ts` (locked until certified), SSE bus drops truth keys (`events.ts`), JSON response guard (`app.ts`), tests |
| Daily limits, kill switches | `core/control.ts` (`consume`, `getControl`) |
| Banned words, keys in web, footer | `npm run check:rules` |
| Badges on figures | `npm run check:badges` (static) + `e2e/smoke.spec.ts` (runtime DOM) |
| Ownership | `npm run check:ownership` (pre-commit + CI) |

## Choices still open

- **Moss client package**: `@inferedge/moss` vs `@moss-dev/moss`. The policy feature checks docs.moss.dev and records the choice here.
- **Deepgram event names and Anthropic think-model list**: verify against Deepgram's docs before coding (voice-engine).
- **Manaspace**: not matched to a public product (closest: Manus). Do not build until the human confirms.
- **Anthropic SDK**: `@anthropic-ai/sdk` in `worker/`. Roles use structured output validated by the zod schemas in `packages/contracts/src/seats.ts`.
