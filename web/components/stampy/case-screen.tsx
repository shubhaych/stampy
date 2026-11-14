'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { CaseBundleV2, Fact } from '@stampy/contracts/stampy';
import { Badge, DeckPage } from '@/components/ui';
import { api, ApiError, subscribeEvents } from '@/lib/stampy/api';
import { FIXTURE_BUNDLE, FIXTURE_CASE_ID } from '@/lib/stampy/fixture';
import { formatRef } from '@/lib/stampy/util';
import { evidenceProvenance, nextStep } from '@/lib/stampy/workflow';
import { ROUTES } from '@/lib/routes';
import { CaseworkerSignIn, DataFooter, Empty, ErrorLine, FixtureProvider, ModeChips, StatusChip, useCaseworker } from './common';
import { LoopTracker } from './loop-tracker';
import { FIELD_LABEL } from '@stampy/contracts/stampy';
import { DocumentsPanel, LedgerPanel, QuestionsPanel } from './evidence';
import { CallsPanel, DecisionPanel, DemoControls, OutreachPanel, RecomputePanel, useAction } from './actions';

export function CaseScreen({ id, fixture }: { id: string; fixture: boolean }) {
  const [bundle, setBundle] = useState<CaseBundleV2 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [connected, setConnected] = useState(false);
  const [reviewTab, setReviewTab] = useState<'guide' | 'issues' | 'fields' | 'history'>('guide');
  const [canvas, setCanvas] = useState<'tasks' | 'document' | 'calls' | 'budget'>('tasks');
  const [mobilePane, setMobilePane] = useState<'tasks' | 'source' | 'review'>('source');
  const action = useAction();
  const [docId, setDocId] = useState<string | null>(null);
  const [factId, setFactId] = useState<string | null>(null);
  const { worker, signIn, signOut } = useCaseworker();
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
      setBundle(loaded);
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
    const frame = requestAnimationFrame(() => {
      if (window.innerWidth > 800 || mobilePane === 'review') document.querySelector(`[data-fact="${CSS.escape(factId)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      if (window.innerWidth > 800 || mobilePane === 'source') document.querySelector('.desk-fixture-paper [aria-pressed="true"], .stp-bbox--on')?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    });
    return () => cancelAnimationFrame(frame);
  }, [factId, reviewTab, mobilePane]);

  const selectFact = useCallback(
    (f: Fact) => {
      setFactId(f.id);
      setReviewTab('fields');
      setMobilePane('source');
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
          No case {id} on this worker. <Link className="stp-link" href={ROUTES.cases}>Back to the queue</Link>
        </Empty>
      </DeckPage>
    );
  }
  if (!bundle) {
    return (
      <DeckPage eyebrow="Caseworker" title={`Case ${id}`}>
        {error ? <><ErrorLine error={error} /><button className="btn btn--ghost" onClick={() => void load()}>Retry loading case</button></> : <Empty>Loading case…</Empty>}
      </DeckPage>
    );
  }

  const c = bundle.case;
  const guidance = nextStep(bundle);
  const provenance = evidenceProvenance(bundle);
  const lockedWorker = error ? null : worker;
  const after = async () => {
    await load();
  };

  const selectedFact = bundle.facts.find((f) => f.id === factId);
  const pending = bundle.questions.filter((q) => q.status !== 'closed');
  const unreadable = bundle.documents.filter((d) => d.readStatus === 'failed' || d.readStatus === 'needs_person');
  const tasks = [
    { id: 'documents', title: 'Check source documents', status: unreadable.length ? 'Needs evidence' : bundle.documents.length ? 'In progress' : 'Not started', detail: 'Compare the extracted fields with the application, paystubs and lease.' },
    { id: 'questions', title: 'Resolve open questions', status: pending.length ? 'Needs evidence' : bundle.questions.length ? 'In progress' : 'Not started', detail: 'Review conflicting statements and request only the evidence needed.' },
    { id: 'budget', title: 'Review the budget', status: bundle.recompute ? 'In progress' : 'Not started', detail: 'Compare the recorded and proposed amounts in both directions.' },
    { id: 'decision', title: 'Record your decision', status: bundle.decision ? 'Reviewed' : 'Not started', detail: 'Review the proposal before approving or rejecting the change.' },
  ];
  const openTask = (task: string) => {
    setReviewTab(task === 'questions' ? 'issues' : 'guide');
    setCanvas(task === 'budget' ? 'budget' : 'tasks');
    setMobilePane(task === 'questions' || task === 'decision' ? 'review' : 'source');
  };
  const openDocument = (id: string) => { setDocId(id); setFactId(null); setCanvas('document'); setReviewTab('fields'); setMobilePane('source'); };
  const tabs = ['guide', 'issues', 'fields', 'history'] as const;
  const fieldFacts = canvas === 'document' && docId ? bundle.facts.filter((f) => f.sourceRef === docId) : bundle.facts;

  return (
    <FixtureProvider fixture={fixture} provenance={provenance}>
      <main className="app-dark evidence-desk" data-mobile-pane={mobilePane}>
        <header className="desk-header">
          <Link href={fixture ? `${ROUTES.cases}?fixture=1` : ROUTES.cases} className="stp-link">← Queue</Link>
          <div className="desk-identity"><h1>{c.applicantName}</h1><span>{c.state} · Ref {formatRef(c.refCode)} <Badge kind={fixture ? 'fixture' : provenance} /></span></div>
          <StatusChip status={c.status} />
          <span className="desk-connection">{fixture ? 'Fixture view' : connected ? 'Connected' : 'Updates disconnected'}</span>
          <button className="stp-link" onClick={() => void load()}>Refresh case</button>
          <CaseworkerSignIn worker={worker} onSignIn={signIn} onSignOut={signOut} />
        </header>
        <ErrorLine error={error} />
        <nav className="desk-mobile-nav" aria-label="Workspace panes">
          {(['tasks', 'source', 'review'] as const).map((pane) => <button key={pane} aria-current={mobilePane === pane ? 'page' : undefined} onClick={() => setMobilePane(pane)}>{pane}</button>)}
        </nav>
        <div className="desk-layout">
          <aside className="desk-rail" aria-label="Case tasks and sources">
            <div className="desk-rail-heading">Case review</div>
            {tasks.map((task) => <button key={task.id} className="desk-task" onClick={() => openTask(task.id)}><span>{task.title}</span><small data-state={task.status}>{task.status}</small></button>)}
            <div className="desk-rail-heading">Sources <Badge kind={fixture ? 'fixture' : provenance} /></div>
            <button className="desk-source" aria-pressed={canvas === 'tasks'} onClick={() => { setCanvas('tasks'); setMobilePane('source'); }}>Remaining tasks</button>
            {bundle.documents.map((doc) => <button key={doc.id} className="desk-source" aria-pressed={canvas === 'document' && docId === doc.id} onClick={() => openDocument(doc.id)}><span>▤ {doc.filename}</span><small>{doc.readStatus === 'read' ? 'AI extracted' : doc.readStatus.replace('_', ' ')}</small></button>)}
            {bundle.calls.length > 0 && <button className="desk-source" aria-pressed={canvas === 'calls'} onClick={() => { setCanvas('calls'); setMobilePane('source'); }}>Call transcript</button>}
            <Link className="desk-source stp-link" href="/cases/qc">Public QC records ↗</Link>
            <details className="desk-integrations"><summary>Service modes</summary><ModeChips modes={bundle.modes} phoneNumber={bundle.phoneNumber} /></details>
          </aside>
          <section className="desk-canvas" aria-label="Source workspace">
            <div className="desk-canvas-bar"><span>{canvas === 'tasks' ? 'Your review' : canvas === 'document' ? 'Source document' : canvas === 'calls' ? 'Recorded conversation' : 'Budget comparison'}</span><Badge kind={fixture ? 'fixture' : provenance} />{canvas !== 'tasks' && <button className="stp-link" onClick={() => setCanvas('tasks')}>Close source</button>}</div>
            <div className="desk-canvas-scroll">
              {canvas === 'tasks' && <div className="desk-task-sheet">
                <span className="eyebrow">Case review</span><h2>Remaining review tasks</h2><p>{guidance.detail}</p>
                <ol>{tasks.map((task) => <li key={task.id}><button onClick={() => openTask(task.id)}><strong>{task.title}</strong><span>{task.status} →</span><p>{task.detail}</p></button></li>)}</ol>
                <p className="stp-hint">AI extraction does not mark a task reviewed. The recorded worker decision is shown separately.</p>
              </div>}
              {canvas === 'document' && <DocumentsPanel docs={bundle.documents} facts={bundle.facts} selectedDocId={docId} onSelectDoc={openDocument} selectedFactId={factId} onSelectFact={(id) => { setFactId(id); setReviewTab('fields'); }} />}
              {canvas === 'calls' && <div id="stp-calls"><CallsPanel calls={bundle.calls} /></div>}
              {canvas === 'budget' && <div id="stp-budget"><RecomputePanel recompute={bundle.recompute} /></div>}
              {selectedFact && canvas !== 'tasks' && <div className="desk-source-citation"><strong>{FIELD_LABEL[selectedFact.field] ?? selectedFact.field}</strong><p>{selectedFact.line ?? 'Source quote not loaded.'}</p><small>{selectedFact.sourceLabel} · {selectedFact.page ? `page ${selectedFact.page}` : 'page not loaded'} <Badge kind={fixture ? 'fixture' : selectedFact.prov} /></small></div>}
            </div>
          </section>
          <aside className="desk-review" aria-label="Review assistant">
            <div className="desk-tabs" role="tablist" aria-label="Review sections">
              {tabs.map((tab, i) => <button key={tab} role="tab" id={`desk-tab-${tab}`} aria-controls={`desk-panel-${tab}`} aria-selected={reviewTab === tab} tabIndex={reviewTab === tab ? 0 : -1} onClick={() => setReviewTab(tab)} onKeyDown={(e) => { const next = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i + tabs.length - 1) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1; if (next >= 0) { e.preventDefault(); setReviewTab(tabs[next]!); document.getElementById(`desk-tab-${tabs[next]}`)?.focus(); } }}>{tab === 'guide' ? 'Guide' : tab === 'issues' ? 'Issues' : tab === 'fields' ? 'Fields' : 'History'}</button>)}
            </div>
            <div className="desk-review-scroll" role="tabpanel" id={`desk-panel-${reviewTab}`} aria-labelledby={`desk-tab-${reviewTab}`} tabIndex={0}>
              {reviewTab === 'guide' && <>
                <div className="desk-guide"><span className="eyebrow">Suggested next step</span><h2>{guidance.title}</h2><p>{guidance.detail}</p>
                  <button className="btn btn--ghost" disabled={fixture || !!error || !!action.busy} onClick={() => void action.run('reader', async () => { await api.reread(id); await load(); })}>{action.busy ? 'Checking…' : 'Retry document review'}</button><ErrorLine error={action.error} /><p className="stp-hint">Claude retries unreadable documents; the worker reviews its findings.</p>
                </div>
                <DecisionPanel bundle={bundle} worker={lockedWorker} onDecide={async (choice, note) => { if (!lockedWorker) return; await api.decide(id, choice, lockedWorker, note); await after(); }} />
                <OutreachPanel outreach={bundle.outreach} inbound={bundle.inbound} worker={lockedWorker} onSend={async () => { if (!lockedWorker) return; await api.sendRequest(id, lockedWorker); await after(); }} />
              </>}
              {reviewTab === 'issues' && <>{unreadable.map((doc) => <div className="desk-read-error" key={doc.id}><strong>Needs a person: {doc.filename}</strong><p>{doc.readError ?? 'Document could not be read.'}</p><button className="stp-link" onClick={() => openDocument(doc.id)}>Open source →</button></div>)}<QuestionsPanel questions={bundle.questions} facts={bundle.facts} onSelectFact={selectFact} /></>}
              {reviewTab === 'fields' && <><p className="desk-field-hint">AI extracted · select a field to inspect its source. Acceptance is recorded only by a worker action.</p><LedgerPanel facts={fieldFacts} questions={bundle.questions} selectedFactId={factId} onSelectFact={selectFact} /></>}
              {reviewTab === 'history' && <><LoopTracker audit={bundle.audit} /><DemoControls disabled={!!error} onRun={async (what) => { if (what === 'call') await api.simulateCall(id); else if (what === 'reply') await api.simulateReply(id); else if (what === 'reread') await api.reread(id); else await api.recompute(id); await after(); }} /></>}
            </div>
          </aside>
        </div>
        <div className="desk-footer"><span>Document and voice findings are internally consistent with the record, not proof of authenticity.</span><DataFooter /></div>
      </main>
    </FixtureProvider>
  );
}
