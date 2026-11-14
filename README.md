# Stampy

A document-grounded second check before SNAP benefits go out. AI roles read the case file and flag what does not match, with the source line and the rule; a deterministic engine recomputes; a voice agent verifies with employers and landlords; **a merit-staff worker decides everything.** Not an eligibility system.

Spec: [docs/MASTER_PROMPT.md](docs/MASTER_PROMPT.md). Agent rules: [AGENTS.md](AGENTS.md). Who owns what: [OWNERS.md](OWNERS.md). Gates: [PROGRESS.md](PROGRESS.md).

## Quick start

```bash
nvm use                 # Node 22+
npm install
npm run pe:setup        # PolicyEngine-US in a Python 3.12 venv (uv), once
npm run samples         # synthetic demo documents into data/samples (already committed)
npm run dev             # Postgres (docker) + PolicyEngine :8790 + worker :8787 + web :3000 + ngrok tunnel
npm run live:setup      # once: AgentMail inbox + free Vapi number pointed at the tunnel
```

Runs with zero keys (every integration falls back to fixture mode). Keys in `.env.local`: `ANTHROPIC_API_KEY`, `AGENTMAIL_API_KEY`, `VAPI_PRIVATE_API_KEY`, `DEEPGRAM_API_KEY`, `ELEVENLABS_API_KEY`, `NGROK_AUTHTOKEN`, plus `STAMPY_WEBHOOK_SECRET`.

## The demo loop

1. Applicant applies at `/apply` (application form, paystub, lease). Claude vision reads each document into the evidence ledger, every fact cited to page and line.
2. The deterministic conflict detector opens open questions (form says monthly, paystub says biweekly; newest paystub is stale) with the benefit at stake from PolicyEngine.
3. The caseworker approves the drafted request email at `/cases/<id>`; AgentMail sends it with the reference number and the call-in line.
4. The applicant calls the Vapi number whenever it suits them. The assistant (Deepgram → Claude → ElevenLabs) discloses it is an AI, finds the case by reference number, asks only the open phone questions and records answers as facts.
5. When the call ends, the checklist email goes out in the same thread; the applicant replies with a photo. Claude reads the attachment, questions close.
6. PolicyEngine-US recomputes the benefit from resolved evidence; the caseworker approves or rejects. Nothing changes a case without that click.

`npm run demo:run` rehearses steps 1 to 6 live (replaying the call through the public webhook) and stops before the decision.

## Layout

| Path | What |
|---|---|
| `packages/contracts` | zod schemas + golden fixtures. The only shared types. Frozen after `scaffold-v1`. |
| `packages/snap-rules` | Pure TS: ten stations, frequency conversion, budget, gate. |
| `db/` | Postgres migrations (`migrations/NNNN_name.sql`); `fact` and `audit_log` are append-only by trigger. |
| `worker/` | Hono on Node: REST + SSE + Vapi/AgentMail webhooks; `ledger/` (facts, detector), `reader/` (Claude vision), `email/`, `voice/`, `rules/` (PolicyEngine), `pipeline.ts`. |\n| `services/policyengine` | Local PolicyEngine-US SNAP service (stdlib HTTP). |
| `web/` | Next.js 16 App Router. Talks to the worker through `web/lib/data` only. |
| `scripts/` | sync, checks, feature claims, env, db, hello-* smoke scripts. |
| `e2e/` | Playwright smoke (every route, footer, badges). |

## Two machines

```bash
npm run feature:start -- a home     # branch a/home, worktree ../stampy-wt/a-home, claim file pushed
npm run feature:list                # who is doing what
npm run sync                        # before work and before every push
npm run check                       # typecheck, tests, check:rules, check:badges, check:ownership
```
