'use client';

import { useState } from 'react';
import { AUTHENTICITY_CAVEAT } from '@stampy/contracts';
import type { Direction as Dir } from '@stampy/contracts';
import type { Call, CaseBundleV2, Decision, InboundEmail, Outreach, Recompute } from '@stampy/contracts/stampy';
import { Badge, Direction, Fig, HudFrame, Odometer, StampMark } from '@/components/ui';
import { money, signedMoney } from '@/lib/format';
import type { WorkerIdentity } from '@/lib/stampy/api';
import { clockTime, dateTime, mss } from '@/lib/stampy/util';
import { Empty, ErrorLine, MoneyText, useIsFixture, useProv } from './common';

/** Runs one worker action with busy/error state. */
export function useAction() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  return { busy, error, run };
}

/* ---------- Recompute (the hero) ---------- */

export function benefitDirection(r: Recompute): Dir {
  const b = r.before.benefitMonthly;
  const a = r.after.benefitMonthly;
  if (a === null || b === null || a === b) return 'none';
  return a < b ? 'over' : 'under';
}

export function RecomputePanel({ recompute }: { recompute: Recompute | null }) {
  const pv = useProv();
  const p = pv('live');
  if (!recompute) {
    return (
      <HudFrame label="Rules engine" className="stp-hero">
        <div className="stp-hero__empty">
          <p className="m-0 font-display text-xl">Not recomputed yet.</p>
          <p className="m-0 stp-sub">The rules engine runs once the open questions have accepted evidence.</p>
        </div>
        <p className="stp-hero__caption">Rules engine (PolicyEngine-US) recomputed from accepted evidence. A flag alone never changes a case.</p>
      </HudFrame>
    );
  }
  const { before, after } = recompute;
  const dir = benefitDirection(recompute);
  const delta = after.benefitMonthly !== null && before.benefitMonthly !== null ? after.benefitMonthly - before.benefitMonthly : null;
  return (
    <HudFrame label="Rules engine · recomputed" right={<span className="stp-sub tabular">{recompute.engine} · {recompute.ms} ms</span>} className="stp-hero">
      <div className="stp-hero__grid">
        <div className="stp-hero__row">
          <span className="stp-hero__label">Income per month</span>
          <span className="stp-hero__before"><Fig prov={p}>{money(before.incomeMonthly)}</Fig></span>
          <span className="stp-hero__arrow" aria-hidden>→</span>
          <span className="stp-hero__after">
            <Fig prov={p}><Odometer value={after.incomeMonthly} format={(n) => money(n)} /></Fig>
          </span>
        </div>
        <div className="stp-hero__row stp-hero__row--main">
          <span className="stp-hero__label">SNAP benefit per month</span>
          <span className="stp-hero__before">
            {before.benefitMonthly !== null ? <Fig prov={p}>{money(before.benefitMonthly)}</Fig> : <span className="stp-sub">not computed</span>}
          </span>
          <span className="stp-hero__arrow" aria-hidden>→</span>
          <span className="stp-hero__after">
            {after.benefitMonthly !== null ? (
              <Fig prov={p}><Odometer value={after.benefitMonthly} format={(n) => money(n)} /></Fig>
            ) : (
              <span className="stp-sub">not computed</span>
            )}
          </span>
        </div>
      </div>
      <div className="stp-hero__dir">
        <Direction dir={dir} long />
        {delta !== null ? <Fig prov={p}>{signedMoney(delta)} / mo</Fig> : null}
        {dir === 'over' ? <span className="stp-sub">The filed application would have paid more than the evidence supports.</span> : null}
        {dir === 'under' ? <span className="stp-sub">The filed application would have paid less than the evidence supports.</span> : null}
      </div>
      <div className="stp-hero__basis">
        <div><span className="eyebrow opacity-60">Before</span> <MoneyText text={before.basis} prov={p} /></div>
        <div><span className="eyebrow opacity-60">After</span> <MoneyText text={after.basis} prov={p} /></div>
      </div>
      <p className="stp-hero__caption">Rules engine (PolicyEngine-US) recomputed from accepted evidence. A flag alone never changes a case.</p>
    </HudFrame>
  );
}

/* ---------- Decision (the caseworker's) ---------- */

export function DecisionPanel({ bundle, worker, onDecide }: { bundle: CaseBundleV2; worker: WorkerIdentity | null; onDecide: (action: 'approve' | 'reject', note: string) => Promise<void> }) {
  const fixture = useIsFixture();
  const pv = useProv();
  const [note, setNote] = useState('');
  const { busy, error, run } = useAction();
  const d: Decision | null = bundle.decision;
  const ready = bundle.case.status === 'ready_for_review';
  const r = bundle.recompute;
  const why = fixture
    ? 'Fixture view: actions are off.'
    : !worker
      ? 'Sign in as a caseworker to decide.'
      : !ready
        ? 'Available when the case is ready for review.'
        : null;
  return (
    <section className="panel stp-decision" aria-label="Caseworker decision">
      <div className="panel__title"><span>Caseworker decision</span></div>
      {d ? (
        <div className="stp-decision__done">
          <StampMark label={d.action === 'approve' ? 'Approved · Merit staff' : 'Rejected · Merit staff'} tone={d.action === 'approve' ? 'pine' : 'conflict'} />
          <p className="m-0">
            <strong>{d.decidedBy}</strong> <span className="stp-sub">· {dateTime(d.at)}</span>
          </p>
          {d.note ? <p className="m-0 stp-note">“{d.note}”</p> : null}
        </div>
      ) : (
        <>
          {r && r.after.benefitMonthly !== null && r.before.benefitMonthly !== null ? (
            <p className="m-0 mb-3 text-sm">
              Proposed change: benefit <Fig prov={pv('live')}>{money(r.before.benefitMonthly)}</Fig> → <Fig prov={pv('live')}>{money(r.after.benefitMonthly)}</Fig> per month.
            </p>
          ) : null}
          <label className="stp-field stp-field--deck">
            <span>Note (optional)</span>
            <textarea className="stp-input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why you approved or rejected the change" />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn btn--primary" disabled={!!why || !!busy} onClick={() => run('approve', () => onDecide('approve', note))}>
              {busy === 'approve' ? 'Saving…' : 'Approve change'}
            </button>
            <button type="button" className="btn btn--ghost" disabled={!!why || !!busy} onClick={() => run('reject', () => onDecide('reject', note))}>
              {busy === 'reject' ? 'Saving…' : 'Reject change'}
            </button>
          </div>
          {why ? <p className="stp-hint mt-2">{why}</p> : null}
          <ErrorLine error={error} />
          <p className="stp-hint mt-2">The decision is yours. Stampy flags, asks and recomputes; it never changes a case on its own.</p>
        </>
      )}
    </section>
  );
}

/* ---------- Outreach thread ---------- */

type ThreadItem = { at: string; out?: Outreach; inb?: InboundEmail };

const OUT_STATUS: Record<Outreach['status'], string> = { draft: 'Draft', sent: 'Sent', simulated: 'Simulated send', failed: 'Failed' };

export function OutreachPanel({ outreach, inbound, worker, onSend }: { outreach: Outreach[]; inbound: InboundEmail[]; worker: WorkerIdentity | null; onSend: () => Promise<void> }) {
  const fixture = useIsFixture();
  const pv = useProv();
  const { busy, error, run } = useAction();
  const items: ThreadItem[] = [
    ...outreach.map((o) => ({ at: o.sentAt ?? o.createdAt, out: o })),
    ...inbound.map((i) => ({ at: i.receivedAt, inb: i })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  return (
    <section className="panel" aria-label="Outreach thread">
      <div className="panel__title"><span>Email thread</span></div>
      {items.length === 0 ? <Empty>No email yet. The AI drafts a request when questions open.</Empty> : null}
      <ol className="stp-thread">
        {items.map((it) =>
          it.out ? (
            <li key={it.out.id} className={`stp-mail stp-mail--out stp-mail--${it.out.status}`}>
              <div className="stp-mail__head">
                <span className="stp-pill">{it.out.kind === 'request' ? 'Request' : 'Checklist'}</span>
                <span className={`stp-pill stp-pill--mail-${it.out.status}`}>{OUT_STATUS[it.out.status]}</span>
                {it.out.status === 'simulated' ? <Badge kind={pv('fixture')} /> : null}
                <span className="stp-sub">to {it.out.toAddr} · {clockTime(it.at)}</span>
              </div>
              <div className="stp-mail__subject">{it.out.subject}</div>
              <pre className="stp-mail__body"><MoneyText text={it.out.bodyText} prov={pv('live')} /></pre>
              {it.out.approvedBy ? <div className="stp-sub">Approved by {it.out.approvedBy}</div> : null}
              {it.out.error ? <p className="stp-error">{it.out.error}</p> : null}
              {it.out.status === 'draft' && it.out.kind === 'request' ? (
                <div className="stp-mail__actions">
                  <span className="stp-sub">AI draft. Nothing goes out until a caseworker approves it.</span>
                  <button type="button" className="btn btn--primary" disabled={fixture || !worker || !!busy} onClick={() => run('send', onSend)}>
                    {busy === 'send' ? 'Sending…' : 'Approve and send'}
                  </button>
                  {!worker && !fixture ? <span className="stp-hint">Sign in as a caseworker to send.</span> : null}
                </div>
              ) : null}
            </li>
          ) : it.inb ? (
            <li key={it.inb.id} className="stp-mail stp-mail--in">
              <div className="stp-mail__head">
                <span className="stp-pill">Reply</span>
                {it.inb.simulated ? <><span className="stp-pill">Simulated</span><Badge kind={pv('fixture')} /></> : null}
                <span className="stp-sub">from {it.inb.fromAddr} · {clockTime(it.at)}</span>
              </div>
              {it.inb.subject ? <div className="stp-mail__subject">{it.inb.subject}</div> : null}
              {it.inb.bodyText ? <pre className="stp-mail__body"><MoneyText text={it.inb.bodyText} prov={pv('synthetic')} /></pre> : null}
              <div className="stp-sub">{it.inb.attachmentCount} attachment{it.inb.attachmentCount === 1 ? '' : 's'}</div>
            </li>
          ) : null,
        )}
      </ol>
      <ErrorLine error={error} />
      <p className="stp-hint">Nothing is sent automatically except the checklist the applicant was promised on the call.</p>
    </section>
  );
}

/* ---------- Calls ---------- */

export function CallsPanel({ calls }: { calls: Call[] }) {
  const pv = useProv();
  return (
    <section className="panel" aria-label="Calls">
      <div className="panel__title"><span>Calls · {calls.length}</span></div>
      {calls.length === 0 ? <Empty>No calls yet. The applicant calls the number in the request email.</Empty> : null}
      <div className="grid gap-4">
        {calls.map((c) => (
          <article key={c.id} className="stp-call">
            <div className="stp-call__head">
              <span className={`stp-pill ${c.verified ? 'stp-pill--agree' : 'stp-pill--conflict'}`}>{c.verified ? 'Caller verified' : 'Not verified'}</span>
              {c.simulated ? <><span className="stp-pill">Simulated</span><Badge kind={pv('fixture')} /></> : null}
              <span className="stp-pill">{c.status === 'ended' ? 'Ended' : 'In progress'}</span>
              <span className="stp-sub">{c.fromNumber ?? 'unknown number'} · {clockTime(c.startedAt)}</span>
            </div>
            <ol className="stp-turns">
              {c.turns.map((t, i) => (
                <li key={i} className={`stp-turn stp-turn--${t.role}`}>
                  <span className="stp-turn__who">{t.role === 'assistant' ? 'AI agent' : 'Caller'}</span>
                  <span className="stp-turn__at tabular">{mss(t.atSeconds)}</span>
                  <span className="stp-turn__text"><MoneyText text={t.text} prov={pv(c.simulated ? 'fixture' : 'live')} /></span>
                </li>
              ))}
            </ol>
            <div className="stp-call__foot">
              {c.recordingUrl ? <a className="stp-link" href={c.recordingUrl} target="_blank" rel="noreferrer">Recording ↗</a> : <span className="stp-sub">No recording</span>}
              {c.callbackRequested ? <span className="stp-pill stp-pill--conflict">Callback requested: {c.callbackRequested}</span> : null}
              {c.endedReason ? <span className="stp-sub">Ended: {c.endedReason}</span> : null}
            </div>
          </article>
        ))}
      </div>
      {calls.length ? <p className="stp-caveat">{AUTHENTICITY_CAVEAT}</p> : null}
    </section>
  );
}

/* ---------- Demo controls ---------- */

export function DemoControls({ onRun }: { onRun: (what: 'call' | 'reply' | 'reread' | 'recompute') => Promise<void> }) {
  const fixture = useIsFixture();
  const { busy, error, run } = useAction();
  const b = (key: 'call' | 'reply' | 'reread' | 'recompute', label: string) => (
    <button type="button" className="btn btn--ghost stp-demo__btn" disabled={fixture || !!busy} onClick={() => run(key, () => onRun(key))}>
      {busy === key ? 'Working…' : label}
    </button>
  );
  return (
    <details className="panel stp-demo">
      <summary className="panel__title stp-demo__summary">
        <span>Demo controls (fixture)</span>
        <Badge kind="fixture" />
      </summary>
      <div className="stp-demo__grid">
        {b('call', 'Simulate call (fixture)')}
        {b('reply', 'Simulate applicant reply (fixture)')}
        {b('reread', 'Re-read documents')}
        {b('recompute', 'Recompute')}
      </div>
      {fixture ? <p className="stp-hint">Fixture view: actions are off.</p> : null}
      <ErrorLine error={error} />
      <p className="stp-hint">Simulations run the same code path with scripted input. Nothing here changes a case without a caseworker.</p>
    </details>
  );
}
