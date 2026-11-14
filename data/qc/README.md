# Public QC snapshot

`node --import tsx scripts/qc-ingest.ts` downloads the pinned August 2026 revision of USDA's FY2024 public-use QC CSV archive. It runs without provider keys. `node --import tsx scripts/qc-ingest.ts /path/to/qcfy2024_csv.zip` validates and imports a previously downloaded copy of the same release.

The host returned HTTP 403 from its AWS edge for curl's default User-Agent. A browser-compatible User-Agent returned HTTP 200 without credentials, cookies or a login. The importer uses a browser-compatible header and checks the HTTP response type, size cap, exact archive size, SHA-256, CSV SHA-256, schema width, unique household identifiers and source row count. It refuses a changed release rather than silently adopting it. The ZIP is extracted with the system `unzip` executable.

Observed source: 44,891 records, 1,177 columns, 53 jurisdictions (50 states, DC, Guam and Virgin Islands). All records are persisted in ignored `raw/qc_pub_fy2024.csv`; the source ZIP and validated safe JSONL index are also cached there. Checked-in `manifest.json` preserves source URLs, byte count, checksums, retrieval time and jurisdiction counts; `examples.json` preserves three genuine safe source projections for CA, TX and NY. These are anonymized historical research records, not operational applicant case files.

## Allowlisted pre-review fields

| Column | Public display | Codebook printed page |
| --- | --- | --- |
| HHLDNO | Public household identifier, assigned from position in the unedited QC file | 62 |
| STATE | State FIPS, mapped to USPS abbreviation for filtering | 64; Appendix E |
| YRMONTH | Sample year/month, normalized from YYYYMM to YYYY-MM | 64 |
| CERTHHSZ | Reported certified unit size | 65 |
| RAWBEN | Reported benefit the unit was certified to receive during the sample month | 78 |

The dictionary is the official [FY2024 technical documentation](https://snapqcdata.net/sites/default/files/2026-08/FY-2024-Tech-Doc.pdf). Its reported/constructed distinction (printed page 53) is crucial: “reported” means reported on the QC Review Schedule, not necessarily the original state-certified case budget. RAWGROSS must not be mislabeled as original state income; FSGRINC and FSBEN are constructed/edited research variables. These, error coding and other QC fields are excluded from the API entirely. Blank and `.` missing fields remain null, never zero.

Each record has a source-derived local route identifier (`qc-2024-` plus HHLDNO) and a one-based data-record index excluding the CSV header. No names, phone numbers, forms, paystubs, employment details or policy decisions are manufactured from these rows. The source viewer is separate from the applicant workflow; it cannot send outreach or certify a record.

## Runtime

The normal worker mounts `registerQc(app)`. A read-only data worker can also run independently of Postgres:

```
node --import tsx worker/src/qc/server.ts
```

Default port 8791; override with `QC_PORT`. Routes: `/qc/status`, `/qc/cases?state=CA&offset=0&limit=25`, `/qc/cases/qc-2024-47737`. Missing or invalid cache returns a clear unavailable state, never fixture records labeled as loaded source data. The API loads only the allowlisted index and validates its checksum against the pinned release manifest; the complete source CSV is never exposed.
