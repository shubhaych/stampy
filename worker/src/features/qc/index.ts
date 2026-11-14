/**
 * qc-data (machine B). Scaffold: serves the golden fixtures until the USDA QC file is ingested.
 * TODO(qc-data): column-map.ts from the official data dictionary, ingest into qc_history,
 * seeded case builder (build-case.ts), state profiles from the state_profile view.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WorkerRoutes, type StateProfile } from '@cleancase/contracts';
import { FIXTURE_QUEUE, GOLDEN_BUNDLES, GOLDEN_DEBRIEFS } from '@cleancase/contracts/fixtures';
import type { Feature } from '../types';
import { stubStatus } from '../types';

export const feature: Feature = {
  name: 'qc',
  register(app, ctx) {
    app.get(WorkerRoutes.states, (c) => {
      const states = JSON.parse(readFileSync(resolve(ctx.env.ROOT, 'data/states.json'), 'utf8')) as { states: StateProfile[] };
      return c.json(states.states);
    });
    app.get(WorkerRoutes.cases, (c) => c.json(FIXTURE_QUEUE));
    app.get('/cases/:id', (c) => {
      const b = GOLDEN_BUNDLES.find((x) => x.case.id === c.req.param('id'));
      return b ? c.json(b) : c.json({ error: 'not found' }, 404);
    });
    app.get('/cases/:id/debrief', (c) => {
      const id = c.req.param('id');
      const cs = ctx.db.prepare('SELECT status FROM case_state WHERE case_id = ?').get(id) as { status: string } | undefined;
      if (cs?.status !== 'certified') return c.json({ error: 'debrief is available after the worker certifies the case' }, 423);
      const d = GOLDEN_DEBRIEFS.find((x) => x.caseId === id);
      return d ? c.json(d) : c.json({ error: 'not found' }, 404);
    });
    app.post(WorkerRoutes.shift, async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as { state?: string; seed?: number };
      return c.json({ id: `SHIFT-${body.state ?? 'CA'}-${body.seed ?? ctx.env.QC_SAMPLE_SEED}`, state: body.state ?? 'CA', seed: body.seed ?? ctx.env.QC_SAMPLE_SEED, caseIds: FIXTURE_QUEUE.map((q) => q.caseId), createdAt: new Date().toISOString(), prov: 'fixture' });
    });
  },
  status(ctx) {
    const n = (ctx.db.prepare("SELECT COUNT(*) AS n FROM qc_history WHERE source = 'qc_file'").get() as { n: number }).n;
    return stubStatus('sqlite', n > 0 ? 'live' : 'fixture', n > 0 ? `qc_history: ${n} rows from the QC file` : 'qc_history from data/golden until the QC file is ingested');
  },
};
