-- Stampy schema (Postgres). The evidence ledger (`fact`) and `audit_log` are append-only, enforced by triggers.

CREATE TABLE app_case (
  id              text PRIMARY KEY,                 -- STP-1001
  ref_code        text NOT NULL UNIQUE,             -- six digits, easy to say on the phone
  applicant_name  text NOT NULL,
  applicant_email text NOT NULL,
  applicant_phone text NOT NULL,                    -- E.164, used with ref_code to find the case on a call
  state           text NOT NULL DEFAULT 'CA',
  status          text NOT NULL DEFAULT 'reading'
                  CHECK (status IN ('reading','questions_open','ready_for_review','approved','rejected','needs_person')),
  email_thread_id text,
  email_last_message_id text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX app_case_phone ON app_case (applicant_phone);

CREATE TABLE document (
  id            text PRIMARY KEY,                   -- DOC-...
  case_id       text NOT NULL REFERENCES app_case(id),
  kind          text NOT NULL DEFAULT 'unknown',    -- application_form | paystub | lease | other | unknown
  filename      text NOT NULL,
  content_type  text NOT NULL,
  bytes         bytea NOT NULL,
  sha256        text NOT NULL,
  synthetic     boolean NOT NULL DEFAULT false,     -- one of the generated demo documents
  source        text NOT NULL CHECK (source IN ('upload','email')),
  source_ref    text,                               -- AgentMail message id for email attachments
  read_status   text NOT NULL DEFAULT 'pending' CHECK (read_status IN ('pending','reading','read','failed','needs_person')),
  read_error    text,
  summary       text,
  received_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX document_case ON document (case_id);

-- Evidence ledger: every fact keeps its source, where in the source, when, and how sure.
CREATE TABLE fact (
  id            text PRIMARY KEY,                   -- F-...
  seq           bigserial UNIQUE,
  case_id       text NOT NULL REFERENCES app_case(id),
  field         text NOT NULL,
  value         text NOT NULL,                      -- as written in the source
  normalized    text NOT NULL,                      -- comparable form (biweekly, 1240.00, 2026-10-23)
  source_kind   text NOT NULL CHECK (source_kind IN ('application_form','document','phone_call','email','caseworker','rules')),
  source_ref    text,                               -- document id or call id
  source_label  text NOT NULL,                      -- "Paystub, pay date Sep 25, 2026"
  page          int,
  line          text,                               -- the exact line quoted from the source
  bbox          jsonb,                              -- {x,y,w,h} normalized to the page
  at_seconds    numeric,                            -- position in a call recording
  confidence    numeric NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  question_id   text,                               -- set when this fact answers an open question
  prov          text NOT NULL CHECK (prov IN ('live','synthetic','fixture','sandbox','replay')),
  created_by    text NOT NULL,                      -- ai | system | caseworker:<name>
  observed_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fact_case_field ON fact (case_id, field);

CREATE TABLE open_question (
  id               text PRIMARY KEY,                -- Q-...
  case_id          text NOT NULL REFERENCES app_case(id),
  kind             text NOT NULL CHECK (kind IN ('conflict','missing_document')),
  field            text NOT NULL,
  title            text NOT NULL,                   -- "Pay frequency"
  ask              text NOT NULL,                   -- plain-language question or request
  why              text NOT NULL,
  fact_ids         text[] NOT NULL DEFAULT '{}',
  candidates       jsonb NOT NULL DEFAULT '[]',     -- [{value, label, incomeMonthly, benefitMonthly}]
  stake_monthly    numeric,                         -- benefit difference between candidates, when computed
  direction        text NOT NULL DEFAULT 'none' CHECK (direction IN ('over','under','none')),
  channel          text NOT NULL CHECK (channel IN ('phone','document')),
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open','answered','closed')),
  resolved_value   text,
  resolution_fact_id text,
  closed_note      text,
  opened_at        timestamptz NOT NULL DEFAULT now(),
  closed_at        timestamptz,
  UNIQUE (case_id, field, kind)
);

CREATE TABLE outreach (
  id                   text PRIMARY KEY,            -- OUT-...
  case_id              text NOT NULL REFERENCES app_case(id),
  kind                 text NOT NULL CHECK (kind IN ('request','checklist')),
  direction            text NOT NULL DEFAULT 'outbound',
  to_addr              text NOT NULL,
  subject              text NOT NULL,
  body_text            text NOT NULL,
  status               text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','simulated','failed')),
  agentmail_message_id text,
  thread_id            text,
  error                text,
  approved_by          text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  sent_at              timestamptz
);

CREATE TABLE inbound_email (
  id                   text PRIMARY KEY,            -- IN-...
  case_id              text REFERENCES app_case(id),
  agentmail_message_id text NOT NULL UNIQUE,
  thread_id            text,
  from_addr            text NOT NULL,
  subject              text,
  body_text            text,
  attachment_count     int NOT NULL DEFAULT 0,
  simulated            boolean NOT NULL DEFAULT false,
  received_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE call (
  id             text PRIMARY KEY,                  -- CALL-...
  case_id        text REFERENCES app_case(id),
  vapi_call_id   text UNIQUE,
  from_number    text,
  verified       boolean NOT NULL DEFAULT false,
  simulated      boolean NOT NULL DEFAULT false,
  status         text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','ended')),
  started_at     timestamptz NOT NULL DEFAULT now(),
  ended_at       timestamptz,
  ended_reason   text,
  transcript     text,
  messages       jsonb,
  recording_url  text,
  callback_requested text
);

CREATE TABLE recompute (
  id             text PRIMARY KEY,                  -- RC-...
  case_id        text NOT NULL REFERENCES app_case(id),
  engine         text NOT NULL,                     -- policyengine-us <version>
  inputs         jsonb NOT NULL,
  before         jsonb NOT NULL,                    -- {incomeMonthly, benefitMonthly, eligible, ...} from the application as filed
  after          jsonb NOT NULL,                    -- same, from the resolved evidence
  ms             int NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE decision (
  id             text PRIMARY KEY,                  -- DEC-...
  case_id        text NOT NULL REFERENCES app_case(id),
  action         text NOT NULL CHECK (action IN ('approve','reject')),
  recompute_id   text REFERENCES recompute(id),
  decided_by     text NOT NULL,
  note           text,
  at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  case_id     text,
  at          timestamptz NOT NULL DEFAULT now(),
  actor       text NOT NULL,
  actor_role  text NOT NULL CHECK (actor_role IN ('ai','system','worker','supervisor','applicant')),
  kind        text NOT NULL CHECK (kind IN ('source','ai','rules','human','outreach')),
  action      text NOT NULL,
  entity      text NOT NULL,
  entity_id   text NOT NULL,
  data        jsonb
);
CREATE INDEX audit_case ON audit_log (case_id, id);

CREATE TABLE usage_limit (
  key   text NOT NULL,
  day   date NOT NULL,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (key, day)
);

CREATE OR REPLACE FUNCTION forbid_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fact_append_only BEFORE UPDATE OR DELETE ON fact FOR EACH ROW EXECUTE FUNCTION forbid_change();
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION forbid_change();

-- A decision can only be recorded by a human identity.
CREATE OR REPLACE FUNCTION decision_by_human() RETURNS trigger AS $$
BEGIN
  IF NEW.decided_by NOT LIKE 'worker:%' AND NEW.decided_by NOT LIKE 'supervisor:%' THEN
    RAISE EXCEPTION 'only a caseworker can record a decision (got %)', NEW.decided_by;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER decision_human_only BEFORE INSERT ON decision FOR EACH ROW EXECUTE FUNCTION decision_by_human();
