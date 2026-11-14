# CleanCase: VC-Grade Deep Dive on a Pre-Issuance SNAP Payment-Accuracy Layer

CleanCase is worth building as a company. The pitch should not be "AI catches fraud." It should be "a document-grounded second check before benefits go out, aimed at the agency-caused income and deduction errors that make up most error dollars." There is also a timing point you need to get right. The FY2028 cost share is already locked to periods that have closed: FY2025 has been published and FY2026 ended September 30, 2026. Under the statute, FY2029 and later use the rate from three years earlier, so **FY2027, the period being sampled right now, sets each state's FY2030 cost share.** Pitch it that way to states.

## TL;DR

- **The market is real and states are buying now.** The FY2025 national payment error rate was 10.62% ($10.1B; 9.28% over, 1.33% under). In FY2023, agency-caused errors made up 6.65 of the 11.68 points of dollar error. Income variances were 55.5% of all variances, and 44.5% of variances were discoverable from the case file alone. States are already contracting: Florida's FY2026-27 budget gave DCF $4M to "competitively procure a vendor to provide an electronic data analytics solution" using "machine learning" (Newsweek). West Virginia made an $876,259 emergency purchase of SAS Payment Integrity for Food Assistance (West Virginia Watch), and Nevada also picked SAS. Pennsylvania hired Nava, and North Carolina won $1.75M to flag "missing, duplicated, or inconsistent evidence." Maximus has launched an "accuracy assistant." You are entering an emerging category, not creating one.
- **Build Vouch's architecture again, mapped onto SNAP's legal constraints.** Only state merit staff may determine eligibility (7 CFR 272.4), and FNA's AI framework says agencies should stop using AI whose outputs are "accepted without appropriate scrutiny." So CleanCase flags and cites, a deterministic rules engine (PolicyEngine-US) recomputes, and a merit worker decides. Moss is almost certainly the "MOSS" you mean (moss.dev, a sub-10 ms semantic search runtime); use it for policy-manual retrieval. CREAO runs the named analyst seats over its run API with webhooks. Keep CRS (credit-bureau identity data) out of eligibility decisions entirely; at most, show it as a labeled, sandbox-only step-up identity signal.
- **Go-to-market:** start with free shadow-mode replays on closed QC cases or the public QC file, then a sub-threshold pilot or a subcontract under an incumbent or civic-tech prime. Fund it with FNA grants: Process and Technology Improvement Grants (up to $2M, and nonprofits can lead with a state letter) and the $38M Earnings Verification Support grants. Plan for 9 to 18 months to first real revenue, at $250K to $2M per state per year.

## Key Findings

1. **Error dollars come mostly from agency-side income and deduction work, and most of it happens at certification.** Detail from the FY2023 QC Annual Report (national, published September 2025):
   - Income caused 55.50% of variances and deductions 16.62%; non-financial items (including household composition) were 12.94%, "other" (arithmetic computation, reporting) 14.01%, and resources 0.92%.
   - Agencies caused 56.98% of variances, rising to 81.99% of underpayment variances.
   - 63.97% of variances occurred at or before the most recent certification; 35.09% occurred after it.
2. **About half of errors are document-visible, and the rest need people.** 44.54% of variances were found in the case file, 35.00% from the household, and 20.46% through collateral contacts. A document-reading AI can realistically address the first bucket and part of the third. The household bucket needs interviews.
3. **The tolerance threshold sets the floor for what counts.** Errors of $58 or less (FY2026; $59 in FY2027) are excluded from the PER unless the household was ineligible, but every error must still be reported. Calibrate CleanCase to flag dollar deltas above the threshold first.
4. **Independent research backs the core design.** A November 2, 2026 NYU simulation on public QC data found that risk-based review alone costs "about seven times as much as combining AI flags with risk scores."
5. **Regulators allow this, with conditions.** FNA's advanced-automation guidance treats any shift of merit-staff functions as a "major change" requiring FNA notice or approval. In Michigan, the ACLU sent a public-records request on July 30, 2026 asking whether the state's Vertex AI case reader got FNA approval before launch. Expect the same scrutiny.

## 1) How SNAP Is Applied For: End-to-End Workflow

**Federal skeleton (7 CFR 273.2)**, with the actors in bold.

| # | Step | Actors | Federal rule / clock | Where documents stick and data is re-keyed |
|---|---|---|---|---|
| 1 | **File application.** Online portal, paper, phone, in person, community partner (food bank, navigator), or an integrated Medicaid/SNAP/TANF application. A valid filing needs only name, address and signature, which starts the clock. | Household, partner | Filing date starts the 30-day and 7-day clocks | Paper and faxed applications are scanned and indexed by hand. Duplicate applications pile up when households get no confirmation (FNA listening sessions). RI's 40-page application is written at a 10th–12th grade level, and its online form prefilled "No." |
| 2 | **Expedited screening.** Very low income or resources, or shelter costs above income. | Intake worker | Benefits by the **7th calendar day**. Identity must be verified; other verification can be postponed. | Screening is missed, and the 7-day clock restarts from discovery |
| 3 | **Interview.** Phone or in person, conducted by merit staff. | Caseworker (merit staff) | Scheduled so benefits arrive within 30 days. A missed interview triggers a Notice of Missed Interview, and the agency can't deny before day 30. | Workers retype interview answers into the eligibility system. Massachusetts DTA is piloting AI transcription with summaries the worker edits and saves to BEACON. |
| 4 | **Verification request** (pending-verification notice). | Caseworker, household | At least **10 days** to provide documents | Uploads land in a document repository unlinked to data fields. Workers rekey paystub and lease amounts by hand, which is where CleanCase fits. |
| 5 | **Mandatory verification.** Gross non-exempt income, identity, alien status, SSN, residency, disability where relevant, utility expenses or SUA eligibility, medical costs claimed, and household composition when questionable (7 CFR 273.2(f)). | Caseworker | Before certification | Shelter and utility proofs are often missing or stale |
| 6 | **Data matches.** IEVS (7 CFR 272.8): SSA benefit data, state wage records (SWICA), unemployment insurance, IRS unearned income (FTI). Also SAVE for non-citizens, prisoner and death matches, the National Accuracy Clearinghouse for duplicate participation, and commercial third-party income databases (TPIDs) such as Equifax's The Work Number. NDNH access varies. *(Match list is from domain knowledge and was not re-verified in this pass. Confirm per state.)* | System, caseworker | Matches must be acted on | Alerts go into worker queues and age there. "Agency failed to follow up" is a coded QC cause. |
| 7 | **Determination and benefit calculation.** The eligibility system computes the benefit; the worker certifies. | Caseworker, sometimes **supervisor** second-party review | 30-day standard | Wrong pay-frequency conversion, wrong utility standard, stale deductions |
| 8 | **Notice of eligibility or denial** | System, worker | Adverse actions need advance notice | QC can cite unclear notices that don't match the case record; NM QC treats such cases as errors even when the denial was correct |
| 9 | **Certification period.** Usually 6–12 months; up to 24 months for elderly/disabled households; up to 36 months under elderly simplified application projects (ESAP). | — | — | Long periods let unreported changes build up. RI is moving ESAP households from 36 to 24 months. |
| 10 | **Mid-period reporting.** Under simplified reporting, a household reports when income exceeds 130% FPL and files a periodic report around month 6. Change reporters report within 10 days. | Household, worker | Agency must act on reported changes | Change reports get mistaken for new applications (USDR). Interim reports with no changes are common, and real changes go unactioned. |
| 11 | **Recertification.** New application and interview. | Household, worker | Before the period ends | Same rekeying as intake |
| 12 | **QC sample.** State QC re-verifies through documents, household contact and collateral contacts; FNA re-reviews a subsample. | **State QC reviewer**, **FNA federal reviewer** | Monthly sample, annual PER around June | Results lag 6–12 months; RI's consultant says the "full effect often takes six to twelve months to appear" |
| 13 | **Corrective action and liability.** CAP required at a PER of 6% or more. From FY2028, cost share applies. | **State SNAP director**, budget office, FNA hub | — | — |

**State variations (primary documents):**

- **California CalFresh** (county-administered, 58 counties). Application form CF 285 (cdss.ca.gov/Portals/9/FMUForms/A-D/CF285.pdf); policy in MPP Division 63. Every CalFresh household has been on **Semi-Annual Reporting** since June 1, 2016, with the **SAR 7** due by the 5th of the submit month. Elderly/disabled households with no earnings (SARA) submit at 12 months, and ESAP households file no SAR 7 during their 36-month certification. County variation is the main pain point: each county runs its own intake and QA.
- **Texas** (state-administered, HHSC). Form H1010 "Texas Works Application for Assistance – Your Texas Benefits"; policy in the Texas Works Handbook (fhb.hhs.texas.gov). Texas calls its version **"streamlined reporting"** (TWH A-2350) and sets three tiers: SR 1 is under 130% FPL, SR 2 is 130–165% FPL, and SR 3 is not subject to streamlined reporting. Texas posted a 6.70% PER in FY2023, and its underpayment rate (2.15%) is unusually high. CleanCase's "accuracy in both directions" story suits Texas well.
- **New York** (county-administered through local districts, with NYC HRA as the largest). Application LDSS-4826 (otda.ny.gov/programs/applications/4826.pdf); policy in the SNAP Source Book, revised July 2025 (otda.ny.gov/programs/snap/SNAPSB.pdf). FY2025 PER was 13.18%.
- **Rhode Island**, the lesson to pitch with. In 2014 RI switched from caseload-based to task-based processing, and its PER fell to 3.91% in 2015 and 1.24% in early 2016. The new RIBridges system then disrupted operations and the PER peaked at 21.04% in 2019. The takeaway: process and system changes swing PER by 10+ points either way.

## 2) Where the Errors Come From

**Ranked error sources (best available data; note the dates):**

| Rank | Source | Best figure | Data age |
|---|---|---|---|
| 1 | **Earned income (wages and salaries)**: miscounted pay frequency, missing paystubs, unactioned job changes | Income was 55.50% of national variances (59.25% of overpayments). In NM, wages and salaries were 33–38% of error dollars across FFY2024 editions. RI and KY rank it #1. | FY2023 national; FFY2024 state |
| 2 | **Shelter and utility deductions**: rent, SUA eligibility, homeless deduction | Deductions were 16.62% of variances overall and **30.70% of underpayment variances**. RI ranks shelter #2, and KY ranks it in its top two. OBBBA §10103 limits the SUA for non-elderly/non-disabled households without heating/cooling costs, which adds new error risk. | FY2023; RI FFY2024 |
| 3 | **Household composition and other non-financial** | Non-financial was 12.94% overall but **25.07% of underpayment variances**. RI ranks household composition #3. | FY2023 |
| 4 | **Computation, reporting and "other"** | 14.01%. In Colorado's FY2024 QC cases, 7 of the computation-coded findings were 4 improperly prorated first months, 2 computation errors and 1 omitted homeless shelter deduction (Axiom Foundation). | FY2023; FY2024 |
| 5 | **Resources** | 0.92%. Ignore for MVP. | FY2023 |

**Agency vs. client:** agencies caused 56.98% of variances and **6.65 of 11.68 dollar-error points**. Clients caused 42.21% (4.93 points). Underpayments are 82% agency-caused. In FY2023, $9.04B was overissued and $1.48B underissued out of $90.06B in benefits.

**Variance definition (QC report):** a variance happens when "information verified by the QC reviewer differs from information used at the time of the most recent certification action," when policy is misapplied, or when the basis of an issuance is wrong. All error dollars are assigned to the first coded variance.

**Tolerance and technical errors:** the FY2026 threshold is $58 (QC Policy Memo 25-04) and FY2027 is $59. It is indexed to the Thrifty Food Plan. The House had proposed $0, but the enacted law kept the threshold (CRS R48552). A GAO analysis of FY2013 found sub-threshold errors were 38% of misspent dollars, so a future zero-tolerance push would widen CleanCase's addressable error pool. *I did not re-verify the 2022 "technical error" change in this pass. Treat it as from your prior research and confirm it in the FNS QC Handbook (FNS 310).*

**State corrective-action examples:**

- **States in liability for FY2023**, which had to cut error rates: Alaska ($11.9M), Delaware ($3.9M), DC ($4.4M), Hawaii ($10.9M), Maryland ($16.6M), Oregon ($15.7M), Pennsylvania ($39.5M). The settlement split each liability 50% at-risk and 50% reinvestment.
- **Rhode Island** (HSG plan, September 2025): "Find and Fix" reviews of ESAP cases, supervisor academy, second-party reviews, simplified reporting for all households (the five lowest-PER states all use it), and an AI "Smart Policy Hub" with the explicit line "(AI will not be used in any benefit determinations)."
- **New Jersey** fell from 14.33% (FY2024) to 6.86% (FY2025). The commentary credits closer work with county offices and added QC protocols. That is unconfirmed by the state.
- **Mississippi:** I found no primary source for the reported claim that a verification tool cut the state's payment-error liability by $40 million. WDAM (September 2026) reports a FY2025 PER of 9.51%, which CBPP estimates would cost "about $75 million annually," or "about $40 million" if the rate falls below 8%. The $40M figure is most likely that projected saving, not an achieved one.
- **FNA effective practices** (April 2026): a county pre-certification review tool, Rhode Island's "2-4-Q" (two minutes for quality) checklist, monthly cross-unit accuracy meetings, and root-cause reviews of the highest-dollar error types.
- **Alaska** won $1.66M (PTIG 2026) to replace manual QC tracking. Its 23.15% FY2025 PER delays its cost share under the "Alaska carveout" (PER × 1.5 ≥ 20%).

**What document AI can and can't catch:**

- **Can catch** (case-file-discoverable, about 45% of variances):
  - pay-frequency conversion errors (paystub vs. budgeted amount)
  - rent and utility amounts that differ from the lease or bill
  - SUA applied without a heating/cooling cost shown
  - a person on the lease missing from the case
  - an employer on the paystub that differs from the reported employer
  - data-match alerts sitting unworked
  - stale documents dated outside the budget month
  - arithmetic and proration errors
- **Cannot catch reliably:**
  - unreported income with no document
  - who actually buys and prepares food together
  - informal shared rent
  - off-the-books work
  - anything needing the household (35%) or a collateral contact (about 20%)

For those, CleanCase should produce the **question to ask**, not an answer.

## 3) AI Capabilities to Implement (Mapped to Workflow)

**Architecture, carried over from Vouch.** Agents propose, the rules engine validates, the database enforces, and a merit worker decides. The named seats:

- **Document Reader:** extracts fields with bounding-box citations.
- **Income Analyst:** checks pay frequency and conversion (weekly × 4.3, biweekly × 2.15).
- **Shelter & Utility Checker**
- **Household Composition Checker:** looks for names on the lease or other documents who aren't on the case.
- **Policy Librarian:** retrieves from manuals with Moss.
- **Change-Report Triage**
- **QC Projection.**

Each seat returns schema-validated JSON and **never writes to the eligibility system**.

**Example screen (all values are fixtures; label them "Fixture"):**

- *Paystub:* "Pay period 10/01–10/14/2026, Gross $1,240.00, Biweekly." The case file budgets $1,240/month. The correct figure is $1,240 × 2.15 = $2,666/month. Flag the "Wages & Salaries" variance and cite the "Gross" line, page 1.
- *Lease:* rent $1,350, with "Occupants: Maria R., Daniel R." The case file shows rent of $1,050 and one member. That raises two flags: an underpayment risk on shelter, and a household-composition question for the interview. Don't make that one an automatic correction.
- *Utility bill:* gas heating charge present, but the case file has no SUA. Possible underpayment.
- *Dashboard:* projected PER 9.4% (90% interval 7.1–11.8%), "Tier: 10% band," dollars at risk, flags by element, change-report queue aging (more than 10 days, in red), and a both-directions meter (over vs. under).

**Tools for each capability:**

- **Benefit recomputation:** the PolicyEngine-US household API. FY2027 parameters are encoded; for example, the one-person maximum rises from $298 to $306 in October 2026. Also see Axiom Foundation's open rulespec-us and PolicyEngine's snap-payment-error-rates repo, which reproduces the FY2024 (10.93%) and FY2025 (10.62%) national rates.
- **Risk scoring:** the public QC microdata (FY2024 file of 44,891 cases, at snapqcdata.net) plus the Better Government Lab's open-source SNAP risk model (XGBoost). That replicates what North Carolina is building with its $1.75M PTIG.
- **Policy retrieval (MOSS):** the most likely match is **Moss by InferEdge Inc. (moss.dev)**, "a sub-10 ms semantic search runtime." It offers hybrid keyword and semantic search, Python/JS SDKs, a browser WASM SDK, an MCP server and an OpenAI-compatible inference endpoint. It fits because policy Q&A must stay grounded and citable, and in-browser search keeps manual queries off the network. The other candidate, "MOSS (Memory-Orchestrated Semantic System)," is an arXiv research architecture for auditable agent memory, not a product. If you meant something else (for example, Stanford's MOSS plagiarism detector), it doesn't fit. Verify with your hackathon's sponsor list.
- **CREAO:**
  - Save each seat as an agent.
  - Run it through `POST https://developer.creao.ai/v1/runs` (account key `cr_sk_`) or an app-scoped trigger (`capi_`), with `webhook_url` delivering results to your SpacetimeDB ingest reducer.
  - Also available: realtime NDJSON streaming, schedules (nightly change-report sweep), agent memory, workspaces and secrets.
  - One secondary wiki claims saved agents replay as deterministic code without an LLM. CREAO's own docs don't confirm this, so don't claim it.
  - The kill switch is your reducer refusing CREAO webhooks.
- **CRS** (crscreditapi.com, sandbox at api-sandbox.stitchcredit.com, synthetic personas):
  - Products: TransUnion TruValidate Identity Manager Verification (basic, OTP, KBA) and Fraud Finder, which is email-risk scoring. CRS's catalog says it is "powered by AtData," while another CRS page says "powered by Experian." That conflict is unresolved.
  - **Appropriateness:** these are consumer-reporting products built for lending, under FCRA permissible purpose. Knowledge-based questions fail thin-file, young, immigrant and unbanked applicants, who are disproportionately SNAP households. SNAP identity verification can be met with any document or collateral contact.
  - Use CRS **only** as a labeled, sandbox-only step-up identity signal for portal account recovery or suspicious duplicate accounts. Never use it in eligibility, never let a "risk score" lead to denial, and say so on screen.
- **Document extraction:** LLM vision (Claude/GPT) with page and bbox output, AWS Textract, Azure Document Intelligence, Google Document AI, Mindee. Kentucky's $991,861 PTIG (paystub OCR + RPA prefill that applicants confirm at upload) is the public precedent.
- **Income verification APIs:** Argyle, Truv, Pinwheel and Plaid Income offer developer sandboxes; Equifax The Work Number is contract-only. *(Sandbox availability is from vendor knowledge and was not re-verified. Check this weekend.)* States can pay for TPIDs with EVS grant funds.
- **Form-fill:** Nava's open-source form-filling assistant (Riverside County pilot, $1.5M Google.org grant) shows the legitimate pattern: pre-fill and have the client or worker confirm. Risky: browser bots submitting into state portals or certifying anything.
- **Notices and plain language:** draft-only, with worker approval. The Code for America and Anthropic suite plans exactly this.

**Compliance to design around:**

- **Who may decide:** merit-personnel rules (7 CFR 272.4), the FNA AI framework (human oversight protocols, plus "stop using the AI" if outputs are rubber-stamped), and the FNA advanced-automation memo (major-change approval).
- **Security and privacy:** SNAP confidentiality (7 CFR 272.1(c)); IRS Pub 1075 if you touch IEVS FTI (avoid it in the MVP); NIST 800-53 moderate, StateRAMP/GovRAMP and SOC 2 Type II as the eventual bar; encryption, immutable audit logs, Section 508/WCAG 2.1 AA, and language access. *(Security-framework details come from domain knowledge, not re-verified this pass.)*
- **Past automation failures, and how to answer them:**
  - Indiana's IBM welfare modernization, cancelled in 2009
  - Arkansas's algorithmic Medicaid home-care cuts
  - Michigan's MiDAS unemployment system, which "wrongfully accused approximately 40,000 people" of fraud. A 2016 state review of 22,000 of its determinations found "93% did not actually involve fraud" (Proof News, November 5, 2026). Attorneys now cite MiDAS against Michigan's SNAP AI.

  *(The Indiana and Arkansas items are summarized from domain knowledge.)* CleanCase's answer: no denials, no auto-corrections, citations on every flag, error tracking in both directions, and published accuracy.
- **Unverified:** the "Hawaii AI policy assistant." I found no primary source.

**Precedents:**

- Michigan: the Michigan Case Accuracy Review Assistant (MiCARA), a Vertex AI case reader that flags discrepancies while staff make decisions. MDHHS COO David Knezek said it "completed 17,500 pre-certification reviews in three months, identifying $150,000 in potential payment errors" (Proof News, November 5, 2026).
- Massachusetts DTA: call transcription.
- Code for America + Anthropic: SNAP Policy Navigator built on MCP (May 2026).
- Nava: assistive chatbot pilot with 61 caseworkers. Reporting on a Los Angeles trial says workers couldn't tell when the bot was right. Design for calibrated trust.
- Nava: Pennsylvania SNAP PER contract (December 2025).
- SAS: West Virginia ($876,259 emergency purchase against a cited "potential $55 million liability," per West Virginia Watch). Nevada spent about $1 million (Proof News), hopes to "lower the SNAP payment error rate by up to two percent," and its caseworkers "identified $130,000 in monthly overpayments" in the first two months (SAS press release). The press release's $52M exposure figure is not independently confirmed.
- Maximus: accuracy assistant.
- Fortuna Health: $18M Series A from a16z in 2025, Medicaid navigation sold to health plans and systems rather than states.

## Hackathon Tool Map

| Tool / data | Role in CleanCase | Weekend feasibility | Real vs. mocked |
|---|---|---|---|
| SpacetimeDB | System of record for cases, flags, decisions; scheduled reducer replays the QC file; live dashboard | Free/local | Real |
| CREAO agents (Developer API + webhooks) | Seats: Document Reader, Income Analyst, Shelter Checker, Composition Checker, Triage, QC Projection | Account required | Real agents, fixture documents |
| Moss | Policy-manual retrieval (7 CFR 273, CA MPP 63, TX Works Handbook, NY Source Book) with citations | Free tier: verify | Real retrieval over public manuals |
| PolicyEngine-US API / Axiom rulespec | Deterministic benefit recomputation | Free, open source | Real |
| USDA QC public-use file + BGL risk model | Risk scores, simulated PER, tier projection | Free download | Real data, labeled "Replay" |
| LLM vision / Textract / Azure DI | Paystub, lease and bill extraction with bounding boxes | Free tiers/credits (verify) | Real on synthetic documents |
| CRS sandbox (TruValidate, Fraud Finder) | Optional identity step-up demo only, kept out of eligibility | Hackathon sandbox | "Sandbox," fixed personas |
| Argyle/Truv/Pinwheel/Plaid sandboxes | Consented payroll verification | Sandbox (verify) | Sandbox |
| Factory Droid | Writes new detector rules as PRs, fenced | Available | Real code, human-merged |
| Equifax Work Number, IEVS, SAVE, NAC | Production data matches | Not accessible | Mocked, labeled "Fixture" |

## Claims a Hackathon Team Can Safely Make vs. Must Not Claim

**Safe:**
- "Flags discrepancies with the exact source line; a merit worker decides."
- "Recomputes with an open rules engine on FY2027 parameters."
- "Replayed on USDA's public QC file" (shown as Replay).
- "Catches both over- and underpayments."
- "Targets the roughly 45% of variances that QC finds in the case file."

**Must not claim:**
- That it reduces a state's PER by X%. You have no live data.
- That it is FNA-approved, FedRAMP- or StateRAMP-authorized, or Pub 1075-compliant.
- That it detects fraud.
- That it determines eligibility.
- That it uses credit data to verify applicants.
- That it is integrated with CalSAWS, TIERS or any state system.
- That its projected PER equals the official PER. Official rates come from federal re-review, and confidence intervals are wider than the cost-share bands (Hamilton Project).

## 4) Go-to-Market

**Who buys and signs:**
- **Champion and economic buyer:** the state SNAP director or Deputy Commissioner for economic assistance.
- **Accuracy pain owner:** the QC/QA or program integrity director.
- **Gatekeepers:** the state CIO and security office (ATO, data agreements) and the budget office, which owns the cost-share exposure.
- **County-administered states** (CA, NY, CO, NC, OH, MN): county social services directors, plus statewide consortia such as CalSAWS in California.
- **Federal:** the FNA SNAP program office (relocating to Indianapolis) and its regional hubs, for grants and automation approvals. FNA reported a 28% staff loss since 2025 (IFAI), so expect slow federal approvals.

**Procurement paths, from fastest to slowest:**
1. Free shadow-mode replay under an NDA or data-use agreement.
2. A pilot under the state's small-purchase or delegated threshold (often low six figures; verify per state).
3. A subcontract under an incumbent eligibility integrator (Deloitte, Accenture, Conduent, Maximus, Gainwell, Optum) or a civic-tech prime (Nava, Code for America, USDR).
4. Cooperative vehicles (NASPO ValuePoint, GSA Schedule).
5. A competitive RFP. Florida's budget required DCF to procure a machine-learning data analytics vendor "by September 1" (WLRN, August 4, 2026).

**Federal funding:**
- **PTIG:** up to $5M per year, awards of $20K–$2M. Nonprofits and other entities can apply with a state SNAP agency letter of commitment. FY2024–25 grantees are barred from leading. An APD is needed if the work is part of an eligibility-system project above $6M.
- **EVS:** $38M across 53 agencies, up to $4.3M each, covering September 2026 to September 30, 2028.
- **SNAP Fraud Framework Implementation Grants**
- **Regular 50% admin match:** the federal share falls to 25% from FY2027 under OBBBA.
- **Enhanced match:** check whether 90/10 applies for eligibility systems shared with Medicaid, using cost allocation through the APD process.

**Comparables:**
- SAS West Virginia: $876,259 (emergency purchase, West Virginia Watch). SAS Nevada: about $1 million (Proof News).
- Florida appropriation: $4M.
- PTIG awards: $0.49M–$1.75M.
- Nava Pennsylvania: value not disclosed.
- Fortuna: $4M seed (2023) and $18M A (2025), with a16z, YC and BoxGroup. It reached scale by selling to health plans before states.

**Pricing:**
- Per-state platform fee plus a per-case-review fee, for example $250K–$750K base plus $0.50–$2 per reviewed case action.
- Avoid pure contingency or percent-of-savings deals: they are politically toxic ("paid to cut benefits") and may be unallowable under federal cost principles. Verify with counsel.
- Tie success fees to *accuracy in both directions*, never to reductions.

**First 12 months:**
- Months 0–2: replay the QC file for 3 target states and publish a free "PER projection" tool.
- Months 2–4: two shadow pilots on closed QC cases.
- Months 4–6: SOC 2 Type I and a PTIG application with a partner state.
- Months 6–12: one paid pre-issuance pilot on 1–2 county or regional office queues, an accuracy report, and a first subcontract.

**Key risks:**
- 9–18 month sales cycles
- OBBBA politics: advocates read accuracy tools as benefit cuts
- Incumbents bundling "free" accuracy features (Maximus, SAS)
- Security certification cost
- FNA approval delays during its reorganization
- PER sampling noise hiding your impact

**Ethical position:** "Every dollar right, in both directions. We never deny, never auto-correct, and we report underpayments with the same urgency as overpayments."

**Outreach script outline:**
1. Their exact FY2025 PER and tier, with the dollar exposure.
2. "FY2027, the year being sampled now, sets your FY2030 share."
3. A 90-second demo: a document-cited flag next to the recomputed benefit.
4. Ask for 200 closed QC cases or a de-identified replay.
5. Offer: free 30-day shadow mode, no system access, no decisions.

**10 first conversations (next two weeks):**
1. Nevada DSS SNAP program integrity, since SAS is already engaged and you could complement it
2. Colorado CDHS SNAP division, sitting 0.03 points from the next tier
3. New Jersey DHS food assistance, to learn what drove its fall from 14.33% to 6.86%
4. Rhode Island DHS Office of Program Integrity
5. Kentucky DCBS, a PTIG paystub-OCR awardee and a natural integration partner
6. North Carolina DHHS, the PTIG risk-model awardee
7. Code for America's SNAP Policy Navigator team
8. Nava Labs, for a Pennsylvania subcontract or partnership
9. APHSA, its IT Solutions Management (ISM) community and SNAP affiliates
10. The FNA SNAP program office or Midwest hub, about advanced-automation approval expectations

**Investors (verify recent deals):**
- a16z (Bio + Health and American Dynamism; invested in Fortuna)
- Y Combinator (Fortuna)
- BoxGroup
- GovTech Fund
- Accelerators and incubators: Beeck Center (Georgetown), Nava Labs, Code for America

## Market Sizing (assumptions shown)

- **Base:** FY2023 SNAP benefits of $90.06B, an average caseload of 22.26M households and a $337 average allotment. FY2025 improper payments were $10.1B. There are 53 state agencies.
- **TAM (tooling budget):** assume about 2 certification or change actions per case per year, or about 45M actions. At $1–$2 per action, that is **$45M–$90M a year in per-action software**. Add QA/QC workflow subscriptions for 53 agencies at $0.25M–$2M, about **$13M–$106M**. Total roughly **$60M–$200M a year**. That is small next to the exposure it protects: one cost-share tier is 5% of benefits, about $4.5B nationally.
- **SAM:** states at or above 6% for FY2025. CBPP's breakdown of FY2025 rates puts 9 states plus USVI below 6%, 6 states at 6–7.99%, 16 at 8–9.99%, and 13 plus Guam at 10–13.33%. Agri-Pulse reports "another six, as well as the District of Columbia," above the 13.34% delay threshold. That is 41 states plus DC at or above 6%, roughly 80% of TAM, or **$50M–$160M**.
- **SOM (36 months):** 4–6 states or large counties at $0.5M–$1.5M, giving **$2M–$9M ARR**. Admin spend and county office counts were not sourced in this pass. Pull them from the FNA State Activity Report before the deck.

## Caveats

- FNS became the Food and Nutrition Administration (FNA) on June 1, 2026. Some URLs still say fns.
- The FY2023 QC Annual Report has internal inconsistencies: Table 1 labels, and Pennsylvania left out of Table 11. Its element breakdown is only at the factor level.
- Several items are flagged as domain knowledge or secondary sources: the data-match list, security frameworks, failure histories and vendor sandboxes. Mississippi's $40M figure appears to be a CBPP projection, not an achieved result (WDAM). The 41-state count comes from CBPP and Agri-Pulse, not FNA's own tables.
- Projected PER from replay data runs a few points below official PER, because the public file excludes ineligible households (NYU simulation).