'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { CaseBundle, Flag, StationId } from '@cleancase/contracts';
import { STATIONS } from '@cleancase/snap-rules';
import { Badge, ClockChip, ExpeditedChip, Fig, FlagCard, StationRail, Direction } from '@/components/ui';
import { DecisionPipeline } from '@/components/pipeline/decision-pipeline';
import { ResolvePanel } from '@/components/resolve/resolve-panel';
import { ROUTES } from '@/lib/routes';
import { money } from '@/lib/format';

type Tab = 'documents' | 'resolve' | 'pipeline' | 'proof';
const TABS: { id: Tab; label: string }[] = [
  { id: 'documents', label: 'Documents' },
  { id: 'resolve', label: 'Resolve' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'proof', label: 'Proof' },
];

/** Scaffold of the three-pane workspace (section 9 wireframe). case-workspace deepens each pane. */
export function Workspace({ bundle }: { bundle: CaseBundle }) {
  const c = bundle.case;
  const [station, setStation] = useState<StationId>(5);
  const [tab, setTab] = useState<Tab>('documents');
  const [docId, setDocId] = useState(bundle.docs.find((d) => d.kind !== 'application')?.id ?? bundle.docs[0]?.id ?? '');
  const [flags, setFlags] = useState<Flag[]>(bundle.flags);
  const [proofFlag, setProofFlag] = useState<string | null>(flags[0]?.id ?? null);
  const doc = bundle.docs.find((d) => d.id === docId);
  const ex = bundle.extractions.filter((e) => e.docId === docId);
  const over = flags.filter((f) => f.direction === 'over').length;
  const under = flags.filter((f) => f.direction === 'under').length;
  const st = useMemo(() => STATIONS.find((s) => s.id === station)!, [station]);

  const setStatus = (id: string, status: Flag['status']) => setFlags((fs) => fs.map((f) => (f.id === id ? { ...f, status } : f)));

  return (
    <main className="app-dark deck-page" data-case={c.id}>
      <div className="wrap" style={{ maxWidth: 1360 }}>
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display m-0 text-2xl">Case {c.qcId}</h1>
            <span className="num text-sm opacity-70">{c.state} · HH {c.householdSize} · filed {c.filedAt}</span>
            <Badge kind={c.prov} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ClockChip day={11} of={30} />
            <ExpeditedChip daysLeft={null} />
            <Link href={ROUTES.gate(c.id)} className="btn btn--primary">Certify…</Link>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[200px_1fr_360px]">
          <aside className="panel" aria-label="Stations">
            <h2 className="panel__title">Stations</h2>
            <StationRail steps={bundle.steps} current={station} onSelect={setStation} />
          </aside>

          <section className="grid gap-4" aria-label="Case file and documents">
            <div className="panel">
              <div className="mb-3 flex flex-wrap items-center gap-2" role="tablist">
                {TABS.map((t) => (
                  <button key={t.id} role="tab" aria-selected={tab === t.id} type="button" onClick={() => setTab(t.id)} className={`btn ${tab === t.id ? 'btn--primary' : 'btn--ghost'}`} style={{ minHeight: 32 }}>
                    {t.label}
                  </button>
                ))}
              </div>
              <p className="m-0 mb-3 text-sm opacity-70">
                Station {st.id}: {st.name}. {st.workerDoes}
              </p>

              {tab === 'documents' ? (
                <>
                  <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Documents">
                    {bundle.docs.map((d) => (
                      <button key={d.id} type="button" role="tab" aria-selected={d.id === docId} onClick={() => setDocId(d.id)} className="source-chip" style={d.id === docId ? { borderColor: 'var(--glow)', color: 'var(--deck-ink)' } : undefined}>
                        {d.title}
                      </button>
                    ))}
                  </div>
                  <div className="relative mx-auto aspect-[8.5/11] max-w-[520px] rounded-md bg-[#FBF9F4] p-6 text-[#222] shadow-lg" data-figure aria-label={`${doc?.title ?? 'Document'} (synthetic rendering)`}>
                    <div className="flex items-center justify-between font-mono text-[0.7rem] uppercase tracking-widest text-[#666]">
                      <span>{doc?.title}</span>
                      {doc ? <Badge kind={doc.prov} /> : null}
                    </div>
                    {ex.map((e) => (
                      <div key={e.id} className="absolute whitespace-nowrap font-mono text-[0.66rem]" style={{ left: `${e.bbox.x * 100}%`, top: `${e.bbox.y * 100}%`, width: `${e.bbox.w * 100}%`, height: `${e.bbox.h * 100}%` }}>
                        <span className="absolute inset-0 rounded-sm" style={{ border: '1.5px solid var(--over)', boxShadow: '0 0 0 3px color-mix(in srgb, var(--over) 18%, transparent)' }} aria-hidden />
                        <span className="relative px-1">{e.text}</span>
                      </div>
                    ))}
                    {ex.length === 0 ? <p className="mt-10 text-center text-sm text-[#777]">No extracted fields on this document.</p> : null}
                  </div>
                </>
              ) : tab === 'resolve' ? (
                <ResolvePanel bundle={bundle} />
              ) : tab === 'pipeline' ? (
                <DecisionPipeline bundle={bundle} />
              ) : (
                <p className="text-sm opacity-70">Proof Thread for each flag opens from the AI review pane (View proof).</p>
              )}
            </div>

            <div className="panel">
              <h2 className="panel__title">Budget sheet <Badge kind={c.prov} /></h2>
              <table className="deck-table">
                <thead>
                  <tr><th>Field</th><th>Budgeted</th><th>Recomputed</th><th>Δ</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Earned income / mo</td>
                    <td><Fig prov={c.prov}>{money(c.budget.earnedIncomeMonthly)}</Fig></td>
                    <td>{flags.find((f) => f.recompute?.measure === 'gross_income') ? <Fig prov={c.prov}>{money(flags.find((f) => f.recompute?.measure === 'gross_income')!.recompute!.after)}</Fig> : <span className="opacity-60">pending accept</span>}</td>
                    <td>{flags.find((f) => f.recompute?.measure === 'gross_income') ? <Direction dir="over" /> : '·'}</td>
                  </tr>
                  <tr>
                    <td>Rent / mo</td>
                    <td><Fig prov={c.prov}>{money(c.budget.rentMonthly)}</Fig></td>
                    <td>{flags.find((f) => f.recompute?.measure === 'shelter_cost') ? <Fig prov={c.prov}>{money(flags.find((f) => f.recompute?.measure === 'shelter_cost')!.recompute!.after)}</Fig> : <span className="opacity-60">pending accept</span>}</td>
                    <td>{flags.find((f) => f.recompute?.measure === 'shelter_cost') ? <Direction dir="under" /> : '·'}</td>
                  </tr>
                  <tr>
                    <td>SUA applied</td>
                    <td>{c.budget.suaApplied ? 'yes' : 'no'}</td>
                    <td colSpan={2} className="opacity-60">engine recompute lands with the rules feature</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <aside className="grid content-start gap-4" aria-label="AI review">
            <div className="panel">
              <h2 className="panel__title">
                <span>Flags ({flags.length})</span>
                <span className="flex gap-3"><Direction dir="over" /> {over} <Direction dir="under" /> {under}</span>
              </h2>
              <div className="grid gap-3">
                {flags.length === 0 ? <p className="m-0 text-sm opacity-70">No discrepancies found in the documents on file.</p> : null}
                {flags.map((f) => (
                  <FlagCard key={f.id} flag={f} onProof={() => setProofFlag(f.id)} onAccept={() => setStatus(f.id, 'accepted')} onDismiss={() => setStatus(f.id, 'dismissed')} />
                ))}
              </div>
            </div>
            {proofFlag ? (
              <div className="panel" data-testid="proof-thread" data-figure>
                <h2 className="panel__title">Proof thread <Badge kind={bundle.case.prov} /></h2>
                {(() => {
                  const f = flags.find((x) => x.id === proofFlag)!;
                  const exs = bundle.extractions.filter((e) => f.extractionIds.includes(e.id));
                  return (
                    <ol className="m-0 grid list-none gap-2 p-0 text-sm">
                      <li><span className="eyebrow opacity-60">Source</span><br />{exs.map((e) => `“${e.text}” (p.${e.page})`).join(' · ') || 'none'}</li>
                      <li><span className="eyebrow opacity-60">Extracted</span><br />{exs.map((e) => `${e.field} = ${e.value} (${Math.round(e.confidence * 100)}%)`).join(' · ') || 'none'}</li>
                      <li><span className="eyebrow opacity-60">Policy</span><br />{f.citations.map((ct) => `${ct.section}${ct.verified ? '' : ' (unverified)'}: ${ct.text ?? 'policy text not loaded'}`).join(' · ')}</li>
                      <li><span className="eyebrow opacity-60">Recompute</span><br />{f.recompute ? <Fig prov={f.prov}>{f.recompute.arithmetic ?? `${money(f.recompute.before)} → ${money(f.recompute.after)}`}</Fig> : 'not applicable'}</li>
                      <li><span className="eyebrow opacity-60">Human action</span><br />{f.status === 'open' ? 'waiting on the worker' : `${f.status} by worker`}</li>
                    </ol>
                  );
                })()}
              </div>
            ) : null}
            <div className="panel">
              <h2 className="panel__title">Questions to ask</h2>
              <ul className="m-0 grid gap-2 pl-4 text-sm">
                {bundle.questions.map((q) => <li key={q.id}>{q.text}</li>)}
                {bundle.questions.length === 0 ? <li className="list-none opacity-60">None</li> : null}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
