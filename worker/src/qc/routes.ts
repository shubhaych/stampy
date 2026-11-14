import type { Hono } from 'hono';
import { loadSnapshot, QC_DIRECTORY } from './store';
import { STATE_CODES } from './release';
import { featured, replayFile } from './replay';

/** Read-only public data. These records are not applicant cases and cannot trigger outreach or decisions. */
export function registerQc(app: Hono, directory = QC_DIRECTORY) {
  app.get('/qc/status', (c) => {
    try {
      const snapshot = loadSnapshot(directory);
      return c.json({ available: !!snapshot, prov: 'replay', rowCount: snapshot?.records.length ?? 0, states: snapshot?.release.states ?? [], release: snapshot?.release ?? null });
    } catch { return c.json({ error: 'QC cache validation failed. Re-run the importer before using these records.' }, 503); }
  });
  app.get('/qc/cases', (c) => {
    const state = c.req.query('state')?.toUpperCase();
    const offsetText = c.req.query('offset') ?? '0', limitText = c.req.query('limit') ?? '25';
    if ((state && !Object.values(STATE_CODES).includes(state)) || !/^\d+$/.test(offsetText) || !/^\d+$/.test(limitText)) return c.json({ error: 'Invalid state, offset or limit' }, 400);
    const offset = Number(offsetText), limit = Number(limitText);
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) return c.json({ error: 'Offset must be nonnegative; limit must be between 1 and 100' }, 400);
    try {
      const snapshot = loadSnapshot(directory);
      if (!snapshot) return c.json({ error: 'QC records are not loaded. Run node --import tsx scripts/qc-ingest.ts.' }, 503);
      const rows = state ? snapshot.records.filter((r) => r.state === state) : snapshot.records;
      return c.json({ items: rows.slice(offset, offset + limit), total: rows.length, offset, limit, release: snapshot.release, prov: 'replay' });
    } catch { return c.json({ error: 'QC cache validation failed. Re-run the importer before using these records.' }, 503); }
  });
  app.get('/qc/featured', (c) => {
    const seedText = c.req.query('seed') ?? '1', limitText = c.req.query('limit') ?? '6';
    if (!/^\d{1,9}$/.test(seedText) || !/^\d{1,2}$/.test(limitText) || Number(limitText) < 1 || Number(limitText) > 12) return c.json({ error: 'Invalid seed or limit' }, 400);
    try {
      const snapshot = loadSnapshot(directory);
      const picked = featured(Number(seedText), Number(limitText), directory);
      if (!snapshot || !picked) return c.json({ error: 'QC records are not loaded. Run node --import tsx scripts/qc-ingest.ts.' }, 503);
      return c.json({ ...picked, release: snapshot.release, prov: 'replay' });
    } catch { return c.json({ error: 'QC cache validation failed. Re-run the importer before using these records.' }, 503); }
  });
  app.get('/qc/cases/:id/documents', (c) => {
    try {
      const file = replayFile(c.req.param('id'), directory);
      if (!file) return c.json({ error: 'This record cannot be replayed as a case file.' }, 404);
      return c.json({ ...file, prov: 'synthetic' });
    } catch { return c.json({ error: 'QC cache validation failed. Re-run the importer before using these records.' }, 503); }
  });
  app.get('/qc/cases/:id', (c) => {
    try {
      const snapshot = loadSnapshot(directory);
      if (!snapshot) return c.json({ error: 'QC records are not loaded. Run node --import tsx scripts/qc-ingest.ts.' }, 503);
      const record = snapshot.records.find((r) => r.id === c.req.param('id'));
      if (!record) return c.json({ error: 'QC record not found' }, 404);
      return c.json({ record, release: snapshot.release, prov: 'replay' });
    } catch { return c.json({ error: 'QC cache validation failed. Re-run the importer before using these records.' }, 503); }
  });
}
