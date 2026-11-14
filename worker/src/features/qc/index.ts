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

function selectedIds(db: Parameters<Feature['register']>[1]['db'], state: string, seed: number): string[] {
  const rows = db.prepare(`SELECT cs.case_id AS id FROM case_state cs JOIN qc_history q ON q.qc_id = cs.qc_id WHERE q.state = ? ORDER BY cs.case_id`).all(state) as { id: string }[];
  let x = (seed >>> 0) || 1;
  const next = () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return x >>> 0; };
  for (let i = rows.length - 1; i > 0; i--) {
    const j = next() % (i + 1);
    [rows[i], rows[j]] = [rows[j]!, rows[i]!];
  }
  return rows.map((r) => r.id);
}

export const feature: Feature = {
  name: 'qc',
  register(app, ctx) {
    app.get(WorkerRoutes.states, (c) => {
      const states = JSON.parse(readFileSync(resolve(ctx.env.ROOT, 'data/states.json'), 'utf8')) as { states: StateProfile[] };
      return c.json(states.states);
    });
    app.get(WorkerRoutes.cases, (c) => {
      const shift = ctx.db.prepare('SELECT case_ids_json FROM shift ORDER BY created_at DESC, rowid DESC LIMIT 1').get() as { case_ids_json: string } | undefined;
      const ids = shift ? JSON.parse(shift.case_ids_json) as string[] : selectedIds(ctx.db, 'CA', ctx.env.QC_SAMPLE_SEED);
      return c.json(ids.flatMap((id) => FIXTURE_QUEUE.filter((q) => q.caseId === id)));
    });
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
      const state = body.state ?? 'CA';
      if (!/^[A-Z]{2}$/.test(state)) return c.json({ error: 'invalid state code' }, 400);
      const seed = Number.isSafeInteger(body.seed) ? body.seed! : ctx.env.QC_SAMPLE_SEED;
      const caseIds = selectedIds(ctx.db, state, seed);
      const createdAt = new Date().toISOString();
      const id = crypto.randomUUID();
      ctx.db.prepare('INSERT INTO shift (id, state, seed, case_ids_json, created_at) VALUES (?, ?, ?, ?, ?)').run(id, state, seed, JSON.stringify(caseIds), createdAt);
      return c.json({ id, state, seed, caseIds, createdAt, prov: 'fixture' });
    });
  },
  status(ctx) {
    const n = (ctx.db.prepare("SELECT COUNT(*) AS n FROM qc_history WHERE source = 'qc_file'").get() as { n: number }).n;
    return stubStatus('sqlite', n > 0 ? 'live' : 'fixture', n > 0 ? `qc_history: ${n} rows from the QC file` : 'qc_history from data/golden until the QC file is ingested');
  },
};
