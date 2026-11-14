-- db-core: the main table (qc_history), control, audit_log (append-only), limits, case workflow.
-- qc_history columns are Stampy concept names; worker/src/features/qc/column-map.ts maps the
-- official QC file columns onto them. Both state-certified (cert_*) and QC-verified (qc_*) values.
CREATE TABLE qc_history (
  qc_id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('qc_file', 'golden')),
  fiscal_year INTEGER NOT NULL,
  fiscal_month INTEGER,
  state TEXT NOT NULL,
  household_size INTEGER NOT NULL,
  cert_earned_income REAL, qc_earned_income REAL,
  cert_unearned_income REAL, qc_unearned_income REAL,
  cert_shelter REAL, qc_shelter REAL,
  cert_net_income REAL, qc_net_income REAL,
  cert_allotment REAL, qc_allotment REAL,
  error_amount REAL,
  error_direction TEXT CHECK (error_direction IN ('over', 'under', 'none')),
  error_element TEXT,
  error_nature TEXT,
  error_responsibility TEXT CHECK (error_responsibility IN ('agency', 'client', 'none')),
  discovery_method TEXT,
  raw_json TEXT
);
CREATE INDEX qc_history_state ON qc_history (state, fiscal_year);

CREATE VIEW state_profile AS
  SELECT state,
         COUNT(*) AS cases,
         SUM(CASE WHEN error_direction = 'over' THEN 1 ELSE 0 END) AS over_cases,
         SUM(CASE WHEN error_direction = 'under' THEN 1 ELSE 0 END) AS under_cases,
         MIN(source) AS source
  FROM qc_history GROUP BY state;

CREATE TABLE control (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  ai_enabled INTEGER NOT NULL DEFAULT 1,
  moss_enabled INTEGER NOT NULL DEFAULT 1,
  voice_enabled INTEGER NOT NULL DEFAULT 1
);
INSERT INTO control (id) VALUES (1);

CREATE TABLE limits (
  key TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, day)
);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  case_id TEXT,
  actor TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('source', 'rules', 'ai', 'human')),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  data_json TEXT
);
CREATE INDEX audit_log_case ON audit_log (case_id, id);
CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON audit_log BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON audit_log BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;

CREATE TABLE shift (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  seed INTEGER NOT NULL,
  case_ids_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE case_state (
  case_id TEXT PRIMARY KEY,
  qc_id TEXT NOT NULL REFERENCES qc_history (qc_id),
  shift_id TEXT REFERENCES shift (id),
  case_file_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'certified')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE doc (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES case_state (case_id),
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  pages INTEGER NOT NULL DEFAULT 1,
  media_path TEXT,
  sidecar_json TEXT,
  prov TEXT NOT NULL,
  received_at TEXT NOT NULL
);

CREATE TABLE step_state (
  case_id TEXT NOT NULL REFERENCES case_state (case_id),
  station INTEGER NOT NULL CHECK (station BETWEEN 1 AND 10),
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'done', 'skipped', 'flagged')),
  updated_at TEXT,
  PRIMARY KEY (case_id, station)
);

CREATE TABLE consent (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES case_state (case_id),
  scope TEXT NOT NULL CHECK (scope IN ('employer', 'landlord', 'other_collateral')),
  recorded_by TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE override (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES case_state (case_id),
  gate_item_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (length(trim(reason)) >= 5),
  by TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Human certification (simulated; nothing leaves the app).
CREATE TABLE decision (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES case_state (case_id),
  certified_by TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Supervisor second-party review: different identity than the certifier (also enforced in authz.ts).
CREATE TABLE review (
  id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL REFERENCES decision (id),
  reviewer TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TRIGGER review_segregation BEFORE INSERT ON review
  WHEN NEW.reviewer = (SELECT certified_by FROM decision WHERE id = NEW.decision_id)
  BEGIN SELECT RAISE(ABORT, 'review requires a different identity than the certifier'); END;
