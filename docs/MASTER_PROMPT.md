# Stampy master prompt (v2)

> Saved verbatim at scaffold time (Phase 0, step 0). Section 0 overrides anything below that disagrees.
>
> **Rename (2026-11-14):** the product is now called **Stampy** (was CleanCase). The UI, footer line and docs say Stampy; package names are `@stampy/*` and the database is Postgres (branch b/stampy-loop). Palette: the warm light theme in `web/styles/tokens.css` (cream paper, brown ink, burnt-orange brand), replacing the section 7 tokens; no monospace face.

# 0. v2 changes (these override anything below that disagrees)

**0.1 Stack substitutions.** The team's available APIs are now: Anthropic, Moss, and Manaspace *only if needed*. CREAO and SpacetimeDB are gone.

| Was | Now |
|---|---|
| CREAO saved agents ("seats") | **Claude roles.** A seat is now a named role run by the worker through the Anthropic API with a JSON-schema output (tool use or structured output). Same names, same schemas, same fail-closed parsing (section 12). No hosted-agent platform. |
| Manaspace | **Optional adapter, default off, build only if a role cannot be done with Claude + Moss** (for example a long-running browse-and-research task). The name could not be matched to a public product; the closest match found is Manus (`api.manus.ai`, docs at open.manus.ai). Confirm the exact product and docs with the human before writing any code; `MANUS_*` env names below are placeholders. |
| SpacetimeDB | **SQLite** (`better-sqlite3`) as the one database, with the historical QC data as its primary table (0.2). Live updates to the browser by Server-Sent Events from the worker. |
| Moss | Unchanged: policy retrieval. |
| Deepgram | Kept as the voice provider behind a `VoiceProvider` interface. Confirmed available: build the live path; `VOICE_MODE` still defaults to `fixture` so the app runs with no keys. Anthropic stays the think model. |
| PolicyEngine-US | Unchanged: optional cross-check. |

Everywhere below, "CREAO", "reducer", `module/`, `STDB_*`, `module_bindings` and `stdb:*` are replaced by: Claude role, service-layer function, `db/`, `DB_PATH`, nothing (no generated bindings), `db:*`. Where this section and a later section disagree, this section wins; the later sections have been patched to match where practical.

**0.2 The historical data is the main database (confirmed).** The USDA QC public-use data, loaded as table `qc_history`, is the system of record that everything else reads from.
- File: `data/db/stampy.db` (git-ignored, built locally on each machine by `npm run db:build`, deterministic). One row per QC case across every fiscal year available; columns come from the verified `column-map.ts`; both the state-certified and the QC-verified values are stored, plus the error coding. The build prints the row count and it must equal the source file's row count; never pad or fabricate rows. Until the raw file is present, load `data/golden` into the same table with `source='golden'` and badge everything Fixture.
- Everything reads it: the shift queue (a seeded SQL draw), docgen, state profiles (aggregates for the tile map), base rates for the risk view, the dashboard projection, and replay evaluation. App tables (`case_state`, `fact`, `flag`, ...) reference `qc_history.qc_id`.
- `case_truth` (the QC-verified values) is reachable only through `worker/src/core/truth.ts`, which refuses to run before a case's debrief. The web app never opens the database: it talks to the worker (REST for reads and actions, `GET /events` SSE for live updates).
- Migrations: `db/migrations/<feature>/NNN_name.sql`, applied in (feature, number) order by `db/migrate.ts` (frozen). Each feature owns its own migration folder, so two machines never edit the same file. `audit_log` is append-only, enforced by `BEFORE UPDATE` / `BEFORE DELETE` triggers that `RAISE(ABORT)`.
- Per-machine database files; there is no shared database and no publish step. The demo machine runs `npm run db:build` fresh. Roles (`worker`, `supervisor`, and the AI identity) and segregation of duties live in `worker/src/core/authz.ts`, with unit tests: only a human role may accept a flag, answer-attach a fact as accepted, override, or certify; review requires a different supervisor identity than the certifier; the AI identity can only append `fact`, `flag`, `citation`, `agent_run`, `resolution_plan` and drafts.

**0.3 The core backend workflow (the product's main loop; every feature hangs off it).** This is the attached diagram, as a spec.

```
Documents ─┐
Data matches ─┼─► EVIDENCE LEDGER ──(conflict)──► OPEN QUESTION ──► RESOLUTION PLANNER (AI)
Case budget ─┘   every fact keeps source,         "pay frequency?"     picks the cheapest way to close it
                 date and confidence                + dollars at stake        │
                                                          ┌───────────────────┼────────────────────┐
                                                  missing paystub        pay frequency?        who is Daniel?
                                                  TEXT THE HOUSEHOLD     CONTACT THE EMPLOYER  INTERVIEW COPILOT
                                                  (link to upload photo) (call or one-line     (prompts the worker live)
                                                                          email)
                                                          └───────────────────┼────────────────────┘
                                                                  ANSWERS WRITTEN BACK TO THE LEDGER
                                                                  (each reply attaches to the question that asked for it)
                                                                               │  "closed: biweekly, so $2,666 a month"
                                                                          RULES ENGINE recomputes the benefit
                                                                               │  new amount beside the old one
                                                                          CASEWORKER approves or rejects the change
```
Legend (also the pipeline visual's colors): gray = sources and facts, amber = open question, indigo = AI acts, green = ledger and rules, terracotta = human decides.

- **Evidence ledger** (`fact`, append-only): `{id, case_id, field, value, normalized, source_kind: document|data_match|case_budget|household_reply|employer_call|employer_email|interview, source_ref, page, bbox, observed_at, confidence, prov, question_id?}`. Nothing is overwritten; a newer fact supersedes by reference.
- **Conflict detector** (deterministic code, not AI): two facts on the same `field` whose normalized values differ (for example `pay_frequency`: biweekly from the paystub p.1 vs monthly from the case budget) open an `open_question` `{field, fact_ids, dollars_at_stake_monthly, direction, status: open|answered|closed|waived}`. The recompute engine supplies the dollars at stake for every candidate value. Missing mandatory evidence also opens a question. Claude only words the question.
- **Resolution planner** (Claude role with guardrails): input is the open question, dollars at stake, which channels are available and which consents are recorded; output is a ranked list `{channel, why, est_cost, est_time, draft}`. Default cost order, cheapest first: re-check data matches and documents already on file, text the household, one-line employer email, employer call, ask in the interview. Examples: missing paystub → text the household; pay frequency → contact the employer; "who is Daniel?" → interview copilot. **The planner proposes; the worker approves each outreach; nothing is sent automatically.** Collateral contact needs the recorded household consent first. Caps per case and per day.
- **Channels.** *Text the household*: a draft message with a one-time link to `/upload/[token]`, a phone-sized page where the household photographs a document; All household messaging goes through one `Messenger` interface (`MESSAGING_PROVIDER`: `fixture`, `twilio` for SMS and the WhatsApp sandbox, or `whatsapp_cloud`); fixture mode shows the message and opens the link in the demo; live messages only to `SMS_ALLOWED_NUMBERS`. WhatsApp business-initiated messages must use an approved template with the upload link as a variable (free-form replies only inside the 24-hour window after the household answers), so the "text the household" draft is a template fill, not free text. Email goes through an `Emailer` interface (`EMAIL_PROVIDER`: `fixture`, `gmail`, `resend`), live only to `EMAIL_ALLOWED_RECIPIENTS`. *Contact the employer*: either the Voice Verifier call (section 13) or a one-line email draft the worker sends (`EMAIL_PROVIDER=fixture` records it as sent-simulated). *Interview copilot* (P1): a live panel that shows the next question and follow-ups while the worker types or dictates notes; it never answers for the household.
- **Write-back.** Every reply (photo extraction, call fact, email reply, interview note) creates `fact` rows with `question_id` set, moves the question to `answered`, and waits for the worker to accept; accepting closes it. `outreach` rows `{channel, status: draft|approved|sent|replied, to_alias, consent_id}` record what was asked.
- **Recompute and decision.** The rules engine recomputes from accepted facts only. The UI shows the new amount beside the old with the closed question that caused it ("closed: biweekly, so $2,666 a month"). The caseworker approves or rejects the change; only approval touches the case file. Reject keeps the ledger intact.
- Station mapping: the ledger runs under all ten stations. Station 8 becomes **Resolve open questions** (match alerts, planner suggestions, outreach, calls). The voice agent is the employer-call channel, launched from a planner suggestion or manually.

**0.4 The Decision Pipeline: visual proof of how decisions are made.** Component `DecisionPipeline` (`web/components/pipeline/`), shown as a "Pipeline" tab in every case, as a compact replay on the homepage (it replaces the "How one case works" flow-steps in section 8, step 5), and as a static "How decisions are made" panel on `/system`.
- It renders the diagram above as a live SVG graph with the legend colors, **generated from the case's real `audit_log` and ledger rows, never hard-coded.** A node is lit only if rows back it; the path actually taken is highlighted; unused branches stay dim. A test asserts every node shown has at least one backing row.
- Each node opens a drawer with the real rows behind it (facts with source crops, the open question, the planner's ranked options and the chosen one, the reply, the recompute before/after, the human's click and who). That drawer is the proof of the decision, and it replaces nothing in the Proof Thread (A7); the Proof Thread is the per-flag view, the pipeline is the per-case view.
- A timeline scrubber replays the case event by event from `audit_log`; edges draw in order (animation A13 "Pipeline Run": stroke-dash travel along each edge at 450 ms, node lands with a 120 ms scale pulse, a deterministic step shows a small "rule" glyph, an AI step an "AI" glyph, a human step a hand-stamp glyph).
- Each node carries its badge (Live, Replay, Synthetic, Fixture). A deterministic step is labeled "Rules engine", an AI step "AI acts", a human step "Human decides": the reader can see exactly where AI stops and a person starts.
- Tokens: `--src:#484840` (gray), `--question:#E0B04A` (amber outline with a "?" glyph, distinct from the `--over` signal), `--ai:#3D3585` (indigo), `--ledger:#22503F` (green), `--human:#6E2E1C` (terracotta). On deck pages fills are 70% alpha with a 1px matching border; match the attached diagram.

**0.5 New features, tables and routes.**
- Tables: `fact`, `open_question`, `resolution_plan`, `outreach`, `household_upload` (plus `qc_history`). Contracts: `Fact`, `OpenQuestion`, `ResolutionPlan`, `Outreach`.
- Routes: `/upload/[token]` (household phone page), `/case/[id]` gains tabs Documents · Resolve · Pipeline · Proof.
- Ownership additions (section 5.1): `ledger` (B): `worker/src/features/ledger/**`, `db/migrations/ledger/**`; `planner` (B): `worker/src/features/planner/**`, `db/migrations/planner/**`, `worker/fixtures/planner/**`; `pipeline-ui` (A): `web/components/pipeline/**`, `web/styles/pipeline.css`; `resolve-ui` (A): `web/components/resolve/**`, `web/app/upload/**`, `web/styles/resolve.css`. `module-core` becomes `db-core` (B): `db/migrate.ts`, `db/migrations/{cases,flags,workflow}/**`, `worker/src/core/**`.
- Priorities: **P0** adds ledger, conflict detector, planner with fixture output, the Resolve tab, the household upload page with simulated SMS, the employer call, and the Decision Pipeline. **P1** adds the interview copilot, live Claude roles for the planner, one-line email channel in live mode. Manaspace only if needed.
- Demo script change (section 19): at 1:00 to 1:40 show the loop: ledger conflict "pay frequency?" → planner suggests contacting the employer → worker approves → call → fact lands on the question → recompute "$1,240 → $2,666 a month" → worker approves, then open the Pipeline tab and scrub it as the proof.


# 1. Role and mission

You are the lead engineer and scaffolder for **Stampy**, a hackathon build. Two people on two computers will run AI coding agents on this one repo at the same time for the next ~36 hours (`<fill in: event name, deadline>`). Your first job is to build the foundation so that neither side can break the other. Your second job is the homepage. Then you help ship features.

**One sentence.** Stampy is a document-grounded second check that runs before SNAP benefits go out: AI seats read the case file, flag what does not match with the exact source line and the rule it breaks, a deterministic engine recomputes the benefit, a voice agent calls employers and landlords to verify what the documents cannot, and a merit-staff worker decides everything.

**Pitch angle (do not drift from it).** Not "AI catches fraud." It is: *agency-caused income and deduction errors are most of the error dollars, and about 45% of them are visible in the case file. A second check before issuance, with proof, in both directions.* Timing: FY2027, the period being sampled right now, sets each state's FY2030 cost share.

**The one story (if a feature is not in it, it is not P0).**
A caseworker picks a state, gets a queue of cases drawn from the USDA QC public-use file, works one case station by station against the real SNAP process, the AI seats read documents, autofill the budget, cite policy, and flag errors with proof, the evidence ledger turns every conflict into an open question, a resolution planner picks the cheapest way to close it (text the household, contact the employer by call or email, or prompt the worker in the interview), the answers land back on the ledger, the rules engine recomputes, the AI warns about anything the worker skipped before the final decision, and the worker certifies. A debrief then shows what QC found on that real case.

**Tools, and what makes each load-bearing (see 0.1).**
- **Anthropic (Claude)**: runs every named role (section 12) and is the think model for the voice agent. Roles are the only source of findings and recommendations. Kill switch `control.ai_enabled`: off means "AI review offline", the worker proceeds manually, and the gate still runs its deterministic checks.
- **Moss** (moss.dev, semantic search runtime): policy retrieval over 7 CFR 273 and the state manuals. Every flag cites a retrieved passage. Latency is shown on screen.
- **SQLite with the QC historical data as the main database** (0.2): the only database.
- **Voice Verifier**: Deepgram Voice Agent (STT, TTS, turn-taking) behind a `VoiceProvider` interface, Anthropic as the think model. Section 13.
- **PolicyEngine-US**: cross-check for the recompute (optional, labelled when it runs).
- **Manaspace**: only if needed, optional adapter (0.1).
- Optional: Factory Droid "Rule Lab" (P2, only if everything else is green).

# 2. Hard rules (copy these into AGENTS.md and enforce them in `scripts/check-rules.ts`)

**Legal and product honesty**
1. Stampy never decides. Only merit staff certify (7 CFR 272.4). AI output is a flag, a citation, a question to ask, or a draft. Nothing the AI produces writes to the case file without a human accept click. The word "decision" in UI always belongs to the worker.
2. Never deny on thin evidence. Unsure means: ask for more evidence, ask a question, or send to a person. No code path produces an automatic denial or an automatic correction.
3. Accuracy in both directions. Overissuance risk and underissuance risk get the same visual weight, same urgency. Underpayments are reported, not hidden.
4. Never say or imply: it detects fraud, it determines eligibility, it reduces a state's error rate by X%, it is FNA-approved, FedRAMP/StateRAMP-authorized or Pub 1075-compliant, it uses credit data to verify applicants, it is integrated with CalSAWS/TIERS/any state system, or its projected PER equals the official PER. `check:rules` greps UI strings for: `fraud`, `scam`, `deny`, `denied`, `denial`, `auto-approve`, `auto-correct`, `guarantee`, `FNA-approved`, `compliant with Pub 1075` (allow-list only for quoted source titles in `data/sources.json`).
5. Credit-bureau identity data (CRS) is out of scope. Do not build it.
6. Photo, document and voice findings say "internally consistent with the record, not proof of authenticity."
7. Never invent numbers, URLs, IDs, benchmark scores or policy text. Unknown means `<fill in>` in code and "not loaded" on screen. Policy text shown to a user must come from a fetched source (eCFR, state manual) stored in `data/policy/` with `source`, `section`, `url`, `retrieved_at`. Never paraphrase policy from memory and present it as a citation. CFR section numbers in this prompt marked *(verify)* must be checked against eCFR before display; record the result in `data/policy/citations.json` as `verified: true|false`.

**Data honesty (every number on screen carries a badge)**
8. Badges: **Live** (computed now from database rows or a real API run), **Replay** (from the USDA QC public-use file, FY`<fill in>`), **Synthetic** (a document or call generated from a QC record or a persona), **Fixture** (recorded or hand-written test data), **Sandbox** (vendor sandbox). A hard-coded number is never Live. `scripts/check-badges.ts` fails the build when a rendered figure has no adjacent badge.
9. Synthetic documents are generated from QC-verified values, so "the AI caught it" on replay cases demonstrates the pipeline, not real-world detection rates. The debrief and dashboard say so in plain words. Never present replay recall as a performance claim.
10. Footer on every page: "Synthetic documents generated from public USDA QC records. No real applicants. Stampy flags and cites; a merit-staff worker decides. Not an eligibility system."
11. Voice: every call opens by stating it is an AI assistant calling on behalf of the agency, names the purpose, and offers a human callback. Calls are simulated or go only to numbers on `VOICE_ALLOWED_NUMBERS`. Household consent to a collateral contact is recorded in the UI before the call button enables. The agent discloses the minimum needed and never reveals benefit status beyond what the question requires.

**Engineering**
12. Keys stay server-side. No `DEEPGRAM_API_KEY`, `ANTHROPIC_API_KEY`, `MOSS_PROJECT_KEY`, `MANUS_API_KEY` in `web/` or any client bundle. `check:rules` greps for them.
13. Never stop for a missing key. Every integration has `mode: fixture | live`, defaults to fixture, and the app runs fully with zero keys. Log `UNVERIFIED-LIVE: <service>: <command to verify>` in `PROGRESS.md` and `docs/LIVE_CHECKLIST.md` for anything not exercised live.
14. Credits are finite: no loops that start themselves; `AI_DAILY_RUN_LIMIT`, `VOICE_DAILY_CALL_LIMIT`, per-case outreach caps, all enforced in the service layer, not the UI.
15. The truth table (`case_truth`, the QC-verified values) is server-only. It is never in a client response or SSE stream, never sent to an agent, never rendered before the debrief. A test asserts this.
16. Detectors and seats use behavior and documents only. Region and agency are never evidence of an error.

# 3. Facts ledger (the only figures the app may show without further research)

Every row shows with its badge and a source chip. `href` is `<fill in>` until verified; never guess a URL. Source for rows 1 to 12 is the user's research doc (`docs/RESEARCH.md`).

| # | Fact | Value | Badge | Source label | Caveat to show |
|---|---|---|---|---|---|
| 1 | FY2025 national payment error rate | 10.62% = $10.1B (9.28% over, 1.33% under) | Replay | USDA FNA FY2025 PER | |
| 2 | FY2023 benefits / overissued / underissued | $90.06B / $9.04B / $1.48B | Replay | FNS QC Annual Report FY2023 | |
| 3 | Agency-caused share of variances | 56.98% (81.99% of underpayment variances) | Replay | same | |
| 4 | Agency-caused dollar error | 6.65 of 11.68 points; client 4.93 points | Replay | same | |
| 5 | Variances by element | Income 55.50%, deductions 16.62%, non-financial 12.94%, other 14.01%, resources 0.92% | Replay | same | Element level only |
| 6 | Underpayment variances | Deductions 30.70%, non-financial 25.07% | Replay | same | |
| 7 | How variances were found | Case file 44.54%, household 35.00%, collateral contacts 20.46% | Replay | same | |
| 8 | When they occurred | 63.97% at or before most recent certification | Replay | same | |
| 9 | Tolerance threshold | $58 (FY2026), $59 (FY2027); excluded from PER unless household ineligible, still reported | Fixture | QC Policy Memo 25-04 | |
| 10 | Cost share clock | FY2028 uses closed periods (FY2025 published, FY2026 ended Sep 30, 2026). FY2029+ uses the rate from three years earlier, so FY2027 sets FY2030 | Fixture | statute as summarized in research doc | Say "as summarized"; verify before any state-facing claim |
| 11 | Independent support | Risk-based review alone costs about 7x as much as AI flags combined with risk scores | Replay | NYU simulation on public QC data, Nov 2, 2026 | Public file excludes ineligible households, so projected PER runs a few points below official |
| 12 | Market proof | Michigan MiCARA: 17,500 pre-certification reviews in 3 months, $150,000 potential errors identified (Proof News, Nov 5, 2026). SAS West Virginia $876,259 emergency purchase. Florida $4M appropriation for ML analytics. PTIG up to $2M; EVS $38M | Fixture | named per row | |
| 13 | Per-state FY2025 PER | load from `data/states.json`, built from the official FNS table | Replay | USDA FNA | Rows you cannot source stay `<fill in>` and render "n/a" |
| 14 | One-person max allotment | $298 to $306 in Oct 2026 | Fixture | FY2027 COLA parameters (via PolicyEngine-US) | verify |

Not allowed on screen: Mississippi's "$40M" claim (unsupported), any state-level reduction claim, any "X% fewer errors" figure.

# 4. Stack and repo layout (do not add services without asking)

Same stack as the Vouch project minus SpacetimeDB and CREAO: Node 22, TypeScript strict, npm workspaces, SQLite.

```
stampy/
  AGENTS.md  CLAUDE.md(@AGENTS.md)  PROGRESS.md  OWNERS.md  README.md
  .env.example (GENERATED from env/*.env)   env/*.env   .env.local (git-ignored)
  .features/            one claim file per feature branch (section 5)
  status/a.md b.md      each machine edits only its own file
  docs/                 RESEARCH.md MASTER_PROMPT.md ARCHITECTURE.md SNAP_PROCESS.md VOICE.md LIVE_CHECKLIST.md REAL_VS_SIMULATED.md
  packages/
    contracts/          zod schemas + TS types + fixtures/ (FROZEN after scaffold-v1, section 5)
    snap-rules/         pure TS: steps.ts frequency.ts deductions.ts budget.ts gate.ts params/fy2027.json
  db/
    migrate.ts          frozen runner
    migrations/<feature>/NNN_name.sql   each feature owns its folder
    (stampy.db lives in data/db/, git-ignored)
  worker/               Node 22 + Hono
    src/server.ts  src/env.ts  src/db.ts  src/events.ts (SSE)
    src/core/           authz, audit, control, truth
    src/features/index.ts  (pre-lists every feature; never edited later)
    src/features/{qc,docgen,ledger,planner,seats,recompute,policy,voice,eval}/
    fixtures/  .keys/ (git-ignored)  media/ (git-ignored)
  web/                  Next.js 16 App Router + Tailwind 4 + motion + lenis + recharts + lucide-react
    app/(site)/page.tsx     home
    app/demo/  app/case/[id]/  app/dashboard/  app/system/  app/upload/[token]/  app/voice/answer/[callId]/
    components/{home,demo,case,pipeline,resolve,voice,dashboard,ui}/
    styles/{tokens.css,home.css,demo.css,case.css,pipeline.css,resolve.css,voice.css,dashboard.css}
    lib/{data,routes.ts}   (lib/data talks to the worker over REST + SSE; web never opens the database)
  data/
    db/                 stampy.db (git-ignored; qc_history is the main table)
    golden/             4 hand-authored golden cases (section 11)
    qc/{raw(git-ignored),sample}/   states.json   sources.json
    policy/<source>/*.md   (fetched text only)
  scripts/              env-build env-check dev-ports feature-start feature-list sync check-rules check-badges check-ownership db-build hello-*.ts
  e2e/                  Playwright smoke per route
```

Read `web/node_modules/next/dist/docs/` before writing web code: this Next.js has breaking changes from older versions. SQLite facts: one writer, so only the worker opens `stampy.db` (WAL mode on); the web app never does.

# 5. The two-machine protocol (this is what keeps two AI-driven machines from colliding)

**Principle: nobody edits a file the other machine might edit.** Achieve it with four mechanisms, all built in Phase 0.

**5.1 Vertical slices with owned paths.** `OWNERS.md` (static, written at scaffold) maps every feature to the paths only it may edit:

| Feature slug | Machine | Owned paths |
|---|---|---|
| `home` | A | `web/app/(site)/**`, `web/components/home/**`, `web/styles/home.css`, `web/public/images/home/**` |
| `demo-shell` | A | `web/app/demo/**`, `web/components/demo/**`, `web/styles/demo.css`, `data/states.json` |
| `case-workspace` | A | `web/app/case/**`, `web/components/case/**`, `web/styles/case.css` |
| `voice-ui` | A | `web/components/voice/**`, `web/app/voice/**`, `web/styles/voice.css` |
| `dashboard-ui` | A | `web/app/dashboard/**`, `web/components/dashboard/**`, `web/styles/dashboard.css` |
| `system-page` | A | `web/app/system/**` |
| `rules` | B | `packages/snap-rules/**` |
| `qc-data` | B | `data/qc/**`, `worker/src/features/qc/**`, `worker/src/features/docgen/**`, `scripts/qc-*.ts` |
| `seats` | B | `worker/src/features/seats/**`, `worker/src/features/recompute/**`, `worker/fixtures/seats/**` |
| `policy` | B | `worker/src/features/policy/**`, `data/policy/**`, `scripts/policy-*.ts` |
| `voice-engine` | B | `worker/src/features/voice/**`, `db/migrations/voice/**` |
| `db-core` | B | `db/migrate.ts`, `db/migrations/{cases,flags,workflow}/**`, `worker/src/core/**` |
| `eval` | B | `worker/src/features/eval/**` |
| `ops` | B | `scripts/**` (except `qc-*`, `policy-*`), `.github/**`, `e2e/smoke*`, `env/ops.env` |

Every feature also owns, implicitly: its own `e2e/<slug>/**` specs and screenshots, its own `env/<slug>.env` fragment, and `docs/<slug>.md`. Nothing else.

A is "Face" (everything people see), B is "Brain" (data, rules, agents, voice). If one finishes early it claims an unowned or finished slice from the other; ownership moves only through a claim file (5.3).

**5.2 Frozen hot files.** After tag `scaffold-v1` these change only through an `infra/` or `contract/` PR that is under 150 lines, merged within 30 minutes, and acknowledged by the other machine: `packages/contracts/**`, `db/migrate.ts`, `worker/src/features/index.ts`, `web/app/layout.tsx`, `web/styles/tokens.css`, all `package.json`, `package-lock.json`, `.env.example`. The scaffold pre-creates a stub for every feature, every route, every migration folder and every barrel import so that features fill in files and never add lines to shared ones. `.env.example` is generated from `env/<feature>.env` by `npm run env:build`; features edit only their own fragment. CSS: `globals.css` holds tokens and base only; every feature has its own CSS file.

**5.3 Claim files, one per branch (no shared ledger).** `npm run feature:start -- <a|b> <slug>` creates branch `<machine>/<slug>`, a worktree at `../stampy-wt/<machine>-<slug>`, and `.features/<slug>.md`:

```yaml
---
slug: income-analyst
machine: b
owns: ["worker/src/features/seats/income/**"]   # must be inside the owner's table paths (or explicitly transferred)
reads: ["packages/contracts/seats.ts"]
touches_module: false
needs_deps: []
status: claimed        # claimed | in-review | merged
---
## Needs from the other machine
## Notes
```
It then pushes the branch immediately, so `npm run feature:list` (`git fetch` plus reading `.features/*.md` from every remote branch) shows who is doing what with no merge conflicts, because every claim is its own file.

**5.4 Guardrails that run, not rules that hope.**
- `npm run check:ownership`: diff against `main`, find the branch's claim file, fail if any changed file is outside `owns`, the branch's own `.features/<slug>.md`, `status/<machine>.md`, `e2e/<slug>/**`, `env/<slug>.env`, or `docs/<slug>.md`. The message names the owning feature. Wire it into the pre-commit hook and CI.
- `npm run check`: typecheck, unit tests, `check:rules`, `check:badges`, `check:ownership`.
- `npm run sync`: `git fetch && git rebase origin/main && npm i && npm run db:migrate && npm run env:build && npm run check`. Run before starting work and before every push.

**5.5 Collision-proof runtime.**
- `.env.local` (git-ignored) sets `MACHINE=a|b` and `SLOT=0..9`. `scripts/dev-ports.ts` derives `WEB_PORT=3000+SLOT`, `WORKER_PORT=8787+SLOT`, so several worktrees on one machine can run at once.
- Databases are per machine: each machine builds its own `data/db/stampy.db` (`npm run db:build`). There is no shared database and no publish step; the demo machine builds fresh. Migrations are per-feature folders, so schemas never collide.
- Nothing generated is committed: there are no bindings. The browser talks to the worker over REST and SSE, so the contracts in `packages/contracts` are the only shared types.

**5.6 Git rules.** Trunk-based. Branch `<machine>/<slug>`, short-lived (under 3 hours). Squash-merge PRs of under 400 lines after `npm run sync && npm run check`. Never force-push `main`. Dependencies: add with a tiny `infra/deps-<name>` PR merged immediately, then rebase. No merge commits on feature branches (rebase). Commit after each step with a one-line message. One file per event, never a shared append-only file: contract changes go in `packages/contracts/changes/<yyyymmdd-hhmm>-<slug>.md`, status goes in your own `status/<machine>.md`.

**5.7 Build against contracts and fixtures, not against each other.** The Face never waits for the Brain: `NEXT_PUBLIC_DATA=fixture` makes the web app read `packages/contracts/fixtures/*` (four golden cases with complete flags, extractions, citations, a call transcript and a gate result) through `lib/data`, the same interface the live path uses over the worker's REST and SSE. The Brain ships real implementations behind the same contracts and flips `fixture` to `live` per seat. A contract change is the only cross-machine event; everything else is independent.

# 6. Phase 0: scaffold (Machine A, target 45 minutes, then tag `scaffold-v1`)

Do these in order; commit after each; stop for nothing missing. Ownership checks are not enforced until `scaffold-v1` exists, so this phase may touch every path.
0. Save the full text of this prompt (sections 1 to 21) as `docs/MASTER_PROMPT.md`, and check that `docs/RESEARCH.md` exists (if not, ask the human to add it and continue with the facts ledger).
1. Init repo, workspaces, TS strict, ESLint, `.nvmrc` (22), `.gitignore` (node_modules, `.env*` except `.env.example`, `worker/.keys`, `worker/media`, `worker/.cache`, `data/qc/raw`, `data/db/*.db*`, `test-results`), `.gitattributes`.
2. `AGENTS.md` (sections 1, 2 and 5 condensed to under 150 lines) and `CLAUDE.md` containing `@AGENTS.md`. `OWNERS.md` from 5.1.
3. `packages/contracts`: zod schemas and types from section 14, plus `fixtures/` for the four golden cases (section 11). Pure, no runtime deps beyond zod.
4. `packages/snap-rules`: stubs with the exported function signatures and `steps.ts` filled in fully from section 10 (the stations table is data, used by both web and worker).
5. `db/`: `migrate.ts` and a migration folder per feature (an initial `0001` creating `qc_history`, `control`, `audit_log` with append-only triggers, and the tables in 0.5), plus `worker/src/core` (`authz`, `audit`, `control`, `truth`).
6. `worker/`: Hono server with `/health`, `GET /events` (SSE), `src/features/index.ts` registering every feature (each exports `register(app)` and `status()`), `src/env.ts` reading mode flags, the adapter template in section 15.
7. `web/`: layout, `tokens.css` (section 7), nav, footer, Badge, HudFrame, SectionDivider, Odometer, every route as a real page that renders its template with fixture data and a visible `Fixture` badge (placeholder content is fine, layout is not).
8. `env/*.env` fragments and `scripts/env-build.ts`, `env-check.ts`, `dev-ports.ts`, `feature-start.ts`, `feature-list.ts`, `sync.ts`, `check-ownership.ts`, `check-rules.ts`, `check-badges.ts`, and the `hello-*` scripts (section 17).
9. Pre-commit hook (`simple-git-hooks`) running `check:ownership` and `check:rules`.
10. Playwright smoke: every route returns 200 in fixture mode with no console errors.
11. `npm run check` is green. Commit. Tag `scaffold-v1`. Push. Write `status/a.md`: "scaffold-v1 pushed, B may start."
12. Immediately continue with the homepage (section 8) on branch `a/home`.

# 7. Design system

**Decision.** Keep Vouch's editorial skeleton (serif display, calm scroll-driven scenes, quiet text CTAs, evidence cards) and Constructa's command deck (dark glass HUD, corner reticles, pulse divider, mono kickers) but change the palette so Stampy reads as public-benefits accuracy, not retail fintech. Vouch's aubergine and marigold say "commerce." Pine, ledger paper and an amber/blue pair say "case file." The amber/blue pair becomes the product's visual signature: **amber = overissuance risk, blue = underissuance risk, always shown together.** If the team prefers Vouch's colors, only `tokens.css` changes.

**Two surfaces.** Pitch pages (`/`) are light paper. Work pages (`/demo`, `/case`, `/dashboard`, `/system`) are the dark command deck, switched with `body:has(.app-dark)` exactly as Vouch does.

**Tokens (`web/styles/tokens.css`, Tailwind 4 `@theme inline`)**
```css
:root {
  /* paper (pitch) */
  --paper:#F2EFE7; --paper-2:#FBF9F4; --ink:#10231D; --ink-soft:#4F625B; --line:#D8D3C5;
  --pine:#174C41; --pine-2:#1F6355;
  /* signal pair + status */
  --over:#D99A1E;      /* overissuance risk (amber) */
  --under:#3E6FB5;     /* underissuance risk (blue) */
  --proof:#2E8B67;     /* verified / matches */
  --conflict:#B5473E;  /* contradiction (never "denied") */
  --voice:#7C5CBF;     /* call accent */
  /* deck (work pages) */
  --deck:#0B1411; --deck-2:#111E19; --deck-line:rgba(236,240,232,.12);
  --deck-ink:#E8EEE9; --deck-ink-soft:rgba(232,238,233,.66); --glow:#6FE3B2;
  --glass:rgba(255,255,255,.04); --glass-line:rgba(255,255,255,.12);
  --radius:10px; --radius-card:12px; --radius-glass:18px; --maxw:1080px;
}
```
Contrast: all text pairs meet WCAG 2.1 AA; amber and blue are never the only signal (always paired with an arrow glyph and the words "over" / "under").

**Type.** `Fraunces` (display, weight 650, tracking -0.03em, `text-wrap: balance`), `DM Sans` (body), `JetBrains Mono` (eyebrows 0.7rem uppercase 0.14em tracking, labels, all money and IDs with `font-variant-numeric: tabular-nums`). Load with `next/font/google`. Scale: hero `clamp(1.9rem, 3.6vw, 3rem)`, section title `clamp(1.65rem, 3.2vw, 2.35rem)`, body 1.05rem/1.5.

**Component inventory (each is one small file in `web/components/ui`)**
| Component | Spec |
|---|---|
| `Nav` | Sticky, solid paper on pitch pages (`over-hero` = transparent on the home hero), serif wordmark "Stampy" with a small pine square mark, links: Demo, How it works, Numbers, System; right side a single underlined text CTA "Work a case". On deck pages: deck background, `--deck-ink`. Pill variant not used. |
| `Badge` | Mono 0.58rem uppercase. Live = pine fill with paper text; Replay = outlined `--under`; Synthetic = dashed `--voice`; Fixture = `--over` outline on tint; Sandbox = dotted `--ink-soft`. Tooltip text from a single `TITLE` map. |
| `TextCta` | Underlined serif-weight 650 text link, 2.75rem tall, no pill (Vouch style). `Btn` pill for in-app actions: primary (pine), ghost, `over`, `under`, `proof`. |
| `HudFrame` | From Constructa: dark gradient panel, four 1px corner reticles in `--glow`, top-bar mono label with pulsing dot, 4% film grain. Used for the mini demo, voice panel, dashboard gauge. |
| `SectionDivider` | 1px gradient band `--over` to `--under` with a sweep every 4.5 s (Constructa). Between every home section. |
| `FlagCard` | Direction glyph (↑ over, ↓ under), mono rule id, one-line title, delta in money, `View proof`. Left border colored by direction. |
| `ProofThread` | See animation A7. The signature "proof of decision" component. |
| `CaseVsDoc` | "Ordered vs Observed" from Vouch becomes **Case file vs Document** two-column card: left "Budgeted in case file" value, right "Read from document" value with the cropped source image and a bbox; footer line "AI flag, worker decides". |
| `StationRail` | Vertical bead rail of the ten stations with status: pending, in progress, done, skipped (amber ring), flagged. |
| `Odometer` | Digit-roll number, 450 ms per digit, `aria-live="polite"`, respects reduced motion. |
| `StampMark` | Ink stamp "REVIEWED · MERIT STAFF" (animation A3). |
| `ClockChip` | "Day 3 of 30", "Expedited: 4 d left"; turns amber at 80%, conflict color when breached. |

**Motion principles.** Everything reversible by scroll where it is scroll-driven. Panels slide from their edge 240 ms ease-out; lists stagger 40 ms; every arriving live row flashes its accent for 600 ms; camera-style moves 1,200 ms. `prefers-reduced-motion`: keep fades, drop movement, replace scroll-scrub scenes with static stacked panels (Vouch's `DilemmaStatic` pattern). No WebGL on the home page (tactile feel comes from DOM and SVG, like Vouch's wheel). Home performance budget: Lighthouse performance 85+ on desktop.

**Signature animations (build these; each has a reduced-motion fallback)**
| ID | Name | What it does | How |
|---|---|---|---|
| A1 | Case Wheel | Hero: an arc fan of document cards (paystub, lease, utility bill, interview note, match alert) deals in over 1.2 s, drifts, can be dragged, and rotates a few degrees with scroll. Each card carries a small rotating error chip ("Pay frequency", "Rent mismatch", "SUA not applied", "Unworked match") | Port the math from `vouch/web/lib/wheel/math.ts` and `components/journey/wheel/claim-wheel.tsx` (rAF loop, entrance ease, `layoutForFrame`). Cards are DOM, not canvas. |
| A2 | The Pass | Scroll-scrubbed scene. A paystub lifts from the fan to center. A scan beam sweeps down. A bbox draws around "Gross $1,240.00" and "Biweekly". Field chips fly into a budget sheet (`layoutId`). The budgeted "$1,240 / mo" is struck through and an odometer rolls to "$2,666 / mo". A delta chip lands: "+$1,426 / mo not counted · overissuance risk". A citation chip: "7 CFR 273.10(c) · biweekly × 2.15 *(verify)*". Badge: Fixture. | `useScroll` on a sticky track like Vouch's `OpeningScene` (hero run 150vh, scene run 185vh) with `useTransform` keyframes; bbox via SVG `pathLength`; `useScrollHolds` so scroll pauses at reading beats. |
| A3 | The Stamp | The worker presses Certify; an ink stamp settles: scale 1.6 to 1, rotate -8° to -4°, 280 ms spring, ink-bleed via SVG `feTurbulence` mask, 2 px page nudge on contact. | `motion` spring plus SVG filter. Used at the end of the home hero and at certification in the demo. |
| A4 | Ledger Beam | Two-pan balance: amber pan left (over), blue pan right (under). The beam angle = normalized (over minus under). Numbers roll with the odometer. Home: FY2025 9.28% vs 1.33%. Dashboard: the live session. | SVG, `motion` rotate with spring. |
| A5 | Cost-Share Clock | Timeline FY2025 (published) → FY2026 (closed Sep 30) → FY2027 (sampling now, pulsing) → FY2030 (cost share set). A playhead sweeps; a curved arrow draws from FY2027 to FY2030. | SVG, `pathLength`, `whileInView`. |
| A6 | Where the answer lives | One bar split 44.54 / 35.00 / 20.46. Segments fill in sequence, then each label resolves into the product part that handles it: "Case file → Document Reader", "Household → interview questions we write", "Collateral contacts → Voice Verifier." | `whileInView` with staggered width tweens. |
| A7 | Proof Thread | In a flag's drawer, an SVG path draws (600 ms) through five nodes that land with 40 ms stagger: **Source crop (with bbox) → Extracted field (confidence) → Policy passage (Moss, retrieval ms) → Recompute (before/after) → Human action (accept / dismiss / question).** Every node is a real row; clicking one scrolls the document viewer to it. | SVG `pathLength` + staggered `motion` nodes. |
| A8 | Voice Bloom | Voice panel: two live waveforms (agent in `--pine`, counterpart in `--over`), transcript lines type in, and extracted facts lift off the transcript as chips and fly into the case field they would fill, where they wait in a pending state until the worker clicks Accept. | Canvas or SVG analyser from the audio stream; chips with `layoutId`. |
| A9 | Skip Tether | At Certify with open items: the gate dims the page, the stations rail beads for skipped items pulse amber, and a tether line draws from the Certify button to each open item. Resolving an item retracts its tether and fills its bead. | SVG paths computed from element rects; `pathLength` retract. |
| A10 | Truth Envelope | Debrief: a sealed envelope "QC found on this case" unfolds, QC-verified values flip in beside the certified ones, and each AI flag that matched ticks (misses and false flags are shown too, in the same weight). | CSS 3D flip + staggered ticks. |
| A11 | Tile Ripple | State select: a tile-grid cartogram (one square per state, no map library). Hover lifts neighbors by distance; select ripples outward 40 ms per ring; tile fill = PER band. | CSS grid of 11×8 coordinates, `motion`. |
| A12 | Section Pulse | The Constructa divider, recolored. | CSS keyframes. |

Optional image plates (leave slots, do not block on them): `web/public/images/home/desk-plate.jpg`. Prompt for the image tool: "top-down caseworker desk, warm paper tones, soft window light, manila folders and a blank form, no people, no readable text, shallow depth, muted." CSS fallback: paper gradient plus SVG noise.

# 8. Homepage spec (`/`, branch `a/home`, build this fully in Phase 0 and refine after)

Structure borrows Vouch's journey (sticky scroll scenes, stat beats, two-column analogy, evidence card, accordion "powered by") and Constructa's rhythm (hero, telemetry cards, HUD mini demo, divider pulses). Sections, in order:

1. **Opening scene (A1 then A2 then A3)**, light paper, nav transparent over it.
   Eyebrow (mono): `Stampy · Pre-issuance accuracy for SNAP`.
   H1: **Check the case before the benefit goes out.**
   Sub: "Stampy reads the case file, flags what doesn't match with the exact source line and the rule behind it, and recomputes the benefit. A merit-staff worker makes every decision."
   CTAs: text CTA "Work a case →" to `/demo`; secondary "See the numbers" scrolls to section 2. Mono line: `Every dollar right, in both directions · We never deny · We never auto-correct`.
   Scroll beats: Case Wheel deals in; scroll lifts the paystub into The Pass; the last beat ends on The Stamp with the caption "Flag. Cite. Recompute. A person decides."
2. **The cost of getting it wrong (stat beats, Vouch `Dilemma` pattern).** Sticky track; each figure owns the stage alone, then clears: `$10.1B` (FY2025 improper payments, 10.62%), `6.65 of 11.68` (points of dollar error that agencies caused, FY2023), `55.5%` (variances in income). Each with a source chip and `<fill in>` href. Finale screen: **Two ways to be wrong**, editorial two-column ("Pressure A / Pressure B" layout with a vertical rule): *Overissue* ($9.04B, FY2023) and *Underissue* ($1.48B, 82% agency-caused), with the Ledger Beam (A4) between them. Copy: "Underpayments are errors too. Stampy reports them with the same urgency."
3. **Why now (A5 Cost-Share Clock).** Title: "FY2027 is being sampled right now. It sets your FY2030 share." One line under: "Every case worked this year counts."
4. **Where the answer lives (A6).** Title: "About 45% of errors are visible in the case file. The rest need a person." Then three cards (Constructa telemetry style, mono kickers): `01 · Read` (Document Reader and the seats), `02 · Ask` (interview questions Stampy writes, never answers), `03 · Call` (Voice Verifier phones the employer or landlord).
5. **How one case works (Decision Pipeline replay from 0.4, plus `CaseVsDoc`; Vouch `how-it-works` flow-steps as the mobile fallback).** Five steps: Read the documents · Compare to the case file · Cite the rule · Recompute both ways · Worker decides, with the paystub example rendered as `CaseVsDoc` ("Budgeted $1,240 / month" vs "Paystub: $1,240 biweekly = $2,666 / month"). Note: "A flag alone never changes a case."
6. **Live preview (Constructa `InteractiveMiniDemo` pattern, inside `HudFrame` labelled `LIVE PREVIEW`, badge Fixture).** Auto-cycling loop with tabs `01 UPLOAD · 02 READ · 03 FLAG · 04 RECOMPUTE`, ~18 s cycle, pausable. Clicking a tab jumps to it. Ends on a button that opens `/demo`.
7. **Voice spotlight.** Title: "When the document can't answer, Stampy makes the call." A `HudFrame` with a looping Voice Bloom (A8) of a scripted employer call: AI disclosure line, question, answer, chips flying into "Pay frequency: biweekly (verified by employer, 0:42)". Right column: the four guardrails (discloses it is an AI, household consent first, human can take over, never accuses or negotiates). Badge: Synthetic.
8. **Guardrails ("What we will never do").** Four stamped commitments: Never deny · Never auto-correct · Cite every flag · Both directions. Below, a quiet list headed "What we do not claim" with the section 2 rule 4 items rewritten as plain sentences. Honest framing is the trust signal.
9. **Already happening (market proof).** One row of facts from ledger row 12, each with source chip. Tag line: "States are buying this category now. Stampy starts as a free shadow-mode replay."
10. **How a state starts.** Four-step rail (Vouch flow-step style): Replay the public QC file for your state (free) → Shadow mode on 200 closed cases, no system access → Paid pre-issuance pilot on one office queue → Accuracy report in both directions. Ask line: "200 closed QC cases or a de-identified replay."
11. **Powered by (Vouch accordion).** Collapsed by default; each card says what the tool actually does in this product, one sentence, with a Live/Fixture/Sandbox badge that reflects `/system` status at runtime: Anthropic, Moss, SQLite with the QC history, Deepgram voice, PolicyEngine-US.
12. **Closing CTA and footer.** "Work a case" text CTA, then the section 2 rule 10 footer line verbatim.

Acceptance for the homepage: renders with zero keys and `NEXT_PUBLIC_DATA=fixture`; every figure has a badge and source chip; keyboard and reduced-motion paths work; mobile (390 px) shows the static stacked versions of A1 to A6; Playwright screenshots at 1440 and 390 saved to `e2e/home/shots/`; `check:badges` and `check:rules` pass.

# 9. Routes and templates (all built in Phase 0 with fixture data, then deepened per feature)

| Route | Surface | Template |
|---|---|---|
| `/` | paper | Homepage above |
| `/demo` | deck | **State select**: left, A11 tile cartogram with a legend (PER bands: under 6%, 6 to 7.99, 8 to 9.99, 10 to 13.33, above 13.34); right, `HudFrame` "State profile": FY2025 PER with over/under split, administration type (state or county), reporting system and form name, policy manual loaded (CA MPP Division 63, TX Works Handbook, NY SNAP Source Book, else "federal 7 CFR 273 only"), button "Start shift" (assigns 8 cases, seeded). Sub-link "Shuffle cases". |
| `/demo/queue` | deck | **My cases**: table of 8 cases with ClockChips, household size, "3 docs ready · 2 flags" AI pre-triage, status, Open. Right rail: shift summary (cases worked, flags resolved, skipped-then-caught count). |
| `/case/[id]` | deck | **Workspace**, three panes (wireframe below) |
| `/case/[id]/gate` | deck | Pre-issuance gate sheet (A9), reached from Certify |
| `/case/[id]/debrief` | deck | Truth Envelope (A10): certified vs QC-verified, flags matched, missed, false, worker overrides, plain-language caveat |
| `/dashboard` | deck | **QC projection**: Ledger Beam, projected PER with interval and tier band, dollars at risk by element (stacked bar, both directions), change-report aging (over 10 days in conflict color), replay accuracy panel with the synthetic-document caveat |
| `/system` | deck | Integration status table (mode, last run, latency, run count, daily limit), kill switches (AI, Moss, Voice), `UNVERIFIED-LIVE` list |
| `/voice/answer/[callId]` | deck | Counterpart page for `human` mode: a teammate answers the call as an employer or landlord in a browser |

**Case workspace wireframe (`/case/[id]`)**
```
┌ nav ─────────────────────────────────────────────────────────────────────────┐
│ Case QC-0412 · CA · HH 3 · filed Oct 03     [Day 11 of 30] [Expedited ✓]   [Certify…] │
├ Stations ──┬ Case file & documents ───────────────────────┬ AI review ────────────┤
│ ● 1 Intake │ ┌ tabs: Application · Paystub · Lease · Bill ┐│ Flags (3)   ↑2 over ↓1 under
│ ● 2 Expedit│ │  document image with bbox overlays        ││ ┌ FlagCard ↑ +$1,426/mo ┐│
│ ◐ 3 Interv │ │  (extracted fields draw in, scan beam)    ││ │ Income · biweekly ×2.15││
│ ○ 4 Verif  │ └───────────────────────────────────────────┘│ │ [View proof] [Accept] ││
│ ○ 5 Income │ Budget sheet (autofilled, each field has a   ││ └───────────────────────┘│
│ ○ 6 Deduct │ source chip; AI-filled values show "pending  ││ Proof Thread (A7)        │
│ ○ 7 Househ │ accept" until the worker clicks)             ││ Policy passage + Moss ms │
│ ○ 8 Matches│ Budgeted  | Recomputed | Δ                   ││ Questions to ask (list)  │
│ ○ 9 Budget │                                              ││ [Call employer] (voice)  │
│ ○10 Gate   │                                              ││                          │
└────────────┴──────────────────────────────────────────────┴──────────────────────────┘
```
Workers may move between stations freely (real workers do). The rail records skipped stations; nothing is forced, everything is tracked.

# 10. The SNAP process, mapped (data lives in `packages/snap-rules/steps.ts`; this table is the spec)

Citations marked *(verify)* must be checked on eCFR before display. Clocks start at the filing date. Standards come from `params/fy2027.json`, never hard-coded in UI.

| # | Station | What the worker does | Legal basis | Clock | AI seats | Evidence on screen | Pre-issuance gate rule if skipped (PG) |
|---|---|---|---|---|---|---|---|
| 1 | Application and filing date | Confirm a valid filing (name, address, signature), filing date, check for a duplicate application | 7 CFR 273.2 *(verify (c))* | Starts 30-day and 7-day clocks | Intake checker (code); duplicate flag (fixture) | Application image, filing vs received date | `PG1` filing date unconfirmed |
| 2 | Expedited screening | Screen: very low income or resources, or shelter costs above income; identity must be verified, other verification may be postponed | 273.2(i) *(verify)* | Benefits by day 7 | Rule check in code; Policy Librarian cites | Income, resources, shelter figures vs thresholds | `PG2` expedited-eligible with no 7-day plan |
| 3 | Interview | Hold or record the interview; missed interview triggers a notice and no denial before day 30 | 273.2(e) *(verify)* | Scheduled to meet 30 days | Interview Prep: question plan from open flags and household checker | Question list, notes box, outcome | `PG3` interview not recorded |
| 4 | Mandatory verification | Identity, gross non-exempt income, alien status, SSN, residency, disability where relevant, utility expenses or SUA eligibility, claimed medical costs, household composition when questionable | 273.2(f) | At least 10 days to provide, before certification | Document Reader maps each document to a requirement; Verification Analyst | Checklist with each requirement: verified (source), missing, questionable | `PG4` mandatory item unverified and no pending-verification notice |
| 5 | Income | Budget wages: convert pay frequency (weekly × 4.3, biweekly × 2.15, semi-monthly × 2, monthly × 1), check employer, anticipated vs past pay, stale documents | 273.9, 273.10(c) *(verify)* | n/a | Income Analyst; engine cross-checks | Paystub crop with bbox, conversion arithmetic, case value vs recomputed | `PG5` budget differs from recompute by more than tolerance; document date outside budget month |
| 6 | Deductions and shelter | Standard, 20% earned income, dependent care, medical (elderly/disabled), child support, excess shelter, SUA, homeless deduction; apply the OBBBA SUA limit | 273.9(d) *(verify)* | n/a | Shelter and Utility Checker | Lease and bill crops, SUA applied vs heating/cooling evidence | `PG6` SUA applied without cost shown, or heating cost shown with no SUA |
| 7 | Household composition | Compare lease occupants and documents with household members; write the question, never the answer | 273.1 *(verify)* | n/a | Household Composition Checker | Names on lease vs case members | `PG7` unresolved mismatch |
| 8 | Data matches and collateral contacts | Work match alerts (wage, SSA, unemployment, duplicate participation) so none ages; call employer or landlord for open conflicts | 272.8 (IEVS), 273.2(f) | Alerts must be acted on | Change-Report Triage (P1); Voice Verifier | Alert list with aging (over 10 d in conflict color), call transcript and facts | `PG8` unworked match alert; open collateral request |
| 9 | Budget and determination | Recompute; compare to the case file in both directions; set certification period and reporting type (CA SAR 7, TX streamlined SR1/2/3, NY per Source Book) | 273.10 *(verify)* | 30-day standard | Recompute engine (and PolicyEngine-US when on) | Budgeted vs recomputed vs delta, tolerance line ($58 / $59), over/under direction | `PG9` unresolved delta above tolerance |
| 10 | Pre-issuance gate, second-party review, notice | Gate runs; supervisor second-party review (different identity); draft notice; certify (simulated, nothing leaves the app) | 272.4, 273.10(g) *(verify)* | Adverse action needs advance notice | Notice Drafter (P2, draft only) | Gate list, supervisor sign-off, stamp | `PG10` override without a reason |

**Gate (`packages/snap-rules/gate.ts`, pure).** `evaluate(caseState, flags, runs) → GateItem[]`. Union of: each station's rule above, plus every open flag at review severity or higher, plus clock breaches. The gate never blocks a lawful action: the worker can resolve an item or **override with a typed reason**; overrides are written to `override` and shown to the supervisor and in the debrief. The UI wording is a warning ("Before you certify"), never "denied" or "blocked".

State variants (`data/states.json`): every state is selectable because QC data covers all of them. Full state-manual retrieval loads for CA, TX and NY only; every other state shows "State manual not loaded; federal rules only" next to each citation. Do not fake a state manual.

# 11. Data: QC file, golden cases, documents

**Source.** USDA FNA SNAP Quality Control public-use microdata (the FY2024 file has 44,891 cases; also mirrored at snapqcdata.net). It is de-identified numeric data: **no paystubs, leases, names or narratives.** Download it yourself from the official FNS/FNA site into `data/qc/raw/` (git-ignored). If you cannot download, ask the human to drop it there; meanwhile run on `data/golden/` and badge everything Fixture and log `UNVERIFIED-LIVE: qc-file`. Never invent QC rows.

**Mapping.** Read the official data dictionary first, then write `worker/src/features/qc/column-map.ts` with a unit test per column. Needed concepts (names vary, find them): state, fiscal year/month, household size, earned and unearned income, each deduction, net income, allotment, **both** the state-certified and the QC-verified value for each, error amount and direction, error element, nature, agency/client responsibility, discovery method. Do not guess column names from memory.

**Case builder (`qc/build-case.ts`, seeded).** For a state, draw N cases with a seeded PRNG (`QC_SAMPLE_SEED`), stratified lightly so a queue is not all-clean or all-error but still random: the draw is random, the shuffle button redraws. Output a `CaseFile` (the state-certified values: this is "what is in the case file") and, server-side only, a `CaseTruth` (QC-verified values and the QC error coding).

**Document generator (`docgen/`).** Deterministic, seeded. From `CaseTruth`, render synthetic documents that show the **verified** values: a paystub (choose a frequency by seed, decompose monthly income into a per-period gross; e.g. $2,666 / 2.15 = $1,240), a lease (rent and occupants), a utility bill (heating or cooling charge). Output PNG plus a sidecar JSON of every field's text and **exact bbox** (you control the layout, so bboxes are ground truth). Add mild realism (rotation of 0 to 1.5°, JPEG noise). Badge: **Synthetic**. When the QC error is "unreported income" or anything needing the household or a collateral contact, produce no revealing document: the AI correctly stays quiet and writes a **question to ask** (this is the honest "cannot catch" category and must appear in the queue). Case-file-discoverable errors (pay frequency, rent or utility mismatch, SUA, composition from lease, stale document, arithmetic) get a discrepancy between `CaseFile` and the documents.

**Golden cases (hand-authored, in `packages/contracts/fixtures/` and `data/golden/`, badge Fixture)**
| ID | Story | Numbers |
|---|---|---|
| GC-1 | Pay frequency error (Income) | Paystub 10/01 to 10/14/2026 gross $1,240.00 biweekly; case budgets $1,240 / month; correct $1,240 × 2.15 = $2,666 / month; flag cites the Gross line, page 1; direction over |
| GC-2 | Lease says more rent and more people | Lease rent $1,350, occupants "Maria R., Daniel R."; case rent $1,050, one member. Two flags: shelter (underpayment risk, direction under) and household composition (question for the interview, never an automatic correction) |
| GC-3 | Heating bill, no SUA | Gas heating charge present, case has no SUA applied; direction under |
| GC-4 | Clean case | No discrepancies; the AI says nothing. Proves it does not cry wolf |

GC-1 also carries a conflicting employer statement so the voice demo has a purpose (employer says pay is weekly), and GC-2 carries a landlord call.

**Recompute validation (gate G3).** `snap-rules` must reproduce the QC file's own benefit calculation from the **state-certified** inputs and from the **QC-verified** inputs. Report the match rate (within $1) on a seeded 500-case sample. Do not tune until it looks good: report the true rate in `PROGRESS.md` and show it on `/system`.

# 12. AI roles (Claude) and retrieval (Moss)

**Pattern (as in Vouch).** Agents propose, the rules engine validates, the database enforces, the merit worker decides. Each seat returns schema-validated JSON and never writes to the case. The Desk Lead (`worker/src/features/seats/orchestrator.ts`) is code, not an agent. Unreadable output **fails closed** to `needs_human` (never to a denial). A seat result that contradicts the deterministic engine is shown as "AI and engine disagree" for the worker, not silently resolved.

| Seat | Input | Output (schema in contracts) |
|---|---|---|
| `document_reader` | document image + requested field list | fields: `{name, value, page, bbox:[x,y,w,h] normalized, confidence, text}`; `unable_to_read` |
| `income_analyst` | extracted paystubs + case budget | per-document monthly conversion with arithmetic shown, direction, delta, rule id |
| `shelter_utility_checker` | lease, bills, case deductions | deduction findings, SUA status, direction, delta |
| `household_composition_checker` | lease/doc names + case members | list of **questions to ask**; never a correction |
| `policy_librarian` | flag + Moss passages | a short explanation using **only** the retrieved passages, each with `{source, section, url}` |
| `verification_analyst` | transcript + case values + question plan | per fact: supports / contradicts / inconclusive with turn ids; builds the pre-call question plan |
| `change_report_triage` (P1) | alert list | order and aging; draft actions |
| `qc_projection` (P1) | session flags | narrative only; numbers come from deterministic code |
| `resolution_planner` | open question, dollars at stake, channels, consents | ranked options `{channel, why, est_cost, est_time, draft}` (0.3) |
| `question_writer` | conflicting facts | the plain-language open question |
| `interview_copilot` (P1) | live notes, open questions | next question and follow-ups; never an answer |

**Claude role runner (`worker/src/features/seats/`).** One generic runner: system prompt per role in `seats/prompts/<role>.md`, input as JSON, output validated against the zod schema in contracts with one repair retry, then fail closed to `needs_human`. Use `ANTHROPIC_MODEL_REASONING` for planner and analysts, `ANTHROPIC_MODEL_FAST` for extraction and wording; documents go in as images with bbox output. `AI_MODE=fixture` answers each role from `worker/fixtures/seats/*.json`, **generated from the docgen sidecars** so fixtures carry exact bboxes (badge Fixture). Per-day cap `AI_DAILY_RUN_LIMIT`, per-run `agent_run` row with tokens and ms. A Manaspace adapter (0.1) may implement the same `Adapter` interface later; do not build it until needed.

**Moss adapter (`worker/src/features/policy/`).** Interface `PolicySearch { index(chunks); search(query, k): Promise<{hits, ms, backend}> }`. Implementations: `moss` (live) and `local` (in-process BM25, e.g. `minisearch`, labelled "local fallback"). Moss's quickstart is `createIndex` → `loadIndex` → `query`. Package names conflict across sources (`@inferedge/moss` vs `@moss-dev/moss`, browser WASM `@moss-dev/moss-web`): check docs.moss.dev, pick the current one, and note it in `docs/ARCHITECTURE.md`. Measure and show real retrieval time on every citation ("Moss · 7 ms"). Chunk and index only fetched text from `data/policy/` (7 CFR 273 from eCFR; CA MPP 63, TX Works Handbook, NY SNAP Source Book). Chunk id = `source#section`.

**Recompute (`worker/src/features/recompute/`).** Primary: `packages/snap-rules` engine (fast, deterministic, same code in web for instant what-if). Cross-check: PolicyEngine-US (`POLICYENGINE_MODE=api`); only show "Cross-checked with PolicyEngine-US" when that call actually ran. FY2027 parameters live in `params/fy2027.json` with a `source` per value.

# 13. Voice agent (Deepgram + Anthropic): the Voice Verifier

**Job.** When a documented value conflicts with the case file, or a mandatory verification is missing, the worker clicks "Call employer" or "Call landlord". The agent phones the collateral contact, asks the questions in the question plan, and returns structured facts with the audio timestamp and quote that prove each one. The worker reads, accepts or rejects. 20.46% of variances were found through collateral contacts; this is the product's answer to that bucket.

**Architecture.** Browser ↔ worker WebSocket ↔ Deepgram Voice Agent API (`wss://agent.deepgram.com/v1/agent/converse`, verify in docs). The worker holds `DEEPGRAM_API_KEY` and mints a short-lived signed session for the browser; the browser never sees a key.
- First message after connect: a `Settings` message. `audio` (linear16, 24 kHz in and out); `agent.listen.provider` `{type:'deepgram', model:'nova-3'}`; `agent.think.provider` `{type:'anthropic', model: VOICE_THINK_MODEL}` (Deepgram's managed Anthropic list included `claude-haiku-4-5` and `claude-sonnet-5` when this was checked; BYO Anthropic endpoint with your own key is supported; **check the current supported list**, it is not the same namespace as the Anthropic API model IDs); `agent.think.prompt`; `agent.speak.provider` `{type:'deepgram', model: DEEPGRAM_SPEAK_MODEL}`; `agent.greeting`.
- Tools: define client-side functions `record_fact({field, value, quote})`, `request_human_takeover({reason})`, `end_call({outcome})`. The worker executes them and writes only `call_fact`, `call_event` rows; **no tool touches the case.** If function calling is unavailable for the Anthropic provider, fall back to post-call extraction (Claude structured extraction over the transcript). Event names (`Welcome`, `SettingsApplied`, `ConversationText`, `UserStartedSpeaking`, `AgentStartedSpeaking`, `FunctionCallRequest`, `Error`) per Deepgram docs; verify before coding.
- **Counterpart modes (`VOICE_COUNTERPART`)**: `sim` (default): a second Deepgram agent session with a persona prompt seeded from `CaseTruth` (cooperative, hesitant, wrong-number, refuses-to-disclose); the worker pipes each session's output audio into the other's input (same linear16 24 kHz on both so no resampling). `human`: a teammate opens `/voice/answer/[callId]` and speaks as the employer or landlord. `pstn` (P2): Twilio to numbers on `VOICE_ALLOWED_NUMBERS` only.
- `VOICE_MODE=fixture`: a stored transcript plays back with synthetic waveform animation and the same chips and facts, badge Fixture. Everything downstream is identical, so the whole demo works with zero keys.

**Call flow in the UI.** Pre-call brief (generated by `verification_analyst`): who, why, the 3 to 5 questions, what must not be disclosed. Consent gate: checkbox "Household consent to contact this collateral on file" (the call button stays disabled without it; recorded in `call.consent_by`). Live: dual waveforms, streaming transcript (text is always on, captions by default, also the accessible path), facts lifting off as chips (A8), a **Take over** button (agent stops, the worker speaks or ends), a hard stop at `VOICE_MAX_CALL_SECONDS`. After: outcome (`verified`, `contradicts`, `refused`, `no_answer`, `voicemail`) with the facts and quotes; **Add to case file** is a separate human click; `no_answer` and `refused` suggest sending a written verification request (10-day clock).

**Agent prompt rules (`worker/src/features/voice/prompts.ts`).** Open with: "This is an AI assistant calling on behalf of `<agency>`, a public benefits office. I'm calling to verify employment/rent for an application. Is now a good time? You can ask for a person to call you back at any time." Ask only the planned questions. Never accuse, negotiate, pressure, or discuss anything the household has not consented to share. Never state benefit amounts or program eligibility. Accept "I can't share that" and end politely. Stay under 4 minutes. If the contact asks for a human, call `request_human_takeover`.

**Employer questions:** employment status, hire date, pay frequency, gross per pay period, usual hours, last pay date, expected changes. **Landlord:** monthly rent, lease dates, names on the lease, who pays which utilities, heating/cooling included or not.

Limits: `VOICE_DAILY_CALL_LIMIT` (default 6) enforced in the service layer; `control.voice_enabled` kill switch (off: button reads "Voice verifier offline", worker uses the written-request path).

# 14. Contracts and database schema

**Contracts (`packages/contracts`, zod; the frozen interface between machines).** At minimum:
```ts
type Direction = 'over' | 'under' | 'none';
type Prov = 'live' | 'replay' | 'synthetic' | 'fixture' | 'sandbox';
interface BBox { x: number; y: number; w: number; h: number }          // 0..1, page-relative
interface Extraction { id; docId; field; value; page; bbox: BBox; confidence; seatRunId; prov: Prov }
interface Citation { source; section; url; text; retrievedAt; backend: 'moss' | 'local'; ms: number; verified: boolean }
interface Flag { id; caseId; station: 1|2|3|4|5|6|7|8|9|10; ruleId; title; direction: Direction; deltaMonthly?: number;
  extractionIds: string[]; citations: Citation[]; recompute?: { before: number; after: number; engine: 'snap-rules'|'policyengine' };
  question?: string; status: 'open'|'accepted'|'dismissed'|'questioned'; seat: string; prov: Prov }
interface GateItem { id; rule: `PG${number}`; station; label; severity: 'review'|'warn'; flagId?: string; resolved: boolean; override?: { reason: string; by: string } }
interface CallFact { id; callId; field; value; quote; turnIds: string[]; tStart: number; tEnd: number; confidence; status: 'pending'|'accepted'|'rejected' }
interface CaseFile { /* state-certified values only; never includes truth */ }
```
`CaseTruth` is not in contracts that web imports: it lives only in `worker/src/core/truth.ts`.

**Tables** (each created by its feature's `db/migrations/<feature>/`): **`qc_history` (the main table, 0.2)**, `state_profile` (view over `qc_history`), `shift`, `case_state`, `doc` (media path, sidecar), `fact`, `open_question`, `resolution_plan`, `outreach`, `household_upload`, `extraction`, `flag`, `citation`, `step_state`, `override`, `agent_run` (role, mode, status, tokens, ms), `call`, `call_turn`, `call_fact`, `call_event`, `decision` (human certification, simulated), `review` (supervisor), `control` (`ai_enabled`, `moss_enabled`, `voice_enabled`), `audit_log` (append-only by trigger), `limits` (daily counters). `case_truth` is never a table the API can return: it is read only by `truth.ts`.

**Identities and rules (`worker/src/core/authz.ts`).** Server identity `ai` (appends `fact`, `extraction`, `flag`, `citation`, `agent_run`, `resolution_plan`, `call_*`, drafts) and browser roles `worker` / `supervisor` picked by `DEMO_WORKER_CODE` / `DEMO_SUPERVISOR_CODE`. Enforced in the service layer: only a human role can accept a flag or fact, approve outreach, override, or certify; **`review` requires a supervisor different from the certifier** (segregation of duties); the `ai` identity cannot call any human function; every mutation appends `audit_log`; rate limits and kill switches are checked server-side. Unit tests prove each rule.

# 15. Backend templates

**Adapter template (`worker/src/features/_template/adapter.ts`, copy for every integration).**
```ts
export type Mode = 'fixture' | 'live';
export interface Adapter<I, O> {
  name: string;
  mode(): Mode;                       // from env, default 'fixture'
  available(): boolean;               // keys present, daily limit not hit, kill switch on
  run(input: I): Promise<{ output: O; prov: Prov; ms: number; costNote?: string }>;
}
// fixtureRun() reads worker/fixtures/<name>/*.json; liveRun() calls the vendor;
// parse() fails closed to { status: 'needs_human' }, never to a decision.
```
**Worker routes (Hono).** `GET /health`, `GET /status` (every adapter: mode, available, last run), `GET /events` (SSE), `GET /cases`, `POST /shift`, `POST /seats/run`, `GET /ledger/:caseId`, `POST /planner/plan`, `POST /outreach/:id/approve`, `GET|POST /upload/:token` (household photo), `GET /policy/search`, `POST /recompute`, `GET /docs/:id` (signed media), `POST /voice/session`, `WS /voice/ws/:callId`, `POST /voice/answer/:callId` (human counterpart), `POST /eval/run`. Each feature mounts its own routes in `register(app)`.
**Fixtures first.** Every adapter ships with fixture mode before live mode; the demo must pass end to end in fixture before any live key is tried.

# 16. `.env.example` (generate from `env/<feature>.env`; names only, never values)

See `env/*.env` in the repo; the generated `.env.example` is the canonical list. (The original prompt's full variable list was transcribed into those fragments at scaffold time.)

`scripts/env-check.ts` prints, per integration, `ok | fixture | missing-key | UNVERIFIED-LIVE` and exits 0 in all cases except a secret found in `web/`.

# 17. Scripts, checks, hello scripts

`feature:start`, `feature:list`, `sync`, `check:ownership`, `check:rules`, `check:badges`, `env:build`, `env:check`, `dev-ports`, `db:build|db:migrate|db:reset`, `qc:ingest`, `qc:sample`, `policy:fetch`, `policy:index`, `eval`. Smoke scripts: `hello:db`, `hello:claude`, `hello:moss`, `hello:deepgram` (opens a session, sends `Settings` with the Anthropic think provider, asks one question, prints the transcript), `hello:policyengine`. Each prints a result and, on missing keys, the `UNVERIFIED-LIVE` line instead of failing.

# 18. Gates and tests (tick only with evidence in `PROGRESS.md`)

| Gate | Pass condition |
|---|---|
| G0 | `npm run check` green on a fresh clone; every route 200 in fixture mode; `scaffold-v1` tagged |
| G1 | Homepage complete (section 8 acceptance) with screenshots at 1440 and 390 |
| G2 | **Golden path in fixture mode**: choose state → queue → open GC-1 → autofill → flag with Proof Thread → accept → skip a station → Certify triggers the gate (Skip Tether) → resolve or override → Stamp → debrief |
| G3 | Rules: unit tests per station rule; frequency conversion; engine reproduces QC benefit on a 500-case sample with the **measured** match rate recorded |
| G4 | QC pipeline: real file ingested (or `UNVERIFIED-LIVE`), 8-case queue per state, docgen deterministic (same seed, same bytes), truth never in a client response or SSE stream (test) |
| G5 | Seats: all run in fixture; each live seat run once and the real response saved as a fixture (or `UNVERIFIED-LIVE`); fail-closed parse tests |
| G6 | Voice: full `sim` call in fixture; live `sim` call when keys exist; consent gate, takeover, kill switch and call limit tested; nothing writes to the case without Accept |
| G7 | Dashboard and replay: Ledger Beam, projection with interval, both-direction bars, the synthetic-documents caveat visible |
| G8 | Polish: reduced-motion pass, keyboard pass, Lighthouse, 390 px, no console errors, `check` green on `main` from a clean clone |

Also required: a test that region and agency do not change any flag (detectors use behavior only), and a test that no UI string contains a banned word.

# 19. Priorities and the 3-minute demo

**P0** homepage; golden path G2; QC replay queue; ten stations working in fixture; Proof Thread; gate with Skip Tether; Stamp; voice `sim` call (fixture, live if keys); `/system`.
**P1** live Claude roles; Moss live; PolicyEngine cross-check; debrief Truth Envelope with measured matches, misses and false flags; dashboard; `human` voice counterpart.
**P2** Twilio PSTN to team phones; Notice Drafter; Change-Report Triage; interview scribe; Spanish toggle; Factory Droid Rule Lab.

**Demo script (3 minutes).** 0:00 home hero, "Check the case before the benefit goes out", scroll the Pass and the Stamp (30 s) → 0:30 cost-share clock and "where the answer lives" (20 s) → 0:50 `/demo` pick a state, Start shift (10 s) → 1:00 open a case, autofill, flag, Proof Thread with the Moss passage and the recompute (40 s) → 1:40 the employer conflict, Call employer, watch facts fly into the case, Accept (40 s) → 2:20 skip a station on purpose, Certify, the tether pulls the worker back, resolve, Stamp (25 s) → 2:45 debrief envelope, say what it does not claim (15 s).

Now begin Phase 0 (section 6). Do not ask questions you can answer from this prompt. Log anything unverifiable. After `scaffold-v1`, build the homepage.

# 20. Feature session preamble (paste at the start of every later session, either machine)

```
You are working on feature `<slug>` for Stampy on machine `<a|b>`.
1. Run `npm run sync`. Read AGENTS.md, OWNERS.md and .features/<slug>.md.
2. Work only inside the paths in your claim file. If you need a change anywhere else, stop and write it under "Needs from the other machine" in your claim file and in status/<machine>.md, then continue with fixtures. Do not edit frozen hot files except through an infra/ or contract/ PR (<150 lines).
3. Build against packages/contracts and fixtures. Never wait on the other machine. Never import across feature boundaries except through packages/contracts and packages/snap-rules.
4. Every integration gets fixture mode first. Never stop for a missing key; log UNVERIFIED-LIVE.
5. Respect AGENTS.md hard rules: badges on every number, never deny, both directions, no invented numbers or policy text, no keys in web/.
6. Before every commit: `npm run check:ownership && npm run check`. Commit one-line messages. Push often. Open a PR under 400 lines; squash-merge after `npm run sync && npm run check`.
7. Update PROGRESS.md gates only with evidence (screenshot path, test name, command output).
```

# 21. Machine B kickoff (paste after `scaffold-v1` exists)

```
Clone the repo, create .env.local (MACHINE=b, SLOT=1), run `npm i && npm run sync`. Read AGENTS.md, OWNERS.md, sections 0 and 11 to 14 of docs/MASTER_PROMPT.md.
You are the Brain. Claim features in this order and build each against packages/contracts:
1. rules (packages/snap-rules): frequency, deductions, budget, gate, params/fy2027.json with a source per value. Tests first.
2. qc-data: ingest the USDA QC public-use file, column-map with the real data dictionary, seeded case builder, docgen with exact bbox sidecars. Golden cases stay authoritative until the file is ingested.
3. seats: adapter template, orchestrator, fixtures generated from docgen sidecars, then live Claude roles.
4. policy: fetch eCFR 7 CFR 273 and the CA, TX and NY manuals, chunk, index in Moss (live) and local BM25 (fallback), citation verification file.
5. voice-engine: Deepgram Voice Agent session with Anthropic think provider, sim counterpart, tools, call_* tables, limits, kill switch.
6. db-core (migrations, authz, audit, truth), ledger (fact table, conflict detector), planner (resolution planner, outreach), eval, ops as needed. Build order for the loop: ledger then planner then recompute write-back.
Machine A (the Face) is building the homepage and the web routes against fixtures right now. Do not touch web/. Ping through status/b.md.
```
