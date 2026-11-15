'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { CaseSummary } from '@stampy/contracts/stampy';
import { api, subscribeEvents } from '@/lib/stampy/api';
import { FIXTURE_SUMMARIES } from '@/lib/stampy/fixture';
import { formatRef, timeAgo, dateTime } from '@/lib/stampy/util';
import { ArrowRight } from 'lucide-react';
import { Badge, Fig } from '@/components/ui';
import { ROUTES } from '@/lib/routes';
import { Empty, ErrorLine, StatusChip } from './common';

export function CaseQueue({ fixture }: { fixture: boolean }) {
  const [rows, setRows] = useState<CaseSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [state, setState] = useState('all');
  const [status, setStatus] = useState('all');
  const [connected, setConnected] = useState(false);
  const [, tick] = useState(0);
  const loadVersion = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    if (fixture) {
      setRows(FIXTURE_SUMMARIES);
      return;
    }
    try {
      const loaded = await api.cases();
      if (version !== loadVersion.current) return;
      setRows(latestPerApplicant(loaded));
      setError(null);
    } catch (e) {
      if (version !== loadVersion.current) return;
      setError((e as Error).message);
    }
  }, [fixture]);

  useEffect(() => {
    void load();
    if (fixture) return;
    const off = subscribeEvents(() => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void load(), 250);
    }, (open) => { setConnected(open); if (open) void load(); });
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => {
      loadVersion.current++;
      off();
      clearInterval(t);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [fixture, load]);

  const href = (id: string) => (fixture ? `${ROUTES.caseV2(id)}?fixture=1` : ROUTES.caseV2(id));

  const shown = rows?.filter((c) => (state === 'all' || c.state === state) && (status === 'all' || c.status === status) && `${c.applicantName} ${c.refCode} ${c.id}`.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <section className="cq-section" aria-labelledby="cq-queue-title">
      <div className="cq-head">
        <div>
          <h2 id="cq-queue-title">In progress {rows && <Badge kind={fixture ? 'fixture' : 'live'} />}</h2>
          <p>{rows ? <>{rows.length === 0 ? 'Nothing open yet. Open a household above to start.' : 'Cases Stampy is working, newest first.'}</> : 'Loading…'}</p>
        </div>
        <span className={`cq-live ${connected || fixture ? 'cq-live--on' : ''}`}>{fixture ? 'Fixture view' : connected ? 'Updating live' : 'Reconnecting'}</span>
      </div>
      <ErrorLine error={error} />
      {error && <button className="cq-quiet" type="button" onClick={() => void load()}>Try again</button>}
      {rows && rows.length > 3 && (
        <div className="cq-tools">
          <input className="stp-input" type="search" aria-label="Find a case" placeholder="Find by name, reference or case ID" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select aria-label="Work stage" className="stp-input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All stages</option><option value="reading">Reading documents</option><option value="questions_open">Questions open</option><option value="needs_person">Needs a person</option><option value="ready_for_review">Ready for review</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select>
        </div>
      )}
      {rows && rows.length > 0 && shown?.length === 0 && <Empty>No cases match. <button className="stp-link" onClick={() => { setQuery(''); setState('all'); setStatus('all'); }}>Clear filters</button></Empty>}
      {shown && shown.length > 0 ? (
        <ul className="cq-list">
          {shown.map((c) => (
            <li key={c.id} className="cq-row">
              <Link href={href(c.id)} className="cq-row__main">
                <span className="cq-row__who">
                  <strong>{c.applicantName}</strong>
                  <span>{c.id} · {c.state} · Ref {formatRef(c.refCode)}</span>
                </span>
                <span className="cq-row__benefit"><StatusChip status={c.status} /></span>
                <span className="cq-row__needs">
                  <span><Fig prov={fixture ? 'fixture' : 'live'}>{c.openQuestions}</Fig> open</span>
                  <span title={dateTime(c.updatedAt)}>{timeAgo(c.updatedAt)}</span>
                </span>
                <span className="cq-row__go">Review <ArrowRight size={15} aria-hidden /></span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** One application per applicant: keep only the newest case for each applicant name (the worker does the same). */
function latestPerApplicant<T extends { applicantName: string; createdAt: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).filter((r) => {
    const k = r.applicantName.trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
