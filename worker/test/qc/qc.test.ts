import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { csvRows, projectCsv, PublicRecord, ingestArchive } from '../../src/qc/ingest';
import { registerQc } from '../../src/qc/routes';

const header = 'HHLDNO,STATE,STATENAME,YRMONTH,CERTHHSZ,RAWBEN,FSBEN,FSGRINC,STATUS';
const row = '4118,36,New York,202310,1,291,999,9999,2';

describe('public QC projection', () => {
  it('preserves recorded certified values and excludes QC results and income', () => {
    const [record] = projectCsv(`${header}\n${row}\n`, { rowCount: 1, columnCount: 9 });
    expect(record).toEqual({ id: 'qc-2024-4118', householdId: '4118', state: 'NY', stateFips: '36', stateName: 'New York', sampleMonth: '2023-10', householdSize: 1, benefitMonthly: 291, sourceRecord: 1, prov: 'replay' });
    expect(JSON.stringify(record)).not.toMatch(/FSBEN|FSGRINC|STATUS|9999/);
    expect(PublicRecord.parse({ ...record, case_truth: 'secret' })).not.toHaveProperty('case_truth');
  });
  it('supports quoted fields, commas, escaped quotes, CRLF and multiline CSV', () => {
    expect([...csvRows('A,B\r\n"a,b","say ""hi""\nnext"\r\n')]).toEqual([['A','B'], ['a,b','say "hi"\nnext']]);
    expect(() => [...csvRows('A\n"unfinished')]).toThrow('Unterminated');
  });
  it('rejects changed row counts, duplicate IDs and invalid states/months', () => {
    expect(() => projectCsv(`${header}\n${row}`, { rowCount: 2, columnCount: 9 })).toThrow('Row count');
    expect(() => projectCsv(`${header}\n${row}\n${row}`)).toThrow('duplicate');
    expect(() => projectCsv(`${header}\n${row.replace(',36,', ',99,')}`)).toThrow('Unknown state');
    expect(() => projectCsv(`${header}\n${row.replace('202310', '202410')}`)).toThrow('Sample month');
  });
  it('preserves absent values as null, not zero', () => {
    const [record] = projectCsv(`${header}\n4118,36,New York,202310,.,,999,9999,2`);
    expect(record!.householdSize).toBeNull(); expect(record!.benefitMonthly).toBeNull();
  });
  it('rejects error pages or unexpected releases before writing source files', () => {
    expect(() => ingestArchive(Buffer.from('<html>403</html>'), '/unreachable')).toThrow('pinned');
  });
});

describe('public QC API unavailable cache', () => {
  const app = new Hono(); registerQc(app, '/tmp/stampy-test-qc-missing-cache');
  it('reports absent data truthfully', async () => {
    const status = await app.request('/qc/status');
    expect(await status.json()).toMatchObject({ available: false, rowCount: 0, release: null });
    expect((await app.request('/qc/cases')).status).toBe(503);
  });
  it('validates pagination and state filters before reading data', async () => {
    for (const query of ['state=ZZ', 'limit=9999', 'offset=-1', 'offset=1.5', 'limit=0']) expect((await app.request(`/qc/cases?${query}`)).status).toBe(400);
  });
});
