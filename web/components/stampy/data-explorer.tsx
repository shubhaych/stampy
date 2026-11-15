'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Shuffle } from 'lucide-react';
import { z } from 'zod';
import { Badge, Direction, Fig } from '@/components/ui';
import { money } from '@/lib/format';
import { ROUTES } from '@/lib/routes';
import { DEMO, PAY_A, PAY_B, PAY_DATE, demoFiles, svgUrl } from '@/lib/stampy/demo-case';
import { ErrorLine } from './common';

const Finding = z.object({
  direction: z.enum(['over', 'under']), errorAmount: z.number(), element: z.string(), elementLabel: z.string(), nature: z.string(),
  earnedMonthly: z.number(), rentMonthly: z.number(), size: z.number(),
});
const Item = z.object({
  id: z.string(), householdId: z.string(), state: z.string(), stateName: z.string(), stateFips: z.string(), sampleMonth: z.string(),
  householdSize: z.number().nullable(), benefitMonthly: z.number().nullable(), sourceRecord: z.number(), finding: Finding,
});
const Page = z.object({
  items: Item.array(), pool: z.number(), total: z.number(),
  release: z.object({ fiscalYear: z.number(), rowCount: z.number(), archiveMember: z.string(), archiveSha256: z.string(), sourceUrl: z.string(), dictionaryUrl: z.string() }),
});
type Item = z.infer<typeof Item>;

/** Where each kind of finding usually comes from. General causes, not a claim about any one household. */
const CAUSES: Record<string, { field: 'FSEARN' | 'RENT' | 'CERTHHSZ'; causes: string[] }> = {
  '311': { field: 'FSEARN', causes: ['A paycheck every two weeks is entered as monthly pay, or the reverse.', 'A raise, new job or change in hours never reaches the case file.', 'An old paystub is used for current income.'] },
  '363': { field: 'RENT', causes: ['Rent changed after the last certification.', 'Rent is entered without a lease or receipt to back it.', 'Shared rent is counted in full for one household.'] },
  '364': { field: 'RENT', causes: ['A utility allowance is given when utilities are included in the rent.', 'The wrong allowance level is applied.'] },
  '150': { field: 'CERTHHSZ', causes: ['Someone moved in or out and the case file was not updated.', 'A person who buys and prepares food separately is counted in the household.'] },
};

const monthLabel = (ym: string) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const newSeed = () => Math.floor(Math.random() * 1_000_000);

export function DataExplorer() {
  const [seed, setSeed] = useState<number | null>(null);
  const [page, setPage] = useState<z.infer<typeof Page> | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setSeed(newSeed()); }, []);
  useEffect(() => {
    if (seed === null) return;
    let live = true;
    setError(null);
    fetch(`/cases/qc/data/findings?seed=${seed}&limit=10`, { cache: 'no-store' })
      .then(async (r) => { const body = await r.json().catch(() => null); if (!r.ok) throw new Error(body?.error ?? 'Records could not be loaded.'); return Page.parse(body); })
      .then((p) => { if (live) { setPage(p); setSelected(p.items[0]?.id ?? null); } })
      .catch((e: Error) => { if (live) setError(e.message.startsWith('[') ? 'The records service returned an unexpected response.' : e.message); });
    return () => { live = false; };
  }, [seed]);

  const record = page?.items.find((r) => r.id === selected) ?? null;
  return (
    <>
      <DemoCase />
      <ErrorLine error={error} />
      {page && (
        <p className="dx-count">
          <Fig prov="replay">{page.release.rowCount.toLocaleString()}</Fig> households reviewed in fiscal year {page.release.fiscalYear}.{' '}
          <Fig prov="replay">{page.total.toLocaleString()}</Fig> were paid the wrong amount, too much or too little.
        </p>
      )}
      <div className="dx-grid">
        <section aria-label="Records">
          <div className="cq-head">
            <div><h2>Sample data <Badge kind="replay" /></h2><p>Click a record to see where errors normally lie.</p></div>
            <button type="button" className="cq-quiet" disabled={!page} onClick={() => { setPage(null); setSeed(newSeed()); }}><Shuffle size={15} aria-hidden /> Show others</button>
          </div>
          <ul className="cq-list dx-list">
            {!page && !error && Array.from({ length: 8 }, (_, i) => <li key={i} className="cq-row cq-row--loading" style={{ height: 58 }} />)}
            {page?.items.map((r) => (
              <li key={r.id}>
                <button type="button" aria-pressed={r.id === selected} onClick={() => setSelected(r.id)}>
                  <span><strong>{r.stateName}</strong><small>Household {r.householdId} · {r.finding.elementLabel}</small></span>
                  <span className="dx-list__amt"><Direction dir={r.finding.direction} /> <Fig prov="replay">{money(r.finding.errorAmount)}</Fig></span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {record && page && <RecordSheet record={record} release={page.release} />}
      </div>
    </>
  );
}

function RecordSheet({ record, release }: { record: Item; release: z.infer<typeof Page>['release'] }) {
  const f = record.finding;
  const cause = CAUSES[f.element]!;
  const over = f.direction === 'over';
  const rows: { col: string; meaning: string; value: React.ReactNode; ring?: boolean }[] = [
    { col: 'HHLDNO', meaning: 'Public household number', value: record.householdId },
    { col: 'STATE', meaning: 'State', value: `${record.stateName} (${record.stateFips})` },
    { col: 'YRMONTH', meaning: 'Month reviewed', value: monthLabel(record.sampleMonth) },
    { col: 'CERTHHSZ', meaning: 'People in the household', value: record.householdSize, ring: cause.field === 'CERTHHSZ' },
    { col: 'FSEARN', meaning: 'Earnings verified by the reviewer, per month', value: money(f.earnedMonthly), ring: cause.field === 'FSEARN' },
    { col: 'RENT', meaning: 'Rent verified by the reviewer, per month', value: money(f.rentMonthly), ring: cause.field === 'RENT' },
    { col: 'RAWBEN', meaning: 'Benefit the state issued', value: money(record.benefitMonthly ?? 0) },
    { col: 'STATUS', meaning: 'Review result', value: over ? '2 · paid too much' : '3 · paid too little', ring: true },
    { col: 'AMTERR', meaning: 'Dollars in error, per month', value: money(f.errorAmount), ring: true },
    { col: 'ELEMENT1', meaning: 'Where the error was', value: `${f.element} · ${f.elementLabel}`, ring: true },
  ];
  return (
    <section className="dx-sheet" aria-label="Selected record" key={record.id}>
      <header>
        <h2>{record.stateName}, {monthLabel(record.sampleMonth)}</h2>
        <p>Row <Fig prov="replay">{record.sourceRecord.toLocaleString()}</Fig> of {release.archiveMember}</p>
      </header>
      <p className="dx-headline">
        The state issued <Fig prov="replay">{money(record.benefitMonthly ?? 0)}</Fig> a month. Reviewers found that was{' '}
        <strong data-dir={f.direction}><Fig prov="replay">{money(f.errorAmount)}</Fig> {over ? 'too much' : 'too little'}</strong>, and traced it to {f.elementLabel.toLowerCase()}.
      </p>
      <table className="dx-table">
        <thead><tr><th scope="col">Column</th><th scope="col">What it means</th><th scope="col">Published value</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.col} data-ring={r.ring ? '' : undefined}>
              <td><code>{r.col}</code></td>
              <td>{r.meaning}</td>
              <td><span className={r.ring ? 'dx-ring' : undefined} data-dir={r.ring ? f.direction : undefined}><Fig prov="replay">{r.value}</Fig></span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="dx-why">
        <h3>What usually causes a {f.elementLabel.toLowerCase()} error</h3>
        <ul>{cause.causes.map((c) => <li key={c}>{c}</li>)}</ul>
        <p>All of these are visible in the case file before the benefit goes out. That is the check Stampy runs.</p>
        <Link className="dx-next" href={ROUTES.apply}>See it on a live application <ArrowRight size={16} aria-hidden /></Link>
      </div>
      <p className="cq-source">
        USDA SNAP Quality Control public-use file, fiscal year {release.fiscalYear}. Archive SHA-256 <code title={release.archiveSha256}>{release.archiveSha256.slice(0, 12)}…</code>
        {' · '}<a href={release.sourceUrl} target="_blank" rel="noreferrer">Download the archive ↗</a>
        {' · '}<a href={release.dictionaryUrl} target="_blank" rel="noreferrer">Data dictionary ↗</a>
        {' · '}Cause lists are general; the file does not say which one applied to this household.
      </p>
    </section>
  );
}

/** The one case used in the live demo: its three files, with the problem circled. */
function DemoCase() {
  const [open, setOpen] = useState(true);
  const [focus, setFocus] = useState<'record' | 'stubA' | 'stubB'>('stubB');
  const files = demoFiles(DEMO.name, true);
  return (
    <section className="dx-demo" aria-labelledby="dx-demo-title">
      <div className="dx-demo__head">
        <div>
          <h2 id="dx-demo-title">The case in this demo: {DEMO.name} <Badge kind="synthetic" /></h2>
          <p>Three files, one problem. The same kind of wage error the federal records below are full of.</p>
        </div>
        <button type="button" className="btn btn--primary" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? 'Hide the files' : 'Show the files and the error'}</button>
      </div>
      {open && (
        <div className="dx-demo__body">
          <div className="dx-demo__pages">
            {files.map((f) => (
              <button key={f.key} type="button" aria-pressed={f.key === focus} onClick={() => setFocus(f.key)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={svgUrl(f.svg)} alt={`${f.title} with the relevant lines circled`} />
                <span><strong>{f.title}</strong> <Fig prov="synthetic">{f.blurb}</Fig></span>
              </button>
            ))}
          </div>
          <div className="dx-demo__story">
            <h3>What went wrong</h3>
            <ol>
              <li data-on={focus === 'stubA' ? '' : undefined}><button type="button" onClick={() => setFocus('stubA')}><strong>One paystub dated {PAY_DATE}</strong> shows gross pay of <Fig prov="synthetic">{PAY_A}</Fig>.</button></li>
              <li data-on={focus === 'stubB' ? '' : undefined}><button type="button" onClick={() => setFocus('stubB')}><strong>A second paystub, same date,</strong> shows <Fig prov="synthetic">{PAY_B}</Fig>.</button></li>
              <li data-on={focus === 'record' ? '' : undefined}><button type="button" onClick={() => setFocus('record')}><strong>The case file was budgeted from one of them.</strong> Nobody noticed there were two.</button></li>
            </ol>
            <p>Both cannot be right. Whichever is wrong, the benefit is wrong with it, every month, until someone catches it.</p>
            <p className="dx-demo__fix"><strong>What Stampy does:</strong> reads all three files, opens one question, and calls {DEMO.name.split(' ')[0]} to confirm which paystub is correct. The benefit is recalculated and the caseworker approves it.</p>
            <Link className="dx-next" href={ROUTES.apply}>Apply with these files <ArrowRight size={16} aria-hidden /></Link>
          </div>
        </div>
      )}
    </section>
  );
}
