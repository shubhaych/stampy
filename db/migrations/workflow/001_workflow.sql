-- db-core: role runs (Claude), one row per run with tokens and ms.
CREATE TABLE agent_run (
  id TEXT PRIMARY KEY,
  case_id TEXT,
  seat TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('fixture', 'live')),
  status TEXT NOT NULL CHECK (status IN ('ok', 'needs_human', 'error', 'skipped_limit', 'skipped_kill_switch')),
  model TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER,
  ms REAL NOT NULL,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
