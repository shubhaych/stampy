import { describe, expect, it } from 'vitest';
import { GC1_BUNDLE, GC1_WORKED_BUNDLE, GC4_BUNDLE } from '@stampy/contracts/fixtures';
import { buildPipeline } from './graph';

describe('decision pipeline graph', () => {
  it('every lit node has at least one backing row', () => {
    for (const b of [GC1_BUNDLE, GC1_WORKED_BUNDLE, GC4_BUNDLE]) {
      const { nodes } = buildPipeline(b);
      for (const n of nodes) if (n.prov !== null) expect(n.rows.length, `${b.case.id}:${n.id}`).toBeGreaterThan(0);
    }
  });
  it('GC-1 worked lights the employer path end to end and leaves other channels dim', () => {
    const { nodes, edges } = buildPipeline(GC1_WORKED_BUNDLE);
    const lit = (id: string) => nodes.find((n) => n.id === id)!.rows.length > 0;
    expect(['documents', 'budget', 'ledger', 'question', 'planner', 'employer', 'writeback', 'rules', 'decide'].every(lit)).toBe(true);
    expect(lit('text')).toBe(false);
    expect(edges.find((e) => e.from === 'rules' && e.to === 'decide')!.lit).toBe(true);
  });
  it('GC-1 before the worker acts: nothing human is lit', () => {
    const { nodes } = buildPipeline(GC1_BUNDLE);
    expect(nodes.find((n) => n.id === 'decide')!.rows).toHaveLength(0);
  });
});
