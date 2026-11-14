# PROGRESS

Tick a gate only with evidence (test name, screenshot path, command output). Each machine edits only its own gate rows.

| Gate | Owner | Status | Evidence |
|---|---|---|---|
| G0 scaffold | A | done | `npm run check` green (typecheck, 34 unit tests, check:rules, check:badges, check:ownership); `npx playwright test` 20/20 (`e2e/smoke.spec.ts`, 10 routes × 1440 and 390, footer + runtime badge check, no console errors); tag `scaffold-v1` |
| G1 homepage | A | in review (branch a/home, on infra/stampy-rebrand) | `e2e/home/home.spec.ts`: 1440 conveyor hero + 5 scroll holds + walkthrough reaches the $2,666 recompute; 390 static with no horizontal scroll; reduced motion static (no cursor); keyboard reaches CTA. Shots: `e2e/home/shots/home-1440-hero.png`, `home-1440-walkthrough.png`, `home-1440-full.png`, `home-390-full.png`. Not yet measured: Lighthouse |
| G2 golden path (fixture) | A + B | open | |
| G3 rules + recompute match rate | B | open | match rate: not measured |
| G4 QC pipeline | B | open | qc_history = 4 golden rows; QC file not ingested |
| G5 seats | B | open | |
| G6 voice | B + A | open | |
| G7 dashboard + replay | A + B | open | |
| G8 polish | A | open | |

## UNVERIFIED-LIVE

- UNVERIFIED-LIVE: qc-file: drop the USDA QC public-use file in data/qc/raw/, then `npm run qc:ingest`
- UNVERIFIED-LIVE: anthropic: `npm run hello:claude`
- UNVERIFIED-LIVE: moss: `npm run hello:moss` (client package not chosen yet)
- UNVERIFIED-LIVE: deepgram: `npm run hello:deepgram`
- UNVERIFIED-LIVE: policyengine: `npm run hello:policyengine`
- UNVERIFIED-LIVE: messaging, email: fixture only
- Manaspace/Manus: not built; confirm the product with the human first

## Open `<fill in>` items

- Event name and deadline (master prompt section 1)
- Per-state FY2025 PER table and URL (`data/states.json`)
- Every source `href` in `data/sources.json`
- FY2027 parameters other than tolerance (`packages/snap-rules/params/fy2027.json`)
- CFR verification (`data/policy/citations.json`, all `verified: false`)
