'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { CaseBundleV2, Fact } from '@stampy/contracts/stampy';
import { Check, FileText, Phone, Scale } from 'lucide-react';
import { Badge, DeckPage, Direction, Fig } from '@/components/ui';
import { money } from '@/lib/format';
import { api, ApiError, subscribeEvents } from '@/lib/stampy/api';
import { FIXTURE_BUNDLE, FIXTURE_CASE_ID } from '@/lib/stampy/fixture';
import { formatRef, timeAgo } from '@/lib/stampy/util';
import { markSynthetic, replayRecordId, replyPaystub } from '@/lib/stampy/replay';
import { decisionReady, evidenceProvenance, nextStep } from '@/lib/stampy/workflow';
import { ROUTES } from '@/lib/routes';
import { DataFooter, Empty, ErrorLine, FixtureProvider, StatusChip } from './common';
import { LoopTracker } from './loop-tracker';
import { FIELD_LABEL } from '@stampy/contracts/stampy';
import type { AuditRow } from '@stampy/contracts/stampy';
import { DocumentsPanel, LedgerPanel, QuestionsPanel } from './evidence';
import { CallsPanel, DecisionPanel, DemoControls, OutreachPanel, RecomputePanel, useAction } from './actions';

export function CaseScreen({ id, fixture }: { id: string; fixture: boolean }) {
  const [bundle, setBundle] = useState<CaseBundleV2 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [connected, setConnected] = useState(false);
  const [canvas, setCanvas] = useState<'document' | 'calls' | 'budget'>('document');
  const action = useAction();
  const [docId, setDocId] = useState<string | null>(null);
  const [factId, setFactId] = useState<string | null>(null);
  const loadVersion = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    if (fixture) {
      if (id !== FIXTURE_CASE_ID) { setNotFound(true); return; }
      setBundle(FIXTURE_BUNDLE);
      return;
    }
    try {
      const loaded = await api.caseBundle(id);
      if (version !== loadVersion.current) return;
      setBundle(markSynthetic(loaded));
      setError(null);
      setNotFound(false);
    } catch (e) {
      if (version !== loadVersion.current) return;
      if (e instanceof ApiError && e.status === 404) setNotFound(true);
      else setError((e as Error).message);
    }
  }, [id, fixture]);

  useEffect(() => {
    setBundle(null);
    setError(null);
    setNotFound(false);
    setDocId(null);
    setFactId(null);
    void load();
    if (fixture) return;
    const off = subscribeEvents((e) => {
      if (e.caseId !== id) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void load(), 250);
    }, (open) => { setConnected(open); if (open) void load(); });
    return () => {
      loadVersion.current++;
      off();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [id, fixture, load]);

  useEffect(() => {
    if (!factId) return;
    const frame = requestAnimationFrame(() => document.querySelector('.stp-bbox--on')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    return () => cancelAnimationFrame(frame);
  }, [factId]);

  const selectFact = useCallback(
    (f: Fact) => {
      setFactId(f.id);
      if (f.sourceRef && bundle?.documents.some((d) => d.id === f.sourceRef)) {
        setDocId(f.sourceRef);
        setCanvas('document');
      } else if (f.sourceKind === 'phone_call') {
        setCanvas('calls');
      }
    },
    [bundle],
  );

  if (notFound) {
    return (
      <DeckPage eyebrow="Caseworker" title="Case not found">
        <Empty>
          No case {id} here. <Link className="stp-link" href={ROUTES.cases}>Back to cases</Link>
        </Empty>
      </DeckPage>
    );
  }
  if (!bundle) {
    return (
      <DeckPage eyebrow="Caseworker" title={`Case ${id}`}>
        {error ? <><ErrorLine error={error} /><button className="btn btn--ghost" onClick={() => void load()}>Try again</button></> : <Empty>Opening the case…</Empty>}
      </DeckPage>
    );
  }

  const c = bundle.case;
  const guidance = nextStep(bundle);
  const provenance = evidenceProvenance(bundle);
  const after = async () => { await load(); };
  const recordId = replayRecordId(bundle);

  const reading = bundle.documents.filter((d) => d.readStatus === 'pending' || d.readStatus === 'reading');
  const unreadable = bundle.documents.filter((d) => d.readStatus === 'failed' || d.readStatus === 'needs_person');
  const read = bundle.documents.filter((d) => d.readStatus === 'read');
  const pending = bundle.questions.filter((q) => q.status !== 'closed');
  const request = bundle.outreach.find((o) => o.kind === 'request');
  const emailed = request?.status === 'sent' || request?.status === 'simulated';
  const doc = bundle.documents.find((d) => d.id === docId) ?? bundle.documents[0] ?? null;
  const docReading = doc && (doc.readStatus === 'pending' || doc.readStatus === 'reading');

  type Step = { id: string; title: string; note: string; state: 'done' | 'now' | 'later' | 'stuck' };
  const docsDone = bundle.documents.length > 0 && !reading.length && !unreadable.length;
  const questionsDone = docsDone && pending.length === 0;
  const steps: Step[] = [
    { id: 'documents', title: 'Read the documents', state: unreadable.length ? 'stuck' : docsDone ? 'done' : 'now',
      note: unreadable.length ? `${unreadable.length} could not be read` : `${read.length} of ${bundle.documents.length} read` },
    { id: 'questions', title: 'Settle what does not match', state: !docsDone ? 'later' : questionsDone ? 'done' : 'now',
      note: !docsDone ? 'After reading' : questionsDone ? (bundle.questions.length ? 'All settled' : 'Nothing to settle') : `${pending.length} open · ${emailed ? 'email sent, waiting on the household' : request ? 'email ready for your approval' : 'drafting the email'}` },
    { id: 'budget', title: 'Check the benefit', state: bundle.recompute ? 'done' : questionsDone ? 'now' : 'later', note: bundle.recompute ? 'Recalculated from the evidence' : 'After the questions close' },
    { id: 'decision', title: 'Record your decision', state: bundle.decision ? 'done' : bundle.recompute ? 'now' : 'later', note: bundle.decision ? `${bundle.decision.action === 'approve' ? 'Approved' : 'Rejected'} by ${bundle.decision.decidedBy}` : 'Yours to make' },
  ];
  const goTo = (step: string) => {
    if (step === 'documents') setCanvas('document');
    if (step === 'budget' && bundle.recompute) setCanvas('budget');
    document.getElementById(step === 'questions' ? 'rv-questions' : step === 'documents' ? 'rv-fields' : 'rv-next')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  const openDocument = (next: string) => { setDocId(next); setFactId(null); setCanvas('document'); };
  const fieldFacts = doc && canvas === 'document' ? bundle.facts.filter((f) => f.sourceRef === doc.id) : bundle.facts;
  const selectedFact = bundle.facts.find((f) => f.id === factId);
  const activity = [...bundle.audit].reverse().map(describe).filter((x): x is { text: string; at: string; who: string } => x !== null).slice(0, 6);

  return (
    <FixtureProvider fixture={fixture} provenance={provenance}>
      <main className="app-dark rv">
        <header className="rv-bar">
          <Link href={fixture ? `${ROUTES.cases}?fixture=1` : ROUTES.cases} className="rv-back">← Cases</Link>
          <div className="rv-who">
            <h1>{c.applicantName}</h1>
            <span>{c.id} · {c.state} · Ref {formatRef(c.refCode)}</span>
          </div>
          <StatusChip status={c.status} />
          <span className={`cq-live ${connected || fixture ? 'cq-live--on' : ''}`}>{fixture ? 'Fixture view' : connected ? 'Updating live' : 'Reconnecting'}</span>
        </header>
        <ErrorLine error={error} />
        <div className="rv-grid">
          <nav className="rv-left" aria-label="What is left to do">
            <h2>To do</h2>
            <ol className="rv-steps">
              {steps.map((s) => (
                <li key={s.id} data-state={s.state}>
                  <button type="button" onClick={() => goTo(s.id)}>
                    <span className="rv-steps__mark" aria-hidden>{s.state === 'done' ? <Check size={13} strokeWidth={3} /> : null}</span>
                    <span><strong>{s.title}</strong><small>{s.note}</small></span>
                  </button>
                </li>
              ))}
            </ol>
            <h2>Case file</h2>
            <ul className="rv-files">
              {bundle.documents.map((d) => (
                <li key={d.id}>
                  <button type="button" aria-pressed={canvas === 'document' && doc?.id === d.id} onClick={() => openDocument(d.id)}>
                    <FileText size={15} aria-hidden />
                    <span><strong>{DOC_NAME[d.kind] ?? d.filename}</strong><small data-read={d.readStatus}>{d.readStatus === 'read' ? `${bundle.facts.filter((f) => f.sourceRef === d.id).length} fields read` : d.readStatus === 'reading' || d.readStatus === 'pending' ? 'Reading…' : 'Needs a person'}{d.source === 'email' ? ' · emailed' : ''}</small></span>
                  </button>
                </li>
              ))}
              {bundle.calls.length > 0 && <li><button type="button" onClick={() => document.getElementById('rv-call')?.scrollIntoView({ block: 'start', behavior: 'smooth' })}><Phone size={15} aria-hidden /><span><strong>Phone call</strong><small>{bundle.calls.length === 1 ? 'Transcript' : `${bundle.calls.length} transcripts`}</small></span></button></li>}
              {bundle.recompute && <li><button type="button" aria-pressed={canvas === 'budget'} onClick={() => setCanvas('budget')}><Scale size={15} aria-hidden /><span><strong>Benefit check</strong><small>Before and after</small></span></button></li>}
            </ul>
          </nav>

          <section className="rv-stage" aria-label="Source">
            {canvas === 'document' && (doc ? (
              <>
                {docReading && <div className="rv-reading" role="status"><span aria-hidden /> Claude is reading this page</div>}
                <div className={docReading ? 'rv-paper rv-paper--reading' : 'rv-paper'}>
                  <DocumentsPanel docs={bundle.documents} facts={bundle.facts} selectedDocId={doc.id} onSelectDoc={openDocument} selectedFactId={factId} onSelectFact={setFactId} />
                </div>
                {selectedFact && <div className="rv-cite"><strong>{FIELD_LABEL[selectedFact.field] ?? selectedFact.field}</strong><p>{selectedFact.line ?? 'Source line not loaded.'}</p></div>}
              </>
            ) : <Empty>No documents yet.</Empty>)}
            {canvas === 'calls' && <CallsPanel calls={bundle.calls} />}
            {canvas === 'budget' && <RecomputePanel recompute={bundle.recompute} />}
          </section>

          <aside className="rv-side" aria-label="Stampy's suggestions">
            <section id="rv-next" className="rv-next">
              <span className="rv-label">Suggested next step</span>
              <h2>{reading.length ? 'Reading the case file' : guidance.title}</h2>
              <p>{reading.length ? 'Each field Stampy reads is tied to the line it came from. Questions open as soon as two sources disagree.' : guidance.detail}</p>
              {unreadable.length > 0 && <button className="btn btn--ghost" disabled={fixture || !!action.busy} onClick={() => void action.run('reader', async () => { await api.reread(id); await load(); })}>{action.busy ? 'Reading…' : 'Read again'}</button>}
              <ErrorLine error={action.error} />
              <OutreachPanel outreach={bundle.outreach} inbound={bundle.inbound} onSend={async () => { await api.sendRequest(id); await after(); }} />
              {recordId && emailed && pending.some((q) => q.channel === 'document') && (
                <p className="rv-demo">Presenting? <button type="button" className="cq-inline" onClick={() => void replyPaystub(recordId).then(({ filename, blob }) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href); })}>Download this household&apos;s recent paystub</button> and attach it to your reply to the email.</p>
              )}
              <Outcome bundle={bundle} prov={fixture ? 'fixture' : provenance} />
              {(decisionReady(bundle) || bundle.decision) && <DecisionPanel bundle={bundle} onDecide={async (choice, note) => { await api.decide(id, choice, note); await after(); }} />}
            </section>

            {(bundle.calls.length > 0 || pending.some((q) => q.channel === 'phone')) && (
              <section id="rv-call">
                <span className="rv-label">Phone call {bundle.calls.some((k) => k.status === 'in_progress') && <span className="rv-oncall">On the line now</span>}</span>
                {bundle.calls.length === 0
                  ? <p className="rv-quiet">No call yet.{bundle.phoneNumber ? ` The household calls ${bundle.phoneNumber} and gives reference ${formatRef(c.refCode)}.` : ''} What is said appears here as a transcript.</p>
                  : <CallsPanel calls={bundle.calls} />}
              </section>
            )}

            <section id="rv-questions">
              <span className="rv-label">What does not match <Fig prov={fixture ? 'fixture' : provenance}>{pending.length}</Fig></span>
              {unreadable.map((d) => <div className="rv-stuck" key={d.id}><strong>{d.filename} needs a person</strong><p>{d.readError ?? 'This document could not be read.'}</p></div>)}
              {bundle.questions.length === 0 && !unreadable.length ? <p className="rv-quiet">{reading.length ? 'Checking as documents come in.' : 'The sources agree so far.'}</p> : <QuestionsPanel questions={bundle.questions} facts={bundle.facts} onSelectFact={selectFact} />}
            </section>

            <section id="rv-fields">
              <span className="rv-label">Read from {canvas === 'document' && doc ? (DOC_NAME[doc.kind] ?? 'this document').toLowerCase() : 'the case file'} <Fig prov={fixture ? 'fixture' : provenance}>{fieldFacts.length}</Fig></span>
              {fieldFacts.length === 0 ? <p className="rv-quiet">{docReading ? 'Fields appear here as they are read.' : 'Nothing read yet.'}</p> : <LedgerPanel facts={fieldFacts} questions={bundle.questions} selectedFactId={factId} onSelectFact={selectFact} />}
            </section>

            <section>
              <span className="rv-label">Activity</span>
              <ul className="rv-activity">
                {activity.map((a, i) => <li key={i} data-who={a.who}><span>{a.text}</span><time>{timeAgo(a.at)}</time></li>)}
              </ul>
              <details className="rv-more"><summary>Full trail and demo controls</summary>
                <LoopTracker audit={bundle.audit} />
                <DemoControls disabled={!!error} onRun={async (what) => { if (what === 'call') await api.simulateCall(id); else if (what === 'reply') await api.simulateReply(id); else if (what === 'reread') await api.reread(id); else await api.recompute(id); await after(); }} />
              </details>
            </section>
          </aside>
        </div>
        <div className="rv-foot"><span>Document and voice findings are internally consistent with the record, not proof of authenticity.</span><DataFooter /></div>
      </main>
    </FixtureProvider>
  );
}

/** The before and after in one sentence, once the benefit has been recomputed from the evidence. */
function Outcome({ bundle, prov }: { bundle: CaseBundleV2; prov: 'live' | 'replay' | 'synthetic' | 'fixture' | 'sandbox' }) {
  const before = bundle.recompute?.before.benefitMonthly, after = bundle.recompute?.after.benefitMonthly;
  if (before == null || after == null) return null;
  const gap = Math.abs(before - after);
  const done = bundle.decision?.action === 'approve';
  return (
    <div className="rv-outcome" data-dir={after < before ? 'over' : after > before ? 'under' : 'same'}>
      <div className="rv-outcome__figures">
        <span><small>As filed</small><Fig prov={prov}>{money(before)}</Fig></span>
        <span aria-hidden>→</span>
        <span><small>From the evidence</small><Fig prov={prov}>{money(after)}</Fig></span>
      </div>
      <p>
        {gap === 0 ? 'The evidence supports the benefit as filed.'
          : after < before ? <><Direction dir="over" /> <Fig prov={prov}>{money(gap)}</Fig> a month would have been overissued. {done ? 'Corrected before it went out.' : 'Approve to issue the corrected amount.'}</>
          : <><Direction dir="under" /> The household was <Fig prov={prov}>{money(gap)}</Fig> a month short. {done ? 'Corrected before it went out.' : 'Approve to issue the corrected amount.'}</>}
      </p>
    </div>
  );
}

const DOC_NAME: Record<string, string> = { application_form: 'Application form', paystub: 'Paystub', lease: 'Lease', other: 'Other document', unknown: 'Document' };

/** One plain line per audit row worth showing; everything else stays in the full trail. */
function describe(row: AuditRow): { text: string; at: string; who: string } | null {
  const d = row.data ?? {};
  const text: Record<string, string> = {
    'case.created': 'Case opened',
    'document.received': `Received ${String(d.filename ?? 'a document')}`,
    'document.read': `Claude read a ${String(d.kind ?? 'document').replace(/_/g, ' ')}: ${String(d.facts ?? 0)} fields`,
    'document.read_failed': 'A document could not be read',
    'question.opened': `Question opened: ${FIELD_LABEL[String(d.field)] ?? 'a mismatch'}`,
    'question.closed': `Question settled: ${FIELD_LABEL[String(d.field)] ?? ''}`,
    'question.answered': `Answer recorded: ${FIELD_LABEL[String(d.field)] ?? ''}`,
    'email.drafted': 'Email drafted for your approval',
    'email.approved': 'You approved the email',
    'email.sent': d.simulated ? 'Email recorded (not delivered: address not on the allow-list)' : 'Email sent to the household',
    'email.failed': 'Email could not be sent',
    'email.received': 'Reply received from the household',
    'call.started': 'Household called in',
    'call.ended': 'Call ended',
    'recompute.done': 'Benefit recalculated from the evidence',
    'decision.approve': 'Change approved by the caseworker',
    'decision.reject': 'Change rejected by the caseworker',
  };
  const line = text[row.action];
  return line ? { text: line, at: row.at, who: row.actorRole } : null;
}
