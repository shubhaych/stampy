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
import { DocumentsPanel, LedgerPanel, QuestionsPanel } from './evidence';
import { CallsPanel, DecisionPanel, DemoControls, OutreachPanel, RecomputePanel } from './actions';

export function CaseScreen({ id, fixture }: { id: string; fixture: boolean }) {
  const [bundle, setBundle] = useState<CaseBundleV2 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [connected, setConnected] = useState(false);
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

  const selectFact = useCallback(
    (f: Fact) => {
      setFactId((cur) => (cur === f.id ? null : f.id));
      if (f.sourceRef && bundle?.documents.some((d) => d.id === f.sourceRef)) {
        setDocId(f.sourceRef);
        document.getElementById('stp-documents')?.scrollIntoView({ behavior: 'auto', block: 'start' });
      } else if (f.sourceKind === 'phone_call') {
        document.getElementById('stp-calls')?.scrollIntoView({ behavior: 'auto', block: 'start' });
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

  return (
    <FixtureProvider fixture={fixture} provenance={provenance}>
      <main className="app-dark deck-page stp-case">
        <div className="wrap" style={{ maxWidth: 1440 }}>
          <header className="stp-case__head">
            <div className="stp-case__who">
              <div className="eyebrow mb-2 flex flex-wrap items-center gap-2 opacity-80">
                <Link href={fixture ? `${ROUTES.cases}?fixture=1` : ROUTES.cases} className="stp-link">Queue</Link>
                <span aria-hidden>/</span>
                <span>{c.id}</span>
                {fixture ? <span className="fixture-ribbon">Fixture view</span> : <span className={`stp-live ${connected ? 'stp-live--on' : ''}`}>{connected ? 'Connected' : 'Updates disconnected'}</span>}
              </div>
              <h1 className="font-display h-section m-0">{c.applicantName}</h1>
              <div className="stp-case__facts">
                <span className="stp-ref">Ref <b>{formatRef(c.refCode)}</b></span>
                <StatusChip status={c.status} />
                <span>{c.state}</span>
                <span>{c.applicantEmail}</span>
                <span>{c.applicantPhone}</span>
              </div>
              <ModeChips modes={bundle.modes} phoneNumber={bundle.phoneNumber} />
            </div>
            <CaseworkerSignIn worker={worker} onSignIn={signIn} onSignOut={signOut} />
          </header>
          <ErrorLine error={error} />
          <section className="stp-guidance" aria-label="Next worker step">
            <div><span className="eyebrow">Next worker step</span><h2>{guidance.title}</h2><p>{guidance.detail}</p></div>
            <div className="stp-guidance__actions"><a className="btn btn--primary" href={`#${guidance.target}`}>Go to step →</a><button type="button" className="btn btn--ghost" onClick={() => void load()}>Refresh case</button></div>
          </section>
          <p className="stp-source-note">Evidence <Badge kind={fixture ? 'fixture' : provenance} /> · Document and voice findings are internally consistent with the record, not proof of authenticity.</p>
          {error && <p className="stp-error">This snapshot may be stale. Refresh successfully before approving an action.</p>}

          <div className="stp-case__grid">
            <aside className="stp-case__rail">
              <LoopTracker audit={bundle.audit} />
            </aside>

            <div className="stp-case__main">
              <div id="stp-budget"><RecomputePanel recompute={bundle.recompute} /></div>
              <QuestionsPanel questions={bundle.questions} facts={bundle.facts} onSelectFact={selectFact} />
              <div id="stp-documents">
                <DocumentsPanel
                  docs={bundle.documents}
                  facts={bundle.facts}
                  selectedDocId={docId}
                  onSelectDoc={setDocId}
                  selectedFactId={factId}
                  onSelectFact={setFactId}
                />
              </div>
              <LedgerPanel facts={bundle.facts} questions={bundle.questions} selectedFactId={factId} onSelectFact={selectFact} />
            </div>

            <aside className="stp-case__side">
              <DecisionPanel
                bundle={bundle}
                worker={lockedWorker}
                onDecide={async (action, note) => {
                  if (!worker) return;
                  await api.decide(id, action, worker, note);
                  await after();
                }}
              />
              <OutreachPanel
                outreach={bundle.outreach}
                inbound={bundle.inbound}
                worker={lockedWorker}
                onSend={async () => {
                  if (!worker) return;
                  await api.sendRequest(id, worker);
                  await after();
                }}
              />
              <div id="stp-calls"><CallsPanel calls={bundle.calls} /></div>
              <DemoControls disabled={!!error}
                onRun={async (what) => {
                  if (what === 'call') await api.simulateCall(id);
                  else if (what === 'reply') await api.simulateReply(id);
                  else if (what === 'reread') await api.reread(id);
                  else await api.recompute(id);
                  await after();
                }}
              />
            </aside>
          </div>
          <DataFooter />
        </div>
      </main>
    </FixtureProvider>
  );
}
