'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { Badge, Fig } from '@/components/ui';

const count = z.number().int().nonnegative();
const httpsUrl = z.string().url().refine((url) => url.startsWith('https://'));
const State = z.object({ code: z.string(), name: z.string(), count });
const Release = z.object({
  fiscalYear: z.number().int(), catalogUrl: httpsUrl, sourceUrl: httpsUrl, dictionaryUrl: httpsUrl,
  archiveSha256: z.string().regex(/^[a-f0-9]{64}$/i), csvSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  indexSha256: z.string().regex(/^[a-f0-9]{64}$/i), archiveMember: z.string(), retrievedAt: z.string(),
  rowCount: count, columnCount: count, bytes: count, states: State.array(),
});
const RecordSchema = z.object({
  id: z.string(), householdId: z.string(), state: z.string(), stateName: z.string(), stateFips: z.string(),
  sampleMonth: z.string(), householdSize: z.number().nullable(), benefitMonthly: z.number().nullable(),
  sourceRecord: z.number().int().positive(), prov: z.literal('replay'),
});
const Status = z.object({ available: z.boolean(), prov: z.literal('replay'), rowCount: count, states: State.array(), release: Release.nullable() });
const Page = z.object({ items: RecordSchema.array(), total: count, offset: count, limit: z.number().int().positive(), release: Release, prov: z.literal('replay') });
const Detail = z.object({ record: RecordSchema, release: Release, prov: z.literal('replay') });
type RecordValue = z.infer<typeof RecordSchema>;
type ReleaseValue = z.infer<typeof Release>;

async function read<S extends z.ZodType>(path: string, schema: S, signal: AbortSignal): Promise<z.infer<S>> {
  let response: Response;
  try { response = await fetch(`/cases/qc/data${path.slice(3)}`, { cache: 'no-store', signal }); }
  catch (error) { if (signal.aborted) throw error; throw new Error('The QC worker is unavailable. Retry when it is running.'); }
  if (!response.ok) {
    if (response.status === 404) throw new Error('The QC source or route was not found on this worker.');
    if (response.status === 503) {
      const body = await response.json().catch(() => null);
      throw new Error(typeof body?.error === 'string' ? body.error : 'The QC worker or its imported records are not available yet.');
    }
    throw new Error('The worker could not load these QC records. Please retry.');
  }
  const parsed = schema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new Error('The QC worker returned an incompatible response. No source records were displayed.');
  return parsed.data;
}

function useStatus(revision: number) {
  const [status, setStatus] = useState<z.infer<typeof Status> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const control = new AbortController();
    setError(null);
    void read('/qc/status', Status, control.signal).then((data) => { if (!control.signal.aborted) setStatus(data); })
      .catch((e: Error) => { if (!control.signal.aborted) setError(e.message); });
    return () => control.abort();
  }, [revision]);
  return { status, error };
}

/** Live import availability for the source catalog; never substitutes generated samples. */
export function QcImportStatus() {
  const [revision, setRevision] = useState(0);
  const { status, error } = useStatus(revision);
  return <div>
    {error ? <p role="alert">{error}</p> : status ? status.available ?
      <p>Local import available: <Fig prov="replay">{status.rowCount.toLocaleString()} records</Fig> across <Fig prov="replay">{status.states.length} jurisdictions</Fig>.</p> :
      <p>Local import: not loaded.</p> : <p role="status">Checking local import…</p>}
    <div className="flex flex-wrap gap-4">
      <Link className="stp-link" href="/cases/qc">Browse public records →</Link>
      {error && <button type="button" className="stp-link" onClick={() => setRevision((n) => n + 1)}>Retry import status</button>}
    </div>
  </div>;
}

export function QcBrowser() {
  const [revision, setRevision] = useState(0);
  const { status, error: statusError } = useStatus(revision);
  const [state, setState] = useState('');
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<z.infer<typeof Page> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<z.infer<typeof Detail> | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const first = useRef(true);

  useEffect(() => {
    const control = new AbortController();
    setPage(null); setLoading(true); setError(null); setDetail(null);
    // A link from a case (?record=qc-2024-…) opens straight onto that published row.
    const linked = first.current ? new URLSearchParams(window.location.search).get('record') : null;
    first.current = false;
    setSelected(linked && /^qc-\d{4}-\d+$/.test(linked) ? linked : null);
    const query = new URLSearchParams({ offset: String(offset), limit: '25' });
    if (state) query.set('state', state);
    void read(`/qc/cases?${query}`, Page, control.signal).then((data) => { if (!control.signal.aborted) setPage(data); })
      .catch((e: Error) => { if (!control.signal.aborted) setError(e.message); })
      .finally(() => { if (!control.signal.aborted) setLoading(false); });
    return () => control.abort();
  }, [state, offset, revision]);

  useEffect(() => {
    const control = new AbortController();
    setDetail(null); setDetailError(null);
    if (selected) void read(`/qc/cases/${encodeURIComponent(selected)}`, Detail, control.signal)
      .then((data) => { if (!control.signal.aborted) setDetail(data); })
      .catch((e: Error) => { if (!control.signal.aborted) setDetailError(e.message); });
    return () => control.abort();
  }, [selected]);

  const release = page?.release ?? status?.release;
  return <>
    <div className="qc-toolbar">
      <label>State or jurisdiction<select aria-label="QC state" value={state} onChange={(e) => { setState(e.target.value); setOffset(0); }}>
        <option value="">All loaded jurisdictions</option>
        {(status?.states ?? page?.release.states ?? []).map((s) => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
      </select></label>
      <div className="qc-toolbar__summary">{release ? <><Fig prov="replay">FY {release.fiscalYear}</Fig><span>{release.archiveMember}</span></> : <span>Source release not loaded</span>}</div>
      <button type="button" className="btn btn--ghost" disabled={loading} onClick={() => setRevision((n) => n + 1)}>Refresh records</button>
    </div>
    {statusError && !page && !error && <p role="alert" className="qc-error">{statusError}</p>}
    {error && <p role="alert" className="qc-error">{error} The worker queue is available separately at <Link href="/cases">Applications</Link>.</p>}
    <div className={`qc-desk ${selected ? 'qc-desk--selected' : ''}`}>
      <section className="qc-list" aria-label="Public QC records">
        {loading ? <p role="status" className="qc-empty">Loading source records…</p> : page && page.items.length === 0 ? <p className="qc-empty">No public records match this state.</p> : page && <>
          <div className="qc-table-wrap"><table className="qc-table">
            <thead><tr><th scope="col">Household ID</th><th scope="col">State</th><th scope="col">Sample month</th><th scope="col">Certified size</th><th scope="col">Issued benefit</th></tr></thead>
            <tbody>{page.items.map((record) => <tr key={record.id} className={selected === record.id ? 'qc-row--selected' : ''}>
              <td><button type="button" className="qc-record-link" aria-pressed={selected === record.id} onClick={() => setSelected(record.id)}><Fig prov="replay">{record.householdId}</Fig></button></td>
              <td>{record.state}</td><td><Fig prov="replay">{record.sampleMonth}</Fig></td>
              <td>{record.householdSize === null ? 'not loaded' : <Fig prov="replay">{record.householdSize}</Fig>}</td>
              <td>{record.benefitMonthly === null ? 'not loaded' : <Fig prov="replay">{record.benefitMonthly.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</Fig>}</td>
            </tr>)}</tbody>
          </table></div>
          <nav className="qc-pagination" aria-label="QC pagination">
            <Fig prov="replay">{page.total === 0 ? 0 : page.offset + 1}–{page.offset + page.items.length} of {page.total.toLocaleString()}</Fig>
            <div><button type="button" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - page.limit))}>Previous</button><button type="button" disabled={page.offset + page.items.length >= page.total || loading} onClick={() => setOffset(offset + page.limit)}>Next</button></div>
          </nav>
        </>}
      </section>
      <aside className="qc-detail" aria-label="Source record detail">
        {selected ? <><button type="button" className="qc-close" onClick={() => setSelected(null)}>Close record ×</button>{detailError ? <p role="alert">{detailError}</p> : detail ? <RecordDetail record={detail.record} release={detail.release} /> : <p role="status">Loading record proof…</p>}</> : <div className="qc-empty"><h2>Inspect the source</h2><p>Select a household ID to see its published column values, source row and release checksum.</p><Badge kind="replay" /></div>}
      </aside>
    </div>
    {release && <p className="qc-source-line">Downloaded public release · <a href={release.sourceUrl} target="_blank" rel="noreferrer">Source archive ↗</a> · <a href={release.dictionaryUrl} target="_blank" rel="noreferrer">Data dictionary ↗</a></p>}
  </>;
}

function RecordDetail({ record, release }: { record: RecordValue; release: ReleaseValue }) {
  return <>
    <div className="qc-detail__heading"><span className="eyebrow">Published source record</span><h2>{record.stateName}</h2><Badge kind="replay" /></div>
    <p className="qc-detail__note">Anonymized public-use record. The ID identifies a row in this release, not a caseworker application.</p>
    <dl className="qc-values">
      <div><dt>HHLDNO <small>Public household identifier</small></dt><dd><Fig prov="replay">{record.householdId}</Fig></dd></div>
      <div><dt>STATE <small>State FIPS code</small></dt><dd><Fig prov="replay">{record.stateFips}</Fig> · {record.state}</dd></div>
      <div><dt>YRMONTH <small>Sample month, normalized display</small></dt><dd><Fig prov="replay">{record.sampleMonth}</Fig></dd></div>
      <div><dt>CERTHHSZ <small>State-certified household size</small></dt><dd>{record.householdSize === null ? 'not loaded' : <Fig prov="replay">{record.householdSize}</Fig>}</dd></div>
      <div><dt>RAWBEN <small>Issued benefit recorded in source</small></dt><dd>{record.benefitMonthly === null ? 'not loaded' : <Fig prov="replay">{record.benefitMonthly.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</Fig>}</dd></div>
    </dl>
    <details className="qc-proof" open><summary>Source proof</summary>
      <dl><dt>Data record index (header excluded)</dt><dd><Fig prov="replay">{record.sourceRecord}</Fig></dd><dt>Archive member</dt><dd>{release.archiveMember}</dd><dt>Retrieved</dt><dd><Fig prov="replay">{release.retrievedAt}</Fig></dd><dt>Archive SHA-256</dt><dd><code>{release.archiveSha256}</code></dd><dt>CSV SHA-256</dt><dd><code>{release.csvSha256}</code></dd></dl>
      <a href={release.sourceUrl} target="_blank" rel="noreferrer">Download source archive ↗</a>
    </details>
  </>;
}
