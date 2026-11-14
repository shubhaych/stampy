'use client';

import type { CaseBundleV2 } from '@stampy/contracts/stampy';
import { buildLoop, LOOP_KIND_LABEL } from '@/lib/stampy/loop';
import { clockTime } from '@/lib/stampy/util';

/** The 14 steps of the loop. Lit only where audit rows back the step. */
export function LoopTracker({ audit }: { audit: CaseBundleV2['audit'] }) {
  const nodes = buildLoop(audit);
  const lit = nodes.filter((n) => n.state === 'lit').length;
  return (
    <section className="panel stp-loop" aria-label="Loop tracker">
      <div className="panel__title">
        <span>The loop</span>
        <span className="font-mono">{lit} of {nodes.length}</span>
      </div>
      <ol className="stp-loop__list">
        {nodes.map((n) => (
          <li
            key={n.key}
            className={`stp-node stp-node--${n.kind} stp-node--${n.state} ${n.next ? 'stp-node--next' : ''}`}
            data-state={n.state}
            title={n.backing.length ? n.backing.map((r) => `${r.action} · ${clockTime(r.at)}`).join('\n') : undefined}
          >
            <span className="stp-node__dot" aria-hidden />
            <div className="stp-node__body">
              <div className="stp-node__title">{n.title}</div>
              <div className="stp-node__meta">
                <span className="stp-node__kind">{LOOP_KIND_LABEL[n.kind]}</span>
                {n.at ? <span>{clockTime(n.at)}</span> : null}
                {n.note ? <span>{n.note}</span> : null}
                {n.next && n.state !== 'lit' ? <span className="stp-node__nexttag">next</span> : null}
              </div>
            </div>
            <span className="sr-only">({n.state === 'lit' ? 'done' : n.state})</span>
          </li>
        ))}
      </ol>
      <div className="stp-legend" aria-label="Legend">
        <span><i className="stp-sw stp-sw--src" />Source</span>
        <span><i className="stp-sw stp-sw--question" />Open question</span>
        <span><i className="stp-sw stp-sw--ai" />AI acts</span>
        <span><i className="stp-sw stp-sw--ledger" />Ledger and rules</span>
        <span><i className="stp-sw stp-sw--human" />Human decides</span>
      </div>
    </section>
  );
}
