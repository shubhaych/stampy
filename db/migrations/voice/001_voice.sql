-- voice-engine: calls write only call_* rows; no tool touches the case.
CREATE TABLE call (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES case_state (case_id),
  question_id TEXT,
  counterpart TEXT NOT NULL CHECK (counterpart IN ('employer', 'landlord')),
  contact_alias TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('fixture', 'sim', 'human', 'pstn')),
  status TEXT NOT NULL DEFAULT 'briefing' CHECK (status IN ('briefing', 'live', 'taken_over', 'ended')),
  outcome TEXT CHECK (outcome IN ('verified', 'contradicts', 'refused', 'no_answer', 'voicemail')),
  consent_by TEXT,
  brief_json TEXT NOT NULL,
  started_at TEXT,
  duration_s REAL,
  prov TEXT NOT NULL
);
CREATE TRIGGER call_needs_consent BEFORE UPDATE OF status ON call
  WHEN NEW.status = 'live' AND NEW.consent_by IS NULL
  BEGIN SELECT RAISE(ABORT, 'household consent must be recorded before a collateral call'); END;

CREATE TABLE call_turn (
  id TEXT PRIMARY KEY,
  call_id TEXT NOT NULL REFERENCES call (id),
  speaker TEXT NOT NULL CHECK (speaker IN ('agent', 'counterpart', 'worker')),
  text TEXT NOT NULL,
  t_start REAL NOT NULL,
  t_end REAL NOT NULL
);

CREATE TABLE call_fact (
  id TEXT PRIMARY KEY,
  call_id TEXT NOT NULL REFERENCES call (id),
  field TEXT NOT NULL,
  value TEXT NOT NULL,
  quote TEXT NOT NULL,
  turn_ids_json TEXT NOT NULL,
  t_start REAL NOT NULL,
  t_end REAL NOT NULL,
  confidence REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  status_by TEXT
);

CREATE TABLE call_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  call_id TEXT NOT NULL REFERENCES call (id),
  type TEXT NOT NULL,
  data_json TEXT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
