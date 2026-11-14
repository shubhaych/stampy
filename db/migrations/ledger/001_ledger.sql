-- ledger: evidence ledger (append-only) and open questions.
CREATE TABLE fact (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES case_state (case_id),
  field TEXT NOT NULL,
  value TEXT NOT NULL,
  normalized TEXT NOT NULL,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('document', 'data_match', 'case_budget', 'household_reply', 'employer_call', 'employer_email', 'interview')),
  source_ref TEXT NOT NULL,
  page INTEGER,
  bbox_json TEXT,
  observed_at TEXT NOT NULL,
  confidence REAL NOT NULL,
  prov TEXT NOT NULL,
  question_id TEXT,
  supersedes TEXT REFERENCES fact (id)
);
-- Value columns never change. Acceptance is a separate append-only row.
CREATE TRIGGER fact_no_update BEFORE UPDATE ON fact BEGIN SELECT RAISE(ABORT, 'fact is append-only; supersede by reference'); END;
CREATE TRIGGER fact_no_delete BEFORE DELETE ON fact BEGIN SELECT RAISE(ABORT, 'fact is append-only'); END;

CREATE TABLE fact_review (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fact_id TEXT NOT NULL REFERENCES fact (id),
  status TEXT NOT NULL CHECK (status IN ('accepted', 'rejected')),
  by TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE open_question (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES case_state (case_id),
  field TEXT NOT NULL,
  text TEXT NOT NULL,
  fact_ids_json TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('conflict', 'missing_evidence')),
  stake_json TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('over', 'under', 'none')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'closed', 'waived')),
  closed_note TEXT,
  opened_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  prov TEXT NOT NULL
);
