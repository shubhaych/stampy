'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { CaseBundleV2, Fact } from '@stampy/contracts/stampy';
import { DeckPage } from '@/components/ui';
import { api, ApiError, subscribeEvents } from '@/lib/stampy/api';
import { FIXTURE_BUNDLE } from '@/lib/stampy/fixture';
import { formatRef } from '@/lib/stampy/util';
import { ROUTES } from '@/lib/routes';
import { Empty, ErrorLine, FixtureProvider, ModeChips, StatusChip } from './common';
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
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (fixture) {
      setBundle(FIXTURE_BUNDLE);
      return;
    }
    try {
      setBundle(await api.caseBundle(id));
      setError(null);
      setNotFound(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setNotFound(true);
      else setError((e as Error).message);
    }
  }, [id, fixture]);

  useEffect(() => {
    void load();
    if (fixture) return;
    const off = subscribeEvents((e) => {
      if (e.caseId !== id) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void load(), 250);
    }, setConnected);
    return () => {
      off();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [id, fixture, load]);

  const selectFact = useCallback(
    (f: Fact) => {
      setFactId((cur) => (cur === f.id ? null : f.id));
      if (f.sourceRef && bundle?.documents.some((d) => d.id === f.sourceRef)) {
        setDocId(f.sourceRef);
        document.getElementById('stp-documents')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
        {error ? <ErrorLine error={error} /> : <Empty>Loading case…</Empty>}
      </DeckPage>
    );
  }

  const c = bundle.case;
  const after = async () => {
    await load();
  };

  return (
    <FixtureProvider fixture={fixture}>
      <main className="app-dark deck-page stp-case">
        <div className="wrap" style={{ maxWidth: 1440 }}>
          <header className="stp-case__head">
            <div className="stp-case__who">
              <div className="eyebrow mb-2 flex flex-wrap items-center gap-2 opacity-80">
                <Link href={ROUTES.cases} className="stp-link">Queue</Link>
                <span aria-hidden>/</span>
                <span>{c.id}</span>
                {fixture ? <span className="fixture-ribbon">Fixture view</span> : <span className={`stp-live ${connected ? 'stp-live--on' : ''}`}>{connected ? 'Live updates' : 'Connecting…'}</span>}
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
          </header>
          <ErrorLine error={error} />

          <div className="stp-case__grid">
            <aside className="stp-case__rail">
              <LoopTracker audit={bundle.audit} />
            </aside>

            <div className="stp-case__main">
              <RecomputePanel recompute={bundle.recompute} />
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
                onDecide={async (action, note) => {
                  await api.decide(id, action, note);
                  await after();
                }}
              />
              <OutreachPanel
                outreach={bundle.outreach}
                inbound={bundle.inbound}
                onSend={async () => {
                  await api.sendRequest(id);
                  await after();
                }}
              />
              <CallsPanel calls={bundle.calls} />
              <DemoControls
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
        </div>
      </main>
    </FixtureProvider>
  );
}
