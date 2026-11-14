'use client';

import { useState } from 'react';
import { FIELD_LABEL } from '@stampy/contracts/stampy';
import type { DocumentMeta, Fact, Question } from '@stampy/contracts/stampy';
import { Badge, Direction, Fig } from '@/components/ui';
import { money } from '@/lib/format';
import { api } from '@/lib/stampy/api';
import { clockTime, mss } from '@/lib/stampy/util';
import { Empty, MoneyText, SourceBadge, useProv } from './common';

const DOC_KIND: Record<string, string> = { application_form: 'Application form', paystub: 'Paystub', lease: 'Lease', other: 'Other', unknown: 'Unknown' };
const READ_LABEL: Record<DocumentMeta['readStatus'], string> = { pending: 'Waiting to read', reading: 'Reading…', read: 'Read', failed: 'Read failed', needs_person: 'Needs a person' };

const fieldLabel = (f: string) => FIELD_LABEL[f] ?? f.replace(/_/g, ' ');

/* ---------- Documents ---------- */

export function DocumentsPanel({ docs, facts, selectedDocId, onSelectDoc, selectedFactId, onSelectFact }: {
  docs: DocumentMeta[]; facts: Fact[]; selectedDocId: string | null; onSelectDoc: (id: string) => void; selectedFactId: string | null; onSelectFact: (id: string | null) => void;
}) {
  const pv = useProv();
  const doc = docs.find((d) => d.id === selectedDocId) ?? docs[0] ?? null;
  const docFacts = doc ? facts.filter((f) => f.sourceRef === doc.id) : [];
  return (
    <section className="panel" aria-label="Documents">
      <div className="panel__title">
        <span>Documents · {docs.length}</span>
      </div>
      {!doc ? (
        <Empty>No documents yet.</Empty>
      ) : (
        <>
          <div className="stp-tabs" role="tablist">
            {docs.map((d) => (
              <button
                key={d.id}
                type="button"
                role="tab"
                aria-selected={d.id === doc.id}
                className="stp-tab"
                onClick={() => {
                  onSelectDoc(d.id);
                  onSelectFact(null);
                }}
              >
                {DOC_KIND[d.kind] ?? d.kind}
                <span className={`stp-tab__dot stp-tab__dot--${d.readStatus}`} aria-hidden />
              </button>
            ))}
          </div>
          <div className="stp-doc">
            <div className="stp-doc__meta">
              <span className="tabular text-xs">{doc.filename}</span>
              <SourceBadge source={doc.source} />
              {doc.synthetic ? <Badge kind={pv('synthetic')} /> : null}
              <span className={`stp-pill stp-pill--${doc.readStatus}`}>{READ_LABEL[doc.readStatus]}</span>
              <span className="stp-sub">received {clockTime(doc.receivedAt)}</span>
            </div>
            {doc.readError ? <p className="stp-error">{doc.readError}</p> : null}
            <DocViewer doc={doc} facts={docFacts} selectedFactId={selectedFactId} onSelectFact={onSelectFact} />
            {doc.summary ? (
              <p className="stp-doc__summary">
                <span className="eyebrow opacity-60">AI summary </span>
                <MoneyText text={doc.summary} prov={pv(doc.synthetic ? 'synthetic' : 'live')} />
              </p>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}

function DocViewer({ doc, facts, selectedFactId, onSelectFact }: { doc: DocumentMeta; facts: Fact[]; selectedFactId: string | null; onSelectFact: (id: string | null) => void }) {
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const url = api.docUrl(doc.id);
  if (failed[doc.id]) return <div className="stp-doc__missing">Document image not loaded.</div>;
  if (doc.contentType === 'application/pdf') {
    return (
      <div className="stp-doc__frame">
        <object data={url} type="application/pdf" className="stp-doc__pdf" aria-label={doc.filename}>
          <div className="stp-doc__missing">PDF preview not loaded. <a className="stp-link" href={url} target="_blank" rel="noreferrer">Open the PDF</a></div>
        </object>
      </div>
    );
  }
  const boxed = facts.filter((f) => f.bbox && (f.page === null || f.page === 1));
  return (
    <div className="stp-doc__frame">
      <div className="stp-doc__img">
        <img src={url} alt={`${doc.filename}`} onError={() => setFailed((m) => ({ ...m, [doc.id]: true }))} />
        {boxed.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`stp-bbox ${f.id === selectedFactId ? 'stp-bbox--on' : ''}`}
            style={{ left: `${f.bbox!.x * 100}%`, top: `${f.bbox!.y * 100}%`, width: `${f.bbox!.w * 100}%`, height: `${f.bbox!.h * 100}%` }}
            onClick={() => onSelectFact(f.id === selectedFactId ? null : f.id)}
            aria-label={`${fieldLabel(f.field)}: ${f.value}`}
            title={`${fieldLabel(f.field)}: ${f.value}`}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------- Open questions ---------- */

export function QuestionsPanel({ questions, facts, onSelectFact }: { questions: Question[]; facts: Fact[]; onSelectFact: (f: Fact) => void }) {
  const open = questions.filter((q) => q.status !== 'closed').length;
  return (
    <section className="panel" aria-label="Open questions">
      <div className="panel__title">
        <span>Open questions · {open} open of {questions.length}</span>
      </div>
      {questions.length === 0 ? <Empty>No questions. Every source agrees so far.</Empty> : null}
      <div className="grid gap-3">
        {questions.map((q) => (
          <QuestionCard key={q.id} q={q} facts={facts} onSelectFact={onSelectFact} />
        ))}
      </div>
    </section>
  );
}

function QuestionCard({ q, facts, onSelectFact }: { q: Question; facts: Fact[]; onSelectFact: (f: Fact) => void }) {
  const pv = useProv();
  const resolving = q.resolutionFactId ? facts.find((f) => f.id === q.resolutionFactId) ?? null : null;
  return (
    <article className={`stp-q stp-q--${q.status}`} id={`q-${q.id}`} data-question={q.id}>
      <header className="stp-q__head">
        <div className="flex flex-wrap items-center gap-2">
          <span className="stp-q__title">{q.title}</span>
          <span className="stp-pill">{q.kind === 'conflict' ? 'Sources disagree' : 'Missing document'}</span>
          <span className="stp-pill">{q.channel === 'phone' ? 'Ask by phone' : 'Ask for a document'}</span>
        </div>
        <span className={`stp-pill stp-pill--q-${q.status}`}>{q.status}</span>
      </header>
      <p className="stp-q__ask">“{q.ask}”</p>
      <p className="stp-q__why"><MoneyText text={q.why} prov={pv('live')} /></p>
      {q.candidates.length ? (
        <div className="stp-cands">
          {q.candidates.map((c) => (
            <div key={c.value} className={`stp-cand ${q.resolvedValue && q.resolvedValue === c.value ? 'stp-cand--chosen' : ''}`}>
              <div className="stp-cand__label">{c.label}</div>
              <div className="stp-cand__row">
                <span>Income / mo</span>
                {c.incomeMonthly !== null ? <Fig prov={pv('live')}>{money(c.incomeMonthly)}</Fig> : <span className="stp-sub">not computed</span>}
              </div>
              <div className="stp-cand__row">
                <span>Benefit / mo</span>
                {c.benefitMonthly !== null ? <Fig prov={pv('live')}>{money(c.benefitMonthly)}</Fig> : <span className="stp-sub">not computed</span>}
              </div>
              {q.resolvedValue === c.value ? <div className="stp-cand__tag">Matches the evidence</div> : null}
            </div>
          ))}
        </div>
      ) : null}
      <div className="stp-q__foot">
        <Direction dir={q.direction} long />
        {q.stakeMonthly !== null ? (
          <span className="flex items-center gap-2">
            <span className="stp-sub">At stake</span>
            <Fig prov={pv('live')}>{money(q.stakeMonthly)} / mo</Fig>
          </span>
        ) : null}
        <span className="stp-sub">opened {clockTime(q.openedAt)}</span>
      </div>
      {q.status === 'closed' || q.status === 'answered' ? (
        <div className="stp-q__closed">
          {/* A conflict's note carries a computed income (live); a document's note quotes the document's own figures. */}
          {q.closedNote ? <p className="m-0"><MoneyText text={q.closedNote} prov={pv(q.kind === 'missing_document' && resolving ? resolving.prov : 'live')} /></p> : null}
          {resolving ? (
            <button type="button" className="stp-q__fact" onClick={() => onSelectFact(resolving)}>
              <span className="source-chip">{resolving.sourceLabel}</span>
              {resolving.line ? <q><MoneyText text={resolving.line} prov={pv(resolving.prov)} /></q> : null}
              {resolving.atSeconds !== null ? <span className="tabular text-xs">at {mss(resolving.atSeconds)}</span> : null}
            </button>
          ) : null}
          {q.closedAt ? <span className="stp-sub">closed {clockTime(q.closedAt)}</span> : null}
        </div>
      ) : null}
    </article>
  );
}

/* ---------- Evidence ledger ---------- */

const LETTERS = 'ABCDEFGH';
/** Mirrors the worker's conflict detector (worker/src/ledger/detector.ts COMPARED). */
const COMPARED_FIELDS = new Set(['pay_frequency', 'gross_pay_amount', 'monthly_rent', 'household_members', 'employer_name']);
const confLevel = (c: number) => (c >= 0.85 ? 'high' : c >= 0.6 ? 'medium' : 'low');

export function LedgerPanel({ facts, questions, selectedFactId, onSelectFact }: { facts: Fact[]; questions: Question[]; selectedFactId: string | null; onSelectFact: (f: Fact) => void }) {
  const pv = useProv();
  const groups = new Map<string, Fact[]>();
  for (const f of [...facts].sort((a, b) => a.seq - b.seq)) {
    const g = groups.get(f.field) ?? [];
    g.push(f);
    groups.set(f.field, g);
  }
  const qTitle = (id: string) => questions.find((q) => q.id === id)?.title ?? id;
  return (
    <section className="panel" aria-label="Evidence ledger">
      <div className="panel__title">
        <span>Evidence ledger · {facts.length} facts</span>
        <span>append-only</span>
      </div>
      {facts.length === 0 ? <Empty>No facts yet. They appear as documents are read.</Empty> : null}
      <div className="grid gap-4">
        {[...groups.entries()].map(([field, rows]) => {
          const values = [...new Set(rows.map((r) => r.normalized))];
          // Only fields the detector compares across sources can disagree; dates and periods differ per paystub by design.
          const compared = COMPARED_FIELDS.has(field);
          const conflict = compared && values.length > 1;
          return (
            <div key={field} className={`stp-lg ${conflict ? 'stp-lg--conflict' : ''}`}>
              <div className="stp-lg__head">
                <span className="stp-lg__field">{fieldLabel(field)}</span>
                {conflict ? (
                  <span className="stp-pill stp-pill--conflict">{values.length} different values</span>
                ) : compared ? (
                  <span className="stp-pill stp-pill--agree">agree</span>
                ) : (
                  <span className="stp-pill">{values.length > 1 ? 'one per document' : 'recorded'}</span>
                )}
              </div>
              <ol className="stp-lg__rows">
                {rows.map((f) => {
                  const letter = LETTERS[values.indexOf(f.normalized)] ?? '?';
                  return (
                    <li key={f.id}>
                      <button
                        type="button"
                        className={`stp-fact ${f.id === selectedFactId ? 'stp-fact--on' : ''}`}
                        onClick={() => onSelectFact(f)}
                        data-fact={f.id}
                      >
                        {conflict ? <span className={`stp-fact__letter stp-fact__letter--${letter}`} aria-label={`value ${letter}`}>{letter}</span> : <span className="stp-fact__seq">#{f.seq}</span>}
                        <span className="stp-fact__value"><Fig prov={pv(f.prov)}>{f.value}</Fig></span>
                        <span className="source-chip">{f.sourceLabel}</span>
                        <span className="stp-fact__quote">
                          {f.page !== null ? <span className="tabular">p{f.page} </span> : null}
                          {f.line ? <q><MoneyText text={f.line} prov={pv(f.prov)} /></q> : null}
                          {f.atSeconds !== null ? <span className="tabular"> at {mss(f.atSeconds)}</span> : null}
                        </span>
                        <span className={`stp-fact__conf stp-fact__conf--${confLevel(f.confidence)}`} title="Reader confidence">{confLevel(f.confidence)} confidence</span>
                        {f.questionId ? <a className="stp-fact__q" href={`#q-${f.questionId}`} onClick={(e) => e.stopPropagation()}>answers {qTitle(f.questionId)}</a> : null}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>
    </section>
  );
}
