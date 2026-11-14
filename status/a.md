# Machine A status

Frontend integration branch `a/stampy-ui` is based on the user-selected `origin/b/stampy-loop`, not the legacy SQLite frontend. See `docs/stampy-ui.md` and `.features/stampy-ui.md` for scope and verification.

Implemented queue filtering, next-step guidance, contract validation, stale response handling, source provenance, stronger decision controls, and responsive UI verification. Typecheck and 56 unit tests pass; six browser tests pass with mocked backend responses.

Needs from Machine B: QC release ingestion and replay API with source manifest; human fact acceptance and checklist-send approval; selected Postgres worker and PolicyEngine runtime. Ownership checker compares all inherited rebuild changes against main, so full check is blocked despite frontend checks passing. Do not bypass it or describe live integrations as verified.
