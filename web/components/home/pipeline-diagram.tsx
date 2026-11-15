'use client';

import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';

/**
 * What Stampy does behind the scenes, as one animated diagram: sources → evidence ledger → open question →
 * resolution planner → outreach → answers back to the ledger → rules engine → caseworker.
 * Figures are the sample case used across the demo (test data), named in the section's source note.
 */
const STAGES = ['Sources arrive', 'Facts land in the ledger', 'A conflict opens a question', 'The planner picks a channel', 'Stampy reaches out', 'Answers come back', 'The benefit is recomputed', 'A caseworker decides'];
const LAST = STAGES.length - 1;

export function PipelineDiagram() {
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLElement>(null);

  // Start when the diagram scrolls into view; people who prefer no motion see it complete.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setStage(LAST); return; }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { setPlaying(true); io.disconnect(); } }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!playing) return;
    if (stage >= LAST) { setPlaying(false); return; }
    const t = setTimeout(() => setStage((s) => s + 1), 1700);
    return () => clearTimeout(t);
  }, [playing, stage]);

  const at = (n: number) => ({ 'data-on': stage >= n ? '' : undefined, 'data-now': stage === n ? '' : undefined });
  const Flow = ({ n, children }: { n: number; children: React.ReactNode }) => <div className="pl-flow" {...at(n)}><i aria-hidden /><span>{children}</span></div>;

  return (
    <section ref={ref} className="pl wrap" aria-labelledby="pl-title" data-prov-scope="pipeline">
      <span className="eyebrow">How Stampy fixes it</span>
      <h2 id="pl-title" className="font-display h-section">Read the file, ask the right person, recompute, hand it to a caseworker.</h2>
      <p className="pl-lede">Stampy reads every document into a ledger of facts, each with its source. When two facts disagree it opens a question and settles it the cheapest way: the case file first, then a text to the household, then the employer or landlord. The rules engine recomputes the benefit, and a caseworker approves or rejects the change.</p>

      <div className="pl-controls">
        <button type="button" onClick={() => { if (stage >= LAST) { setStage(0); setPlaying(true); } else setPlaying((p) => !p); }}>
          {stage >= LAST ? <><RotateCcw size={15} aria-hidden /> Replay</> : playing ? <><Pause size={15} aria-hidden /> Pause</> : <><Play size={15} aria-hidden /> Play</>}
        </button>
        <ol aria-label="Stages">
          {STAGES.map((s, i) => <li key={s}><button type="button" aria-current={stage === i ? 'step' : undefined} data-on={stage >= i ? '' : undefined} onClick={() => { setPlaying(false); setStage(i); }} aria-label={s} title={s} /></li>)}
        </ol>
        <span aria-live="polite">{STAGES[stage]}</span>
      </div>

      <div className="pl-diagram">
        <div className="pl-row pl-row--3">
          <div className="pl-node pl-node--src" {...at(0)}><strong>Documents</strong></div>
          <div className="pl-node pl-node--src" {...at(0)}><strong>Data matches</strong></div>
          <div className="pl-node pl-node--src" {...at(0)}><strong>Case budget</strong></div>
        </div>
        <div className="pl-row pl-row--3">
          <Flow n={1}>gross $1,240, biweekly</Flow>
          <Flow n={1}>quarterly wage record</Flow>
          <Flow n={1}>$1,240 a month</Flow>
        </div>
        <div className="pl-node pl-node--ledger pl-ledger" {...at(1)}>
          <strong>Evidence ledger</strong>
          <small>Every fact keeps its source, date and confidence</small>
          <div className="pl-ledger__facts">
            <div className="pl-node pl-node--src" {...at(1)}><strong>Paid biweekly</strong><small>From paystub, page 1</small></div>
            <b aria-label="does not equal" {...at(2)}>≠</b>
            <div className="pl-node pl-node--src" {...at(1)}><strong>Paid monthly</strong><small>From case budget</small></div>
            <b aria-hidden {...at(2)}>→</b>
            <div className="pl-node pl-node--question" {...at(2)}><strong>Open question</strong><small>Pay frequency?</small></div>
          </div>
        </div>
        <div className="pl-row pl-row--1"><Flow n={3}>open question plus dollars at stake</Flow></div>
        <div className="pl-row pl-row--1"><div className="pl-node pl-node--ai pl-node--mid" {...at(3)}><strong>Resolution planner</strong><small>Picks the cheapest way to close it</small></div></div>
        <div className="pl-row pl-row--3">
          <Flow n={4}>missing paystub</Flow>
          <Flow n={4}>pay frequency?</Flow>
          <Flow n={4}>who is Daniel?</Flow>
        </div>
        <div className="pl-row pl-row--3">
          <div className="pl-node pl-node--ai" {...at(4)}><strong>Text the household</strong><small>Link to upload a photo</small></div>
          <div className="pl-node pl-node--ai" {...at(4)}><strong>Contact the employer</strong><small>Call or one-line email</small></div>
          <div className="pl-node pl-node--ai" {...at(4)}><strong>Interview copilot</strong><small>Prompts the worker live</small></div>
        </div>
        <div className="pl-row pl-row--3">
          <Flow n={5}>paystub photo</Flow>
          <Flow n={5}>biweekly, call at 0:42</Flow>
          <Flow n={5}>a roommate</Flow>
        </div>
        <div className="pl-node pl-node--ledger" {...at(5)}><strong>Answers written back to the ledger</strong><small>Each reply attaches to the question that asked for it</small></div>
        <div className="pl-row pl-row--1"><Flow n={6}>closed: biweekly, so $2,666 a month</Flow></div>
        <div className="pl-row pl-row--1"><div className="pl-node pl-node--ledger pl-node--mid" {...at(6)}><strong>Rules engine</strong><small>Recomputes the benefit</small></div></div>
        <div className="pl-row pl-row--1"><Flow n={7}>new amount beside the old one</Flow></div>
        <div className="pl-row pl-row--1"><div className="pl-node pl-node--human pl-node--mid" {...at(7)}><strong>Caseworker</strong><small>Approves or rejects the change</small></div></div>
      </div>

      <ul className="pl-legend" aria-label="Legend">
        <li className="pl-key--src">Sources, facts</li>
        <li className="pl-key--question">Open question</li>
        <li className="pl-key--ai">AI acts</li>
        <li className="pl-key--ledger">Ledger, rules</li>
        <li className="pl-key--human">Human decides</li>
      </ul>
      <p className="pl-note" data-prov-note="pipeline">Figures are from the sample case used in the demo: test data, not a real household.</p>
    </section>
  );
}
