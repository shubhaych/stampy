'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { GC1_BUNDLE } from '@cleancase/contracts/fixtures';
import { Badge, Direction, Fig, HudFrame, TextCta } from '@/components/ui';
import { money, signedMoney } from '@/lib/format';

const TABS = ['01 Upload', '02 Read', '03 Flag', '04 Recompute'] as const;
const STEP_MS = 4500;

function Panel({ i }: { i: number }) {
  const b = GC1_BUNDLE;
  const flag = b.flags[0]!;
  if (i === 0) {
    return (
      <ul className="mini__list">
        {b.docs.map((d) => <li key={d.id}><span>{d.title}</span><Badge kind={d.prov} /></li>)}
      </ul>
    );
  }
  if (i === 1) {
    return (
      <ul className="mini__list">
        {b.extractions.map((e) => <li key={e.id}><span className="num">{e.field} = {e.value}</span><span className="num mini__conf">{Math.round(e.confidence * 100)}% conf.</span></li>)}
      </ul>
    );
  }
  if (i === 2) {
    return (
      <div className="mini__flag">
        <Direction dir={flag.direction} long />
        <div className="mini__flag-title">{flag.title}</div>
        <div className="num mini__muted">{flag.ruleId} · cites {flag.citations[0]?.section} (unverified)</div>
        {flag.deltaMonthly !== null ? <Fig prov={flag.prov}>{signedMoney(flag.deltaMonthly)} / mo</Fig> : null}
      </div>
    );
  }
  return (
    <div className="mini__flag">
      <div className="num mini__muted">{flag.recompute?.arithmetic}</div>
      <div className="mini__recompute"><Fig prov={flag.prov}>{money(flag.recompute!.before)} → {money(flag.recompute!.after)} / mo</Fig></div>
      <div className="mini__muted">Waiting on the worker: accept, dismiss, or ask a question.</div>
    </div>
  );
}

/** Section 6: auto-cycling live preview (~18 s), pausable, tabs jump. Fixture data from golden case GC-1. */
export function MiniDemo() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const id = window.setTimeout(() => setI((x) => (x + 1) % TABS.length), STEP_MS);
    return () => window.clearTimeout(id);
  }, [i, paused]);

  return (
    <section className="mini wrap" aria-label="Live preview">
      <HudFrame label="Live preview" right={<Badge kind="fixture" />}>
        <div className="mini__tabs" role="tablist">
          {TABS.map((t, k) => (
            <button key={t} type="button" role="tab" aria-selected={i === k} className="mini__tab" onClick={() => { setI(k); setPaused(true); }}>{t}</button>
          ))}
          <button type="button" className="mini__pause" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>{paused ? 'Play' : 'Pause'}</button>
        </div>
        <div className="mini__body" role="tabpanel">
          <AnimatePresence mode="wait">
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.24 }}>
              <Panel i={i} />
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="mini__foot"><TextCta href="/demo">Open the demo →</TextCta></div>
      </HudFrame>
    </section>
  );
}
