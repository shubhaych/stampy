-- db-core: AI review output. AI identity appends only.
CREATE TABLE extraction (
  id TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL REFERENCES doc (id),
  field TEXT NOT NULL,
  value TEXT NOT NULL,
  page INTEGER NOT NULL,
  bbox_json TEXT NOT NULL,
  confidence REAL NOT NULL,
  text TEXT NOT NULL,
  seat_run_id TEXT NOT NULL,
  prov TEXT NOT NULL
);

CREATE TABLE flag (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES case_state (case_id),
  station INTEGER NOT NULL CHECK (station BETWEEN 1 AND 10),
  rule_id TEXT NOT NULL,
  title TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('over', 'under', 'none')),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'review', 'warn')),
  delta_monthly REAL,
  extraction_ids_json TEXT NOT NULL DEFAULT '[]',
  recompute_json TEXT,
  question TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'dismissed', 'questioned')),
  status_by TEXT,
  seat TEXT NOT NULL,
  engine_agrees INTEGER,
  prov TEXT NOT NULL
);

CREATE TABLE citation (
  id TEXT PRIMARY KEY,
  flag_id TEXT NOT NULL REFERENCES flag (id),
  source TEXT NOT NULL,
  section TEXT NOT NULL,
  url TEXT,
  text TEXT,
  retrieved_at TEXT,
  backend TEXT NOT NULL CHECK (backend IN ('moss', 'local')),
  ms REAL,
  verified INTEGER NOT NULL DEFAULT 0
);
