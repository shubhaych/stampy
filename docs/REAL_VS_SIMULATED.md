# What is real and what is simulated

| Thing | Status | Badge |
|---|---|---|
| QC case values | From the USDA QC public-use file once ingested; golden hand-authored cases until then | Replay / Fixture |
| Paystubs, leases, bills | Synthetic, generated from QC-verified values. A catch on a replay case demonstrates the pipeline, not a detection rate | Synthetic |
| Employer and landlord calls | Simulated counterpart (persona) or a teammate; never a real employer | Synthetic |
| Household texts and uploads | Shown in the demo, sent only to team numbers in live mode | Fixture / Live |
| Certification | Simulated; nothing leaves the app | n/a |
| National figures on the homepage | From the facts ledger (master prompt section 3) with source chips | Replay / Fixture |
| Per-state PER | Not loaded; renders "n/a" until sourced | Replay |
