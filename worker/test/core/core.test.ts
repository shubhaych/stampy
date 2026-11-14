import { beforeEach, describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';
import { memoryDb } from '../../src/db';
import { AI, assertAiAppend, assertCan, assertReview, can, AuthzError, identityFromCode, type Identity } from '../../src/core/authz';
import { appendAudit } from '../../src/core/audit';
import { consume, LimitError, setControl, getControl } from '../../src/core/control';
import { readTruthForDebrief, TruthLockedError, containsTruth } from '../../src/core/truth';
import { publish, subscribe, droppedCount } from '../../src/events';
import { createApp } from '../../src/app';
import { env } from '../../src/env';

const worker: Identity = { id: 'worker:ana', role: 'worker' };
const supervisor: Identity = { id: 'supervisor:sam', role: 'supervisor' };

let db: Database.Database;
beforeEach(async () => {
  db = await memoryDb();
});

function seedCase(status: 'new' | 'certified' = 'new') {
  db.prepare("INSERT INTO qc_history (qc_id, source, fiscal_year, state, household_size, qc_earned_income) VALUES ('GC-1', 'golden', 2027, 'CA', 1, 2666)").run();
  db.prepare("INSERT INTO case_state (case_id, qc_id, case_file_json, status) VALUES ('GC-1', 'GC-1', '{}', ?)").run(status);
}

describe('authz', () => {
  it('only human roles accept, approve, override, certify', () => {
    for (const a of ['flag.accept', 'fact.accept', 'outreach.approve', 'gate.override', 'case.certify'] as const) {
      expect(can(worker, a)).toBe(true);
      expect(can(AI, a)).toBe(false);
      expect(() => assertCan(AI, a)).toThrow(AuthzError);
    }
  });
  it('review needs a supervisor who is not the certifier', () => {
    expect(() => assertReview(worker, 'worker:ana')).toThrow(AuthzError);
    expect(() => assertReview({ id: 'supervisor:ana', role: 'supervisor' }, 'supervisor:ana')).toThrow(/different identity/);
    expect(() => assertReview(supervisor, 'worker:ana')).not.toThrow();
  });
  it('AI identity may only append AI tables', () => {
    expect(() => assertAiAppend(AI, 'flag')).not.toThrow();
    expect(() => assertAiAppend(AI, 'decision')).toThrow(AuthzError);
    expect(() => assertAiAppend(AI, 'override')).toThrow(AuthzError);
  });
  it('demo codes never yield the ai identity', () => {
    expect(identityFromCode('stampy-worker', 'ana', env)?.role).toBe('worker');
    expect(identityFromCode('stampy-supervisor', 'sam', env)?.role).toBe('supervisor');
    expect(identityFromCode('ai', 'x', env)).toBeNull();
  });
});

describe('database guarantees', () => {
  it('audit_log is append-only', () => {
    appendAudit(db, { caseId: null, who: worker, kind: 'human', action: 'test', entity: 'x', entityId: '1' });
    expect(() => db.prepare('UPDATE audit_log SET action = ?').run('tamper')).toThrow(/append-only/);
    expect(() => db.prepare('DELETE FROM audit_log').run()).toThrow(/append-only/);
  });
  it('review trigger enforces segregation of duties', () => {
    seedCase();
    db.prepare("INSERT INTO decision (id, case_id, certified_by) VALUES ('D1', 'GC-1', 'worker:ana')").run();
    expect(() => db.prepare("INSERT INTO review (id, decision_id, reviewer) VALUES ('R1', 'D1', 'worker:ana')").run()).toThrow(/different identity/);
    expect(() => db.prepare("INSERT INTO review (id, decision_id, reviewer) VALUES ('R2', 'D1', 'supervisor:sam')").run()).not.toThrow();
  });
  it('facts are append-only', () => {
    seedCase();
    db.prepare("INSERT INTO fact (id, case_id, field, value, normalized, source_kind, source_ref, observed_at, confidence, prov) VALUES ('F1','GC-1','pay_frequency','Biweekly','biweekly','document','D1','2026-10-14',0.9,'fixture')").run();
    expect(() => db.prepare("UPDATE fact SET value = 'Monthly'").run()).toThrow(/append-only/);
  });
  it('outreach cannot be sent without approval; a call cannot go live without consent', () => {
    seedCase();
    db.prepare("INSERT INTO open_question (id, case_id, field, text, fact_ids_json, kind, stake_json, direction, prov) VALUES ('Q1','GC-1','pay_frequency','How often?','[]','conflict','{}','over','fixture')").run();
    db.prepare("INSERT INTO outreach (id, case_id, question_id, channel, to_alias, prov) VALUES ('O1','GC-1','Q1','employer_email','Employer A','fixture')").run();
    expect(() => db.prepare("UPDATE outreach SET status = 'sent' WHERE id = 'O1'").run()).toThrow(/approved/);
    db.prepare("INSERT INTO call (id, case_id, counterpart, contact_alias, mode, brief_json, prov) VALUES ('C1','GC-1','employer','Employer A','fixture','{}','fixture')").run();
    expect(() => db.prepare("UPDATE call SET status = 'live' WHERE id = 'C1'").run()).toThrow(/consent/);
  });
});

describe('limits and kill switches', () => {
  it('daily limits are enforced server-side', () => {
    consume(db, 'ai', 2);
    consume(db, 'ai', 2);
    expect(() => consume(db, 'ai', 2)).toThrow(LimitError);
  });
  it('only a supervisor flips kill switches', () => {
    expect(() => setControl(db, worker, { aiEnabled: false })).toThrow(AuthzError);
    setControl(db, supervisor, { aiEnabled: false });
    expect(getControl(db).aiEnabled).toBe(false);
  });
});

describe('truth stays server-side', () => {
  it('truth.ts refuses before certification', () => {
    seedCase('new');
    expect(() => readTruthForDebrief(db, 'GC-1')).toThrow(TruthLockedError);
  });
  it('truth.ts reads after certification', () => {
    seedCase('certified');
    expect(readTruthForDebrief(db, 'GC-1').qcEarnedIncome).toBe(2666);
  });
  it('SSE bus drops events carrying truth keys', () => {
    const seen: unknown[] = [];
    const off = subscribe((e) => seen.push(e));
    const before = droppedCount();
    const ok = publish({ type: 'audit', entry: { id: '1', at: '2026-10-14', caseId: 'GC-1', actor: 'x', actorRole: 'system', kind: 'rules', action: 'leak', entity: 'x', entityId: '1', data: { qcEarnedIncome: 2666 } } });
    off();
    expect(ok).toBe(false);
    expect(seen).toHaveLength(0);
    expect(droppedCount()).toBe(before + 1);
  });
  it('no REST response carries truth keys', async () => {
    seedCase('new');
    const app = createApp({ db, env });
    for (const path of ['/health', '/status', '/cases', '/cases/GC-1', '/cases/GC-2', '/states']) {
      const res = await app.request(path);
      const body = await res.json();
      expect(containsTruth(body), path).toBe(false);
    }
    const locked = await app.request('/cases/GC-1/debrief');
    expect(locked.status).toBe(423);
  });
});
