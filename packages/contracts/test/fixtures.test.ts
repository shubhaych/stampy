import { describe, expect, it } from 'vitest';
import { CaseBundle, Debrief, QueueItem, SystemStatus } from '../src/index';
import { FIXTURE_QUEUE, FIXTURE_SYSTEM_STATUS, GOLDEN_BUNDLES, GOLDEN_DEBRIEFS, GC1_WORKED_BUNDLE } from '../fixtures/index';

describe('golden fixtures match the contracts', () => {
  it.each(GOLDEN_BUNDLES.map((b) => [b.case.id, b] as const))('%s parses as CaseBundle', (_id, b) => {
    expect(() => CaseBundle.parse(b)).not.toThrow();
  });
  it('GC-1 worked parses', () => expect(() => CaseBundle.parse(GC1_WORKED_BUNDLE)).not.toThrow());
  it('debriefs, queue and status parse', () => {
    GOLDEN_DEBRIEFS.forEach((d) => Debrief.parse(d));
    FIXTURE_QUEUE.forEach((q) => QueueItem.parse(q));
    SystemStatus.parse(FIXTURE_SYSTEM_STATUS);
  });
  it('GC-4 is clean: the AI says nothing', () => {
    const gc4 = GOLDEN_BUNDLES.find((b) => b.case.id === 'GC-4')!;
    expect(gc4.flags).toHaveLength(0);
    expect(gc4.questions).toHaveLength(0);
  });
  it('bundles never carry QC-verified truth', () => {
    for (const b of GOLDEN_BUNDLES) expect(JSON.stringify(b)).not.toMatch(/qcVerified|case_truth/);
  });
  it('fixture citations never carry policy text from memory', () => {
    for (const b of GOLDEN_BUNDLES) for (const f of b.flags) for (const c of f.citations) {
      expect(c.text).toBeNull();
      expect(c.verified).toBe(false);
    }
  });
});
