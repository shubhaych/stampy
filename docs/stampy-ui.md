# Evidence desk and real public QC ingestion

The user-selected backend baseline and first frontend pass were published to main as `fadbe85`. The follow-up replaces the stacked case cards with a task rail, central source/task workspace, and a tabbed review rail.

## Real data

The reproducible importer `node --import tsx scripts/qc-ingest.ts` downloads the official FY2024 release. The host returned 403 for curl's default User-Agent; a browser-compatible, explicitly named importer User-Agent succeeds without credentials or cookies. A fresh download and a repeat import succeeded.

- 44,891 records; 1,177 source columns; 53 jurisdictions.
- Raw ZIP and CSV and the validated public index are stored locally under gitignored `data/qc/raw/`.
- Download size, release hashes, CSV structure, missing values, unique IDs, and exact row count are checked before promotion. Stored index hash is checked before serving it.
- The worker serves an allowlist of public ID, jurisdiction, sample month, certified household size, reported certified benefit and source-row index.
- Income/error fields and constructed QC outcomes are not exposed to the frontend or AI. Public records are read-only historical replays, not operational applicant cases. No applicant documents are fabricated.
- `data/qc/manifest.json` records source URLs and checksums; `examples.json` stores genuine CA/TX/NY examples for tests and inspection.

| State | Public HHLDNO | Sample month | Certified household size | Reported certified benefit | Source record |
| --- | --- | --- | --- | --- | --- |
| CA | 47737 | 2024-01 | 1 | $158 | 39377 |
| TX | 37840 | 2023-10 | 2 | $535 | 31251 |
| NY | 4118 | 2023-10 | 1 | $291 | 3475 |

Source: https://snapqcdata.net/datafiles . See `data/qc/README.md` for the verified dictionary mapping and acquisition details. These are Replay values, not live applicant records.

## UI

- Left: concise worker tasks and source list. AI extraction is distinct from worker review.
- Center: remaining tasks until a source is selected; then image, PDF, transcript or budget. Existing static fixture images are absent, so its recorded quotes are labeled a fixture transcript instead of substituting a mismatched image.
- Right: Guide / Issues / Fields / History. Guidance and document retry use existing worker APIs. Outreach and final changes still require worker clicks.
- Selecting a field or question opens its source; selecting a source region reveals the field. Selection persists while navigating tabs. PDF page navigation and missing/low-confidence bounding-box fallbacks are explicit.
- Mobile: Tasks / Source / Review switches replace a stack of long panes. Reduced-motion settings are respected.
- `/cases/qc`: actual imported records, state filter, pagination, original columns, source record number and checksums. `/cases/sources` checks import availability dynamically.

## Run

```sh
node --import tsx scripts/qc-ingest.ts
node --import tsx worker/src/qc/server.ts
npm run dev -w web -- --port 3104
```

The public QC server binds loopback port 8791. The web's read-only same-origin proxy uses `QC_WORKER_URL`, default `http://localhost:8791`. The main application worker also registers the QC routes; deployments can point that variable at it. The web never opens the data files or database.

## Validation and limits

- `npm run check`: green; typecheck, 63 unit tests, rules, badges, ownership.
- `E2E_PORT=3104 npx playwright test e2e/stampy-ui`: 10 passed, including actual imported QC records on desktop/mobile and source-to-field navigation.
- QC browser tests use the real imported worker data. Application decision/outreach browser tests mock provider/backend responses; no messages or calls were sent.
- Screenshots: `e2e/stampy-ui/{desktop,mobile}-{case,qc}.png`.
- The public snapshot is file-backed in the worker, not inserted into Postgres `app_case`. It cannot trigger outreach or decisions.
- Live Anthropic/Vapi/AgentMail and the Postgres/PolicyEngine application loop have not been rerun here. Existing backend checklist auto-send and missing human fact-acceptance endpoint remain separate service-layer gaps.

## Design research

The three-pane pattern follows [ServiceNow document review](https://www.servicenow.com/docs/r/customer-service-management/csm-doc-intel-review-values.html?contentId=AJkrKXJko~BrCttVeuWKmg). Concise task rows and restrained states follow [GOV.UK](https://design-system.service.gov.uk/components/task-list/) and [Scottish Government task-list research](https://designsystem.gov.scot/patterns/task-list). Source-linked review follows [GitHub review](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/reviewing-proposed-changes-in-a-pull-request?tool=codespaces); density uses [Linear display options](https://linear.app/docs/display-options) as a reference. These support design choices, not claims of measured SNAP productivity.
