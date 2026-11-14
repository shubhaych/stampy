'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CaseSummary } from '@stampy/contracts/stampy';
import { api, subscribeEvents } from '@/lib/stampy/api';
import { FIXTURE_SUMMARIES } from '@/lib/stampy/fixture';
import { formatRef, timeAgo, dateTime } from '@/lib/stampy/util';
import { ROUTES } from '@/lib/routes';
import { Empty, ErrorLine, StatusChip } from './common';

export function CaseQueue({ fixture }: { fixture: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState<CaseSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [, tick] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (fixture) {
      setRows(FIXTURE_SUMMARIES);
      return;
    }
    try {
      setRows(await api.cases());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [fixture]);

  useEffect(() => {
    void load();
    if (fixture) return;
    const off = subscribeEvents(() => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void load(), 250);
    }, setConnected);
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => {
      off();
      clearInterval(t);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [fixture, load]);

  const href = (id: string) => (fixture ? `${ROUTES.caseV2(id)}?fixture=1` : ROUTES.caseV2(id));

  return (
    <div className="panel">
      <div className="panel__title">
        <span>Queue {rows ? `· ${rows.length}` : ''}</span>
        <span className={`stp-live ${connected ? 'stp-live--on' : ''}`}>{fixture ? 'Fixture view' : connected ? 'Live updates' : 'Connecting…'}</span>
      </div>
      <ErrorLine error={error} />
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
              {rows.map((c) => (
                <tr key={c.id} className="stp-queue__row" onClick={() => router.push(href(c.id))}>
                  <td>
                    <Link href={href(c.id)} className="font-semibold" onClick={(e) => e.stopPropagation()}>
                      {c.applicantName}
                    </Link>
                    <div className="stp-sub">{c.id} · {c.state}</div>
                  </td>
                  <td className="tabular">{formatRef(c.refCode)}</td>
                  <td><StatusChip status={c.status} /></td>
                  <td className="text-right tabular">{c.openQuestions}</td>
                  <td className="text-right tabular">{c.documents}</td>
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
