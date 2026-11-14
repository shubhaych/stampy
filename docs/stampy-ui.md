# Frontend integration and backend audit

Integration base: `origin/b/stampy-loop` at `439a80b`. Frontend branch: `a/stampy-ui`.

## Implemented frontend

- Loaded case queue: name/reference search, state and stage filtering, empty/error states and manual refresh.
- Next worker step derives from actual document, question, outreach, calculation and decision rows.
- Existing worker endpoints remain the integration boundary: upload, reader retry, outreach approval, simulated call/reply, recompute and worker decision. No API keys enter web.
- Full case/queue responses validated using shared Zod contracts; legacy scaffold responses produce an actionable incompatibility error.
- Refetch on SSE reconnect; ignore older overlapping responses. Failed refresh prevents decision/outreach actions on the stale snapshot.
- Source provenance remains Synthetic when live AI processes generated documents. Fixture preview never displays Live evidence.
- Decision controls require completed reads, closed questions and non-null benefit calculations. This frontend gate is not a substitute for worker enforcement.
- Phone evidence links to call transcripts; question links no longer nest inside evidence buttons. Retry is exposed for failed request emails.
- Required footer restored on the touched queue, case and source pages. Other inherited pages still need the original footer requirement restored through the owning feature.

## Backend findings

| Capability | Evidence in selected branch | Verification |
| --- | --- | --- |
| Claude document reading | `worker/src/reader/reader.ts`: image/PDF input, structured extraction, persisted facts and source lines | Implemented; live API run not performed |
| Voice | `worker/src/voice/call.ts`, `vapi.ts`: inbound applicant call, Deepgram → Anthropic → ElevenLabs, verification, transcript and answers | Implemented; live call not performed |
| Email | AgentMail request approval, inbound attachment extraction | Implemented; no email sent during this work |
| Calculation | `worker/src/rules/benefit.ts`, local PolicyEngine service | Implemented; service unavailable in this session |
| Public QC ingest | No importer or QC replay API in this selected backend; raw QC directory contains only `.gitkeep` | Not implemented |
| Database | `worker/src/db.ts` uses Postgres; case summaries come from `app_case` | Selected worker not running locally |

Port 8787 responds with the older scaffold's `{ok:true,machine:"a",slot:0,mode:"fixture"}` health payload. No Postgres/Docker executable or PolicyEngine service was available in this environment. The selected checkout has no `.env.local`; no secrets were copied or printed.

The backend automatically sends checklist messages when AUTO_SEND_CHECKLIST is enabled and computes from resolved evidence without a human fact-acceptance endpoint. These differ from the supplied rules requiring approval for each outreach and accepted facts only. The frontend cannot repair those service-layer guarantees. They are recorded in the feature claim for Machine B.

## Data proof and limitations

Verified public catalog: https://snapqcdata.net/datafiles
The catalog links FY2024 CSV release https://snapqcdata.net/sites/default/files/2026-08/qcfy2024_csv.zip and its dictionary https://snapqcdata.net/sites/default/files/2026-08/FY-2024-Tech-Doc.pdf . It identifies an August 2026 weighting revision. Direct archive acquisition returned HTTP 403 after an initial sandbox DNS failure. No source rows or checksum were obtained, so no purported real-case examples are supplied.

Existing local examples in `data/samples/index.json` are explicitly generated: `application-form`, `paystub-2026-09`, `lease`, `paystub-2026-10-photo`. Their sidecars mark `synthetic:true`. They are not downloaded applicant records or proof of a QC import. The static frontend fixture and generated sample images also differ in employer/date details, so the fixture viewer does not substitute those images for absent matching source images.

ERS policy data (https://ers.usda.gov/data-products/snap-policy-data-sets) covers historical state policy choices through December 2020; it is not current benefit parameters. eCFR 273.2(e)(2) permits telephone interviewing under the specified conditions; the interview remains a worker task. No policy text or new eligibility rule was added to the UI.

## Validation

- `npm run typecheck`: passed.
- `npm test`: 56 tests passed, including API incompatibility, malformed response handling, provenance and decision gating.
- `npm run check:rules`, `check:badges`: passed on this branch's existing checker implementations.
- `E2E_PORT=3104 npx playwright test e2e/stampy-ui`: 6 passed; desktop and mobile filters, incompatible backend, sign-in → approve outreach → updated evidence → approve change; fixture provenance and viewport checks.
- Browser worker responses were mocked to the shared contract. These are frontend integration tests, not proof that external providers or Postgres ran.
- Screenshots: `e2e/stampy-ui/desktop-case.png`, `mobile-case.png`.
- `npm run check`: fails only at ownership because the checker compares with main and counts all inherited stampy-loop rebuild changes. No check bypass, commit or push was performed.
- `npm run sync` was attempted in the original checkout and blocked by sandbox IPC/Git writes. Fetch succeeded with escalation; rebasing the selected backend rebuild onto main was not attempted as part of frontend work.

UNVERIFIED-LIVE: anthropic: npm run demo:run
UNVERIFIED-LIVE: voice: npm run demo:run
UNVERIFIED-LIVE: policyengine: npm run hello:policyengine
UNVERIFIED-LIVE: qc: public FY2024 archive acquisition returned HTTP 403
