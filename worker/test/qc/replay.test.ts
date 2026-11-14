import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { featured, replayFile } from '../../src/qc/replay';
import { QC_DIRECTORY } from '../../src/qc/store';

// The public file is downloaded, not committed; these run wherever `scripts/qc-ingest.ts` has been run.
const loaded = existsSync(join(QC_DIRECTORY, 'qc_pub_fy2024.csv')) && existsSync(join(QC_DIRECTORY, 'manifest.json'));

describe.skipIf(!loaded)('replay cases from the public QC file', () => {
  it('picks the same households for the same seed and different ones for another', () => {
    const a = featured(7, 6)!, b = featured(7, 6)!, c = featured(8, 6)!;
    expect(a.items).toHaveLength(6);
    expect(a.items.map((r) => r.id)).toEqual(b.items.map((r) => r.id));
    expect(a.items.map((r) => r.id)).not.toEqual(c.items.map((r) => r.id));
  });
  it('lists only the certified projection: no QC finding, direction or verified income', () => {
    for (const item of featured(11, 6)!.items) {
      expect(Object.keys(item).sort()).toEqual(['benefitMonthly', 'householdId', 'householdSize', 'id', 'outreach', 'prov', 'sampleMonth', 'sourceRecord', 'state', 'stateFips', 'stateName']);
      expect(item.outreach).toEqual(['email', 'call']);
    }
  });
  it('builds a labelled synthetic file whose form and paystub disagree on pay frequency, with an old paystub', () => {
    const file = replayFile(featured(3, 6)!.items[0]!.id)!;
    expect(file.documents.map((d) => d.name)).toEqual(['application', 'paystub', 'lease']);
    for (const d of [...file.documents, file.reply]) {
      expect(d.svg).toContain(`public record ${file.record.householdId}`);
      expect(d.svg).toContain('No real applicant');
      expect(d.filename).toMatch(/^qc-2024-\d+-[a-z-]+\.png$/);
    }
    expect(file.documents[1]!.svg).toContain('Biweekly');
    const date = (svg: string) => { const [m, d, y] = /Pay date<\/text><text[^>]*>(\d\d)\/(\d\d)\/(\d{4})/.exec(svg)!.slice(1); return Date.parse(`${y}-${m}-${d}`); };
    const applied = Date.parse(file.applicationDate);
    expect((applied - date(file.documents[1]!.svg)) / 86_400_000).toBeGreaterThan(30);
    expect((applied - date(file.reply.svg)) / 86_400_000).toBeLessThan(30);
  });
  it('refuses records outside the replay pool', () => {
    expect(replayFile('qc-2024-0')).toBeNull();
  });
});
