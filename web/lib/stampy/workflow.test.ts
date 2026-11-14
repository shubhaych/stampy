import { describe, expect, it } from 'vitest';
import { FIXTURE_BUNDLE } from './fixture';
import { decisionReady, evidenceProvenance, nextStep } from './workflow';

const bundle = () => structuredClone(FIXTURE_BUNDLE);
describe('worker guidance', () => {
  it('keeps generated evidence synthetic even with live AI', () => {
    const b = bundle(); b.modes.ai = 'live';
    expect(evidenceProvenance(b)).toBe('synthetic');
  });
  it('does not treat a ready status as permission to decide when questions remain', () => {
    const b = bundle(); b.questions[0]!.status = 'open';
    expect(decisionReady(b)).toBe(false);
    expect(nextStep(b).target).toBe('stp-questions');
  });
  it('requires completed reads and actual benefit calculations', () => {
    const b = bundle(); b.documents[0]!.readStatus = 'failed';
    expect(decisionReady(b)).toBe(false);
    expect(nextStep(b).target).toBe('stp-documents');
    b.documents[0]!.readStatus = 'read'; b.recompute!.after.benefitMonthly = null;
    expect(decisionReady(b)).toBe(false);
    expect(nextStep(b).target).toBe('stp-budget');
  });
  it('guides a failed send back to its draft, without sending automatically', () => {
    const b = bundle(); b.outreach[0]!.status = 'failed';
    expect(nextStep(b).target).toBe('stp-outreach');
  });
  it('allows a reviewed proposal but not a second decision', () => {
    const b = bundle(); expect(decisionReady(b)).toBe(true);
    b.decision = { id: 'test', caseId: b.case.id, action: 'approve', recomputeId: b.recompute!.id, decidedBy: 'worker:test', note: null, at: b.case.updatedAt };
    expect(decisionReady(b)).toBe(false);
  });
});
