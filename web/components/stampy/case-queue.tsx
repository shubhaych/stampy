'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CaseSummary } from '@stampy/contracts/stampy';
import { api, subscribeEvents } from '@/lib/stampy/api';
import { FIXTURE_SUMMARIES } from '@/lib/stampy/fixture';
import { formatRef, timeAgo, dateTime } from '@/lib/stampy/util';
import { Badge } from '@/components/ui';
import { ROUTES } from '@/lib/routes';
import { Empty, ErrorLine, StatusChip } from './common';

export function CaseQueue({ fixture }: { fixture: boolean }) {
  const router = useRouter();
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
      setRows(loaded);
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
  const states = [...new Set(rows?.map((c) => c.state) ?? [])].sort();

  return (
    <div className="panel">
      <div className="panel__title">
        <span>Case queue {rows && <Badge kind={fixture ? 'fixture' : 'live'} />}</span>
        <span className={`stp-live ${connected ? 'stp-live--on' : ''}`}>{fixture ? 'Fixture view' : connected ? 'Connected' : 'Updates disconnected'}</span>
      </div>
      <div className="stp-queue-tools">
        <label className="stp-field"><span>Find a case</span><input className="stp-input" type="search" placeholder="Name, reference or case ID" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
        <label className="stp-field"><span>State</span><select aria-label="State" className="stp-input" value={state} onChange={(e) => setState(e.target.value)}><option value="all">All loaded states</option>{states.map((code) => <option key={code}>{code}</option>)}</select></label>
        <label className="stp-field"><span>Work stage</span><select aria-label="Work stage" className="stp-input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All stages</option><option value="reading">Reading documents</option><option value="questions_open">Questions open</option><option value="needs_person">Needs a person</option><option value="ready_for_review">Ready for review</option><option value="approved">Change approved</option><option value="rejected">Change rejected</option></select></label>
        <button className="btn btn--ghost" type="button" onClick={() => void load()}>Refresh queue</button>
      </div>
      <ErrorLine error={error} />
      {rows && <p className="stp-sub">Showing {shown?.length} of {rows.length} loaded cases <Badge kind={fixture ? 'fixture' : 'live'} /> · <Link className="stp-link" href="/cases/sources">Public SNAP data sources →</Link></p>}
      {error && rows && <p role="status" className="stp-hint">Showing the last loaded queue. Refresh before acting.</p>}
      {rows && rows.length > 0 && shown?.length === 0 && <Empty>No cases match these filters. <button className="stp-link" onClick={() => { setQuery(''); setState('all'); setStatus('all'); }}>Clear filters</button></Empty>}
      {rows === null && !error ? <Empty>Loading cases…</Empty> : null}
      {rows && rows.length === 0 ? (
        <Empty>
          No applications yet. Send one from <Link className="stp-link" href={ROUTES.apply}>the application page</Link>.
        </Empty>
      ) : null}
      {rows && rows.length > 0 ? (
        <div className="stp-table-wrap">
          <table className="deck-table stp-queue">
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Ref</th>
                <th>Status</th>
                <th className="text-right">Open questions</th>
                <th className="text-right">Documents</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {shown?.map((c) => (
                <tr key={c.id} className="stp-queue__row" onClick={() => router.push(href(c.id))}>
                  <td>
                    <Link href={href(c.id)} className="font-semibold" onClick={(e) => e.stopPropagation()}>
                      {c.applicantName}
                    </Link>
                    <div className="stp-sub">{c.id} · {c.state}</div>
                  </td>
                  <td className="tabular">{formatRef(c.refCode)}</td>
                  <td><StatusChip status={c.status} /></td>
                  <td className="text-right tabular">{c.openQuestions} <Badge kind={fixture ? 'fixture' : 'live'} /></td>
                  <td className="text-right tabular">{c.documents} <Badge kind={fixture ? 'fixture' : 'live'} /></td>
                  <td className="stp-sub" title={dateTime(c.updatedAt)}>{timeAgo(c.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
