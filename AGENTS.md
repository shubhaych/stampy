# Stampy: agent rules (read before every session)

Stampy is a document-grounded second check before SNAP benefits go out. AI roles (Claude) read the case file and flag what does not match, with the exact source line and the rule it breaks. A deterministic engine (`packages/snap-rules`) recomputes the benefit. A voice agent verifies with employers and landlords. **A merit-staff worker decides everything.** Full spec: `docs/MASTER_PROMPT.md` (section 0 overrides the rest).

Pitch: not "AI catches fraud". Agency-caused income and deduction errors are most error dollars, about 45% are visible in the case file. A second check before issuance, with proof, in both directions. FY2027 (sampled now) sets each state's FY2030 cost share.

Stack: Node 22, TS strict, npm workspaces, SQLite (`better-sqlite3`, only the worker opens it), Hono worker with REST + SSE, Next.js 16 web (read `node_modules/next/dist/docs/` first: async `params`, `proxy` not `middleware`, no `next lint`). Integrations: Anthropic (all roles), Moss (policy retrieval), Deepgram (voice, Anthropic think model), PolicyEngine-US (optional cross-check). Manaspace/Manus only if needed and only after the human confirms the product.

## Hard rules (enforced by `npm run check:rules` and tests)

**Legal and product honesty**
1. Stampy never decides. Only merit staff certify (7 CFR 272.4). AI output is a flag, a citation, a question, or a draft. Nothing the AI produces writes to the case file without a human accept click. "Decision" in UI belongs to the worker.
2. Never deny on thin evidence. Unsure means ask for evidence, ask a question, or send to a person. No code path produces an automatic denial or correction.
3. Both directions. Overissuance (amber, ↑ over) and underissuance (blue, ↓ under) get the same weight and urgency.
4. Never say or imply: detects fraud, determines eligibility, reduces error rate by X%, FNA-approved, FedRAMP/StateRAMP/Pub 1075, uses credit data, integrated with any state system, projected PER equals official PER. Banned UI words: `fraud`, `scam`, `deny`, `denied`, `denial`, `auto-approve`, `auto-correct`, `guarantee`, `FNA-approved`, `compliant with Pub 1075` (allow-list: quoted titles in `data/sources.json`).
5. No credit-bureau identity data (CRS).
6. Document, photo and voice findings say "internally consistent with the record, not proof of authenticity."
7. Never invent numbers, URLs, IDs, scores or policy text. Unknown = `<fill in>` in code, "not loaded" on screen. Policy text shown must come from `data/policy/` (fetched, with `source`, `section`, `url`, `retrieved_at`). CFR cites marked *(verify)* stay `verified:false` in `data/policy/citations.json` until checked on eCFR.

**Data honesty**
8. Every number on screen has a badge: Live, Replay, Synthetic, Fixture, Sandbox. A hard-coded number is never Live. `check:badges` enforces it.
9. Synthetic documents come from QC-verified values: replay "catches" demonstrate the pipeline, not detection rates. Say so in the debrief and dashboard.
10. Footer on every page (verbatim): "Synthetic documents generated from public USDA QC records. No real applicants. Stampy flags and cites; a merit-staff worker decides. Not an eligibility system."
11. Voice calls open with AI disclosure, purpose, and a human-callback offer. Simulated, or only to `VOICE_ALLOWED_NUMBERS`. Household consent recorded before the call button enables. Minimum disclosure.

**Engineering**
12. Keys stay server-side. No `DEEPGRAM_API_KEY`, `ANTHROPIC_API_KEY`, `MOSS_PROJECT_KEY`, `MANUS_API_KEY` in `web/`.
13. Never stop for a missing key. Every integration is `fixture | live`, default fixture; the app runs with zero keys. Log `UNVERIFIED-LIVE: <service>: <command>` in `PROGRESS.md` and `docs/LIVE_CHECKLIST.md`.
14. No self-starting loops. `AI_DAILY_RUN_LIMIT`, `VOICE_DAILY_CALL_LIMIT`, outreach caps enforced in the worker service layer.
15. `case_truth` (QC-verified values) is server-only, read only via `worker/src/core/truth.ts`, never in a REST response or SSE stream, never sent to an agent, never rendered before debrief. Tested.
16. Detectors use behavior and documents only. Region and agency are never evidence.

## The core loop (section 0.3)
Documents / data matches / case budget → **evidence ledger** (`fact`, append-only) → deterministic **conflict detector** opens an **open question** with dollars at stake → **resolution planner** (Claude) ranks the cheapest channel (re-check file, text household, employer email, employer call, interview) → **worker approves each outreach** (nothing sent automatically) → replies land as facts on the question → **rules engine** recomputes from accepted facts only → **caseworker approves or rejects**.

## Two-machine protocol
- **Machine A = Face** (everything in `web/`). **Machine B = Brain** (data, rules, roles, voice, db). See `OWNERS.md` for owned paths.
- **Nobody edits a file the other machine might edit.** Work only inside your claim file's `owns`.
- Start a feature: `npm run feature:start -- <a|b> <slug>` (branch `<machine>/<slug>`, worktree in `../stampy-wt/`, claim file `.features/<slug>.md`, pushed immediately). See who is doing what: `npm run feature:list`.
- **Frozen hot files** after tag `scaffold-v1` (change only via an `infra/` or `contract/` PR under 150 lines, acked by the other machine, merged within 30 min): `packages/contracts/**`, `db/migrate.ts`, `worker/src/features/index.ts`, `web/app/layout.tsx`, `web/styles/tokens.css`, every `package.json`, `package-lock.json`, `.env.example`.
- `.env.example` is generated: edit only `env/<slug>.env`, then `npm run env:build`.
- CSS: `web/app/globals.css` is tokens and base only; each feature has its own `web/styles/<feature>.css`.
- Migrations: `db/migrations/<feature>/NNN_name.sql`, each feature owns its folder.
- Contract changes are logged as one file each in `packages/contracts/changes/<yyyymmdd-hhmm>-<slug>.md`. Status goes in your own `status/<machine>.md` only.
- Build against `packages/contracts` and fixtures, never against the other machine. `NEXT_PUBLIC_DATA=fixture` makes web read `packages/contracts/fixtures`. Never import across feature folders; share only via `packages/contracts` and `packages/snap-rules`.
- Runtime: `.env.local` sets `MACHINE` and `SLOT`; ports are `3000+SLOT` (web) and `8787+SLOT` (worker). Each machine builds its own `data/db/stampy.db` with `npm run db:build`.

## Commands
- `npm run sync` before starting and before every push (fetch, rebase on main, install, migrate, env:build, check).
- `npm run check` = typecheck + unit tests + `check:rules` + `check:badges` + `check:ownership`. Must be green before a commit.
- `npm run dev` starts worker and web on your slot's ports.
- Git: trunk-based, short branches (<3 h), rebase not merge, squash-merge PRs under 400 lines, never force-push `main`. New deps: tiny `infra/deps-<name>` PR merged first. One-line commit messages, commit after each step.
- `PROGRESS.md` gates are ticked only with evidence (test name, screenshot path, command output).
