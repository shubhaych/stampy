# Stampy

A document-grounded second check before SNAP benefits go out. AI roles read the case file and flag what does not match, with the source line and the rule; a deterministic engine recomputes; a voice agent verifies with employers and landlords; **a merit-staff worker decides everything.** Not an eligibility system.

Spec: [docs/MASTER_PROMPT.md](docs/MASTER_PROMPT.md). Agent rules: [AGENTS.md](AGENTS.md). Who owns what: [OWNERS.md](OWNERS.md). Gates: [PROGRESS.md](PROGRESS.md).

## Quick start (zero keys)

```bash
nvm use            # Node 22+
npm install
cp .env.example .env.local   # set MACHINE=a|b and SLOT=0..9
npm run db:build   # per-machine SQLite (golden cases until the QC file is ingested)
npm run dev        # web http://localhost:3000+SLOT, worker http://localhost:8787+SLOT
```

Everything runs in fixture mode with no keys. `npm run env:check` shows what is live.

## Layout

| Path | What |
|---|---|
| `packages/contracts` | zod schemas + golden fixtures. The only shared types. Frozen after `scaffold-v1`. |
| `packages/snap-rules` | Pure TS: ten stations, frequency conversion, budget, gate. |
| `db/` | `migrate.ts` + `migrations/<feature>/NNN_name.sql` (each feature owns its folder). |
| `worker/` | Hono on Node: REST + SSE, `core/` (authz, audit, control, truth), one folder per feature. Only process that opens the DB. |
| `web/` | Next.js 16 App Router. Talks to the worker through `web/lib/data` only. |
| `scripts/` | sync, checks, feature claims, env, db, hello-* smoke scripts. |
| `e2e/` | Playwright smoke (every route, footer, badges). |

## Two machines

```bash
npm run feature:start -- a home     # branch a/home, worktree ../cleancase-wt/a-home, claim file pushed
npm run feature:list                # who is doing what
npm run sync                        # before work and before every push
npm run check                       # typecheck, tests, check:rules, check:badges, check:ownership
```
