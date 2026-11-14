-- planner: resolution plans, outreach (human-approved), household uploads.
CREATE TABLE resolution_plan (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES case_state (case_id),
  question_id TEXT NOT NULL REFERENCES open_question (id),
  options_json TEXT NOT NULL,
  chosen_index INTEGER,
  agent_run_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  prov TEXT NOT NULL
);

CREATE TABLE outreach (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES case_state (case_id),
  question_id TEXT NOT NULL REFERENCES open_question (id),
  plan_id TEXT REFERENCES resolution_plan (id),
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'sent', 'replied', 'cancelled')),
  to_alias TEXT NOT NULL,
  body TEXT,
  consent_id TEXT REFERENCES consent (id),
  approved_by TEXT,
  simulated INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  prov TEXT NOT NULL
);
-- Nothing is sent without a human approval.
CREATE TRIGGER outreach_needs_approval BEFORE UPDATE OF status ON outreach
  WHEN NEW.status IN ('sent', 'replied') AND NEW.approved_by IS NULL
  BEGIN SELECT RAISE(ABORT, 'outreach must be approved by a worker before it is sent'); END;

CREATE TABLE household_upload (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES case_state (case_id),
  outreach_id TEXT NOT NULL REFERENCES outreach (id),
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'received', 'expired')),
  doc_id TEXT REFERENCES doc (id),
  expires_at TEXT NOT NULL
);
