'use client';

import { useState } from 'react';
import type { CaseBundle } from '@stampy/contracts';
import { Badge, Btn, Direction, Fig } from '@/components/ui';
import { money } from '@/lib/format';

const CHANNEL_LABEL: Record<string, string> = {
  recheck_file: 'Re-check what is on file', text_household: 'Text the household', employer_email: 'One-line employer email',
  employer_call: 'Call the employer', landlord_call: 'Call the landlord', interview: 'Ask in the interview',
};

/** Scaffold of station 8 "Resolve open questions". The planner proposes; the worker approves each outreach. */
export function ResolvePanel({ bundle }: { bundle: CaseBundle }) {
  const [approved, setApproved] = useState<Record<string, number>>({});
  const [consent, setConsent] = useState(false);
  if (!bundle.questions.length) return <p className="m-0 text-sm opacity-70">No open questions on this case.</p>;
  return (
    <div className="grid gap-4">
      {bundle.questions.map((q) => {
        const plan = bundle.plans.find((p) => p.questionId === q.id);
        return (
          <article key={q.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--question)' }} data-question={q.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong>? {q.text}</strong>
              <span className="flex items-center gap-2">
                <Direction dir={q.direction} />
                {q.stake.amountMonthly !== null ? <Fig prov={q.prov}>{money(q.stake.amountMonthly)} / mo at stake</Fig> : <Badge kind={q.prov} />}
              </span>
            </div>
            <p className="m-0 mt-1 text-xs opacity-70">{q.factIds.length} facts disagree on {q.field.replace(/_/g, ' ')} · status {q.status}</p>
            {plan ? (
              <ol className="m-0 mt-3 grid list-none gap-2 p-0">
                {plan.options.map((o, i) => {
                  const isApproved = approved[q.id] === i;
                  const blocked = o.requiresConsent && !consent;
                  return (
                    <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-md p-2" style={{ background: 'var(--glass)' }}>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{i + 1}. {CHANNEL_LABEL[o.channel] ?? o.channel} <span className="tabular text-xs opacity-60">· {o.estCost} · {o.estTime}</span></div>
                        <div className="text-xs opacity-75">{o.why}</div>
                      </div>
                      {isApproved ? <span className="eyebrow" style={{ color: 'var(--glow)' }}>Approved by worker</span> : (
                        <Btn variant="ghost" disabled={blocked} onClick={() => setApproved((a) => ({ ...a, [q.id]: i }))} title={blocked ? 'Record household consent first' : undefined}>Approve</Btn>
                      )}
                    </li>
                  );
                })}
              </ol>
            ) : null}
          </article>
        );
      })}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        Household consent to contact this collateral on file
      </label>
      <p className="m-0 text-xs opacity-60">Nothing is sent automatically. Fixture mode shows messages and simulates sends.</p>
    </div>
  );
}
