import { describe, expect, it } from 'vitest';
import type { AuditRow } from '@stampy/contracts/stampy';
import { buildLoop, LOOP_STEP_COUNT } from './loop';
import { FIXTURE_BUNDLE } from './fixture';
import { formatRef, mss, normalizePhone, splitMoney } from './util';

let id = 0;
const row = (action: string, kind: AuditRow['kind'], data: AuditRow['data'] = null, min = id): AuditRow => {
  id += 1;
  return { id, caseId: 'C1', at: new Date(Date.UTC(2026, 0, 1, 0, min)).toISOString(), actor: 'x', actorRole: 'system', kind, action, entity: 'e', entityId: 'e', data };
};

describe('buildLoop', () => {
  it('has 14 steps and every node is dim with no audit rows', () => {
    const nodes = buildLoop([]);
    expect(nodes).toHaveLength(14);
    expect(LOOP_STEP_COUNT).toBe(14);
    expect(nodes.every((n) => n.state === 'dim' && n.backing.length === 0)).toBe(true);
    expect(nodes[0]!.next).toBe(true);
  });

  it('every lit node has at least one backing audit row that exists in the trail (fixture)', () => {
    const nodes = buildLoop(FIXTURE_BUNDLE.audit);
    const ids = new Set(FIXTURE_BUNDLE.audit.map((r) => r.id));
    for (const n of nodes) {
      if (n.state === 'lit') {
        expect(n.backing.length, n.key).toBeGreaterThan(0);
        for (const r of n.backing) expect(ids.has(r.id)).toBe(true);
      } else {
        expect(n.backing, n.key).toHaveLength(0);
      }
    }
    // Fixture runs through the recompute; the caseworker has not decided yet.
    expect(nodes.filter((n) => n.state === 'lit').map((n) => n.key)).toHaveLength(13);
    const decide = nodes.find((n) => n.key === 'decide')!;
    expect(decide.state).toBe('waiting');
    expect(decide.next).toBe(true);
  });

  it('lights only what the trail backs, in a partial run', () => {
    id = 0;
    const audit = [
      row('case.created', 'source'),
      row('document.received', 'source', { source: 'upload' }),
      row('document.read', 'ai', { docId: 'D1', kind: 'paystub', source: 'upload', facts: 4 }),
      row('question.opened', 'rules', { questionId: 'Q1', field: 'pay_frequency' }),
      row('email.drafted', 'ai', { kind: 'request' }),
    ];
    const nodes = buildLoop(audit);
    const by = Object.fromEntries(nodes.map((n) => [n.key, n]));
    expect(by.upload!.state).toBe('lit');
    expect(by.read!.state).toBe('lit');
    expect(by['ledger-1']!.state).toBe('lit');
    expect(by['ledger-1']!.note).toBe('4 facts');
    expect(by.questions!.state).toBe('lit');
    expect(by['email-request']!.state).toBe('waiting');
    expect(by['email-request']!.next).toBe(true);
    expect(by['read-attachment']!.state).toBe('dim');
    for (const n of nodes) if (n.state === 'lit') expect(n.backing.length).toBeGreaterThan(0);
  });

  it('separates the emailed reply read from the upload read', () => {
    id = 0;
    const nodes = buildLoop([
      row('email.received', 'outreach', { attachments: 1 }),
      row('document.read', 'ai', { docId: 'D2', kind: 'paystub', source: 'email', facts: 3 }),
    ]);
    const by = Object.fromEntries(nodes.map((n) => [n.key, n]));
    expect(by.read!.state).toBe('dim');
    expect(by['read-attachment']!.state).toBe('lit');
    expect(by['ledger-3']!.state).toBe('lit');
    expect(by.reply!.note).toBe('1 attachment');
  });

  it('marks a decision as lit only from a decision row', () => {
    id = 0;
    const nodes = buildLoop([row('recompute.done', 'rules'), row('decision.reject', 'human')]);
    const decide = nodes.find((n) => n.key === 'decide')!;
    expect(decide.state).toBe('lit');
    expect(decide.note).toBe('rejected');
    expect(decide.backing.map((r) => r.action)).toEqual(['decision.reject']);
  });
});

describe('util', () => {
  it('normalizes US phone numbers to E.164', () => {
    expect(normalizePhone('(415) 555-0123')).toBe('+14155550123');
    expect(normalizePhone('1 415 555 0123')).toBe('+14155550123');
    expect(normalizePhone('+44 20 7946 0958')).toBe('+442079460958');
    expect(normalizePhone('')).toBe('');
  });
  it('formats reference codes and call times', () => {
    expect(formatRef('482913')).toBe('482 913');
    expect(formatRef('STP-9')).toBe('STP-9');
    expect(mss(42)).toBe('0:42');
    expect(mss(125)).toBe('2:05');
    expect(mss(null)).toBe('');
  });
  it('splits money amounts out of text', () => {
    expect(splitMoney('Gross pay $1,240.00 this period')).toEqual(['Gross pay ', '$1,240.00', ' this period']);
  });
});
