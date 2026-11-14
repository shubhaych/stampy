'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react';
import { GC1_BUNDLE } from '@cleancase/contracts/fixtures';
import { STATIONS } from '@cleancase/snap-rules';
import { Direction, HudFrame, StampMark } from '@/components/ui';
import { money, signedMoney } from '@/lib/format';

/* ------------------------------------------------------------------ script */

type Phase = 'open' | 'check' | 'resolve' | 'certify';
type View = 'queue' | 'case' | 'resolve' | 'gate';

interface S {
  phase: Phase; view: View; station: number; scan: number; autofill: boolean; flag: boolean; proof: number;
  consent: boolean; approved: boolean; call: number; fact: boolean; accepted: boolean;
  gate: number; stamped: boolean; cursor: string | null; click: number;
}

const INITIAL: S = {
  phase: 'open', view: 'queue', station: 1, scan: 0, autofill: false, flag: false, proof: 0,
  consent: false, approved: false, call: 0, fact: false, accepted: false, gate: 0, stamped: false, cursor: null, click: 0,
};

type Step = [at: number, patch: Partial<S> | ((s: S) => Partial<S>)];
const click = (s: S) => ({ click: s.click + 1 });

const PHASES: { id: Phase; num: string; label: string; at: number }[] = [
  { id: 'open', num: '01', label: 'Open the case', at: 0 },
  { id: 'check', num: '02', label: 'Check the file', at: 5200 },
  { id: 'resolve', num: '03', label: 'Resolve conflicts', at: 11200 },
  { id: 'certify', num: '04', label: 'Certify', at: 20600 },
];
const CYCLE_MS = 30000;

const STEPS: Step[] = [
  [0, { ...INITIAL }],
  [500, { cursor: 'row-gc1' }],
  [1400, (s) => ({ ...click(s), view: 'case' })],
  [2000, { scan: 1, cursor: 'doc' }], [2500, { scan: 2 }], [3000, { scan: 3 }],
  [3600, { autofill: true, cursor: 'budget' }],
  [5200, { phase: 'check', cursor: 'station-5' }],
  [6000, (s) => ({ ...click(s), station: 5 })],
  [6600, { flag: true }],
  [7300, { cursor: 'view-proof' }],
  [8100, (s) => ({ ...click(s), proof: 1 })], [8550, { proof: 2 }], [9000, { proof: 3 }], [9450, { proof: 4 }], [9900, { proof: 5 }],
  [11200, { phase: 'resolve', cursor: 'station-8' }],
  [11900, (s) => ({ ...click(s), station: 8, view: 'resolve' })],
  [12600, { cursor: 'consent' }],
  [13300, (s) => ({ ...click(s), consent: true })],
  [13900, { cursor: 'approve-call' }],
  [14600, (s) => ({ ...click(s), approved: true })],
  [15100, { call: 1, cursor: 'call' }], [16000, { call: 2 }], [16900, { call: 3 }],
  [17600, { fact: true }],
  [18300, { cursor: 'accept-fact' }],
  [19000, (s) => ({ ...click(s), accepted: true })],
  [20600, { phase: 'certify', cursor: 'certify-btn' }],
  [21300, (s) => ({ ...click(s), view: 'gate', station: 10 })],
  [22000, { cursor: 'gate-0' }],
  [22700, (s) => ({ ...click(s), gate: 1 })],
  [23300, { cursor: 'gate-1' }],
  [24000, (s) => ({ ...click(s), gate: 2 })],
  [24600, { cursor: 'final-certify' }],
  [25300, (s) => ({ ...click(s), stamped: true })],
  [26000, { cursor: null }],
];

function stateAt(t: number): S {
  return STEPS.filter(([at]) => at <= t).reduce<S>((s, [, p]) => ({ ...s, ...(typeof p === 'function' ? p(s) : p) }), INITIAL);
}

/* ------------------------------------------------------------------ callouts */

const CALLOUTS: Record<Phase, { t: string; d: string }[]> = {
  open: [
    { t: 'Document Reader', d: 'Reads each document, maps it to a verification requirement, and boxes the exact line it read.' },
    { t: 'Autofill, pending accept', d: 'Values land in the budget sheet, but nothing changes the case until the worker clicks.' },
  ],
  check: [
    { t: 'Flags in both directions', d: 'Each flag carries its direction (↑ over or ↓ under), the dollars, and the rule id.' },
    { t: 'Proof thread', d: 'Source line → extracted field → policy passage → recompute → the human action. Every step is a real row.' },
  ],
  resolve: [
    { t: 'Evidence ledger', d: 'When the paystub, the employer form and the case budget disagree, a question opens with the dollars at stake.' },
    { t: 'Resolution planner', d: 'Proposes the cheapest way to close it. The worker approves each outreach; nothing is sent automatically.' },
    { t: 'Voice Verifier', d: 'With household consent, calls the employer, says it is an AI, and brings back facts with quotes.' },
  ],
  certify: [
    { t: 'Pre-issuance gate', d: 'Catches skipped stations and open items before the benefit goes out. A warning, never a block.' },
    { t: 'The worker certifies', d: 'Resolve, or override with a typed reason. The stamp belongs to a merit-staff worker.' },
  ],
};

/* ------------------------------------------------------------------ views */

const b = GC1_BUNDLE;
const flag = b.flags[0]!;
const plan = b.plans[0]!;
const QUEUE = [
  { id: 'GC-1', st: 'CA', hh: 1, docs: 3, flags: 1, day: 11 },
  { id: 'GC-2', st: 'TX', hh: 1, docs: 2, flags: 2, day: 8 },
  { id: 'GC-3', st: 'NY', hh: 2, docs: 2, flags: 1, day: 13 },
  { id: 'GC-4', st: 'CA', hh: 3, docs: 3, flags: 0, day: 6 },
];

function QueueView() {
  return (
    <div className="wt-queue">
      <div className="wt-label">My cases · shift of 8</div>
      {QUEUE.map((q) => (
        <div key={q.id} className="wt-queue__row" data-cursor={q.id === 'GC-1' ? 'row-gc1' : undefined}>
          <span className="num">{q.id}</span><span>{q.st}</span><span>HH {q.hh}</span>
          <span className="wt-muted">{q.docs} docs · {q.flags} {q.flags === 1 ? 'flag' : 'flags'}</span>
          <span className="wt-chip">Day {q.day} of 30</span>
        </div>
      ))}
    </div>
  );
}

function DocView({ s }: { s: S }) {
  const lines = [
    { text: 'Pay period 10/01/2026 to 10/14/2026', show: s.scan >= 1 },
    { text: 'Pay frequency: Biweekly', show: s.scan >= 2, hot: true },
    { text: 'Gross $1,240.00', show: s.scan >= 3, hot: true },
  ];
  return (
    <div className="wt-doc" data-cursor="doc">
      <div className="wt-doc__head"><span>Paystub · Employer A</span><span>p.1</span></div>
      {lines.map((l) => (
        <div key={l.text} className={`wt-doc__line ${l.show ? 'is-read' : ''} ${l.hot && l.show ? 'is-hot' : ''}`}>{l.text}</div>
      ))}
      {s.scan > 0 && s.scan < 3 ? <motion.div className="wt-doc__beam" initial={{ top: '10%' }} animate={{ top: '90%' }} transition={{ duration: 1.4, ease: 'linear' }} /> : null}
    </div>
  );
}

function Budget({ s }: { s: S }) {
  return (
    <div className="wt-budget" data-cursor="budget">
      <div className="wt-label">Budget sheet</div>
      <div className="wt-budget__row">
        <span>Earned income / mo</span>
        <span className="fig">
          <span className={`num ${s.accepted ? 'wt-struck' : ''}`}>{money(1240)}</span>
          {s.accepted ? <span className="num wt-new">{money(2666)}</span> : null}
        </span>
      </div>
      <div className="wt-budget__row">
        <span>Pay frequency</span>
        <span className="num">{s.accepted ? 'biweekly ✓' : s.autofill ? <span className="wt-pending">biweekly · pending accept</span> : 'monthly'}</span>
      </div>
    </div>
  );
}

const PROOF = ['Source: “Gross $1,240.00”, p.1', 'Extracted: biweekly, 95% conf.', 'Policy: 7 CFR 273.10(c) (unverified)', 'Recompute: $1,240 × 2.15 = $2,666', 'Human: waiting on the worker'];

function FlagPane({ s }: { s: S }) {
  return (
    <div className="wt-flags">
      <div className="wt-label">AI review</div>
      <AnimatePresence>
        {s.flag ? (
          <motion.div className="wt-flag" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
            <div className="wt-flag__top"><Direction dir="over" /><span className="num wt-muted">{flag.ruleId}</span></div>
            <div className="wt-flag__title">{flag.title}</div>
            <span className="num wt-delta">{signedMoney(flag.deltaMonthly ?? 0)} / mo</span>
            <div className="wt-flag__btns">
              <span className="wt-btn wt-btn--ghost" data-cursor="view-proof">View proof</span>
              <span className={`wt-btn ${s.accepted ? 'wt-btn--done' : ''}`}>{s.accepted ? 'Accepted' : 'Accept'}</span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {s.proof > 0 ? (
        <ol className="wt-proof">
          {PROOF.slice(0, s.proof).map((p, i) => (
            <motion.li key={p} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}><span className="wt-proof__dot" style={{ background: ['var(--src)', 'var(--ai)', 'var(--question)', 'var(--ledger)', 'var(--human)'][i] }} />{p}</motion.li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

const CALL = [
  { who: 'AI', text: 'This is an AI assistant calling on behalf of the county benefits office…' },
  { who: 'Employer', text: 'Sure, this is payroll. Go ahead.' },
  { who: 'Employer', text: 'Every other Friday. Biweekly.' },
];

function ResolveView({ s }: { s: S }) {
  return (
    <div className="wt-resolve">
      <div className="wt-question">
        <span className="wt-question__q">?</span>
        <div>
          <div className="wt-question__t">{s.accepted ? 'closed: biweekly, so $2,666 a month' : 'How often is Lena paid?'}</div>
          <div className="wt-muted">Paystub says biweekly · employer form says weekly · case budget says monthly</div>
        </div>
        <span className="num wt-stake">{money(1426)} / mo at stake</span>
      </div>
      <div className="wt-plan">
        <div className="wt-label">Resolution planner · ranked</div>
        {plan.options.slice(0, 3).map((o, i) => (
          <div key={o.channel} className={`wt-plan__opt ${i === 0 && s.approved ? 'is-approved' : ''}`}>
            <span>{i + 1}. {o.channel === 'employer_call' ? 'Call the employer' : o.channel === 'employer_email' ? 'One-line employer email' : 'Ask in the interview'}</span>
            <span className="wt-muted">{o.estCost}</span>
            {i === 0 ? <span className={`wt-btn ${s.approved ? 'wt-btn--done' : ''}`} data-cursor="approve-call">{s.approved ? 'Approved' : 'Approve'}</span> : null}
          </div>
        ))}
        <div className="wt-consent" data-cursor="consent"><span className={`wt-check ${s.consent ? 'is-on' : ''}`}>{s.consent ? '✓' : ''}</span> Household consent to contact the employer on file</div>
      </div>
      {s.accepted ? (
        <motion.div className="wt-recompute" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <span className="wt-label">Rules engine recomputed</span>
          <span className="num"><span className="wt-struck">{money(1240)}</span> → <span className="wt-new">{money(2666)}</span> / mo</span>
          <span className="wt-muted">Approve or reject the change: the worker&apos;s call.</span>
        </motion.div>
      ) : null}
      {s.call > 0 ? (
        <div className="wt-call" data-cursor="call">
          {CALL.slice(0, s.call).map((c, i) => (
            <motion.div key={i} className={`wt-call__line wt-call__line--${c.who === 'AI' ? 'ai' : 'them'}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}><b>{c.who}:</b> {c.text}</motion.div>
          ))}
          {s.fact ? (
            <motion.div className="wt-fact" initial={{ opacity: 0, scale: 0.9, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }}>
              pay frequency: biweekly · employer, 0:22 · quote attached
              <span className={`wt-btn ${s.accepted ? 'wt-btn--done' : ''}`} data-cursor="accept-fact">{s.accepted ? 'Accepted' : 'Accept'}</span>
            </motion.div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const GATE = [
  { rule: 'PG3', label: 'Interview not recorded (station skipped)' },
  { rule: 'PG5', label: 'Budget differs from recompute' },
];

function GateView({ s }: { s: S }) {
  return (
    <div className="wt-gate">
      <div className="wt-label">Before you certify</div>
      {GATE.map((g, i) => (
        <div key={g.rule} className={`wt-gate__item ${s.gate > i ? 'is-done' : 'is-open'}`}>
          <span className="num wt-muted">{g.rule}</span>
          <span>{g.label}</span>
          <span className={`wt-btn ${s.gate > i ? 'wt-btn--done' : 'wt-btn--ghost'}`} data-cursor={`gate-${i}`}>{s.gate > i ? 'Resolved' : 'Resolve'}</span>
        </div>
      ))}
      <div className="wt-gate__foot">
        <span className={`wt-btn ${s.gate >= GATE.length ? '' : 'wt-btn--off'}`} data-cursor="final-certify">Certify</span>
        {s.stamped ? <StampMark /> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ app frame */

function MockApp({ s }: { s: S }) {
  let center: ReactNode;
  if (s.view === 'queue') center = <QueueView />;
  else if (s.view === 'resolve') center = <ResolveView s={s} />;
  else if (s.view === 'gate') center = <GateView s={s} />;
  else center = <div className="wt-casegrid"><DocView s={s} /><Budget s={s} /></div>;
  return (
    <div className="wt-app">
      <div className="wt-app__bar">
        <span className="wt-app__dots"><i /><i /><i /></span>
        <span className="num">{s.view === 'queue' ? 'stampy · my cases' : 'Case GC-1 · CA · HH 1 · filed 2026-10-03'}</span>
        <span className="wt-chip">Day 11 of 30</span>
        <span className="wt-btn" data-cursor="certify-btn">Certify…</span>
      </div>
      <div className="wt-app__body">
        <ol className="wt-rail">
          {STATIONS.map((st) => {
            const status = s.view === 'queue' ? 'pending' : st.id === s.station ? 'active' : st.id === 3 && s.view === 'gate' && s.gate < 1 ? 'skipped' : st.id < s.station && st.id !== 3 ? 'done' : 'pending';
            return (
              <li key={st.id} className={`wt-rail__item is-${status}`} data-cursor={`station-${st.id}`}>
                <span className="wt-rail__bead" />{st.short}
              </li>
            );
          })}
        </ol>
        <div className="wt-center">
          <AnimatePresence mode="wait">
            <motion.div key={s.view} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="wt-center__inner">
              {center}
            </motion.div>
          </AnimatePresence>
        </div>
        {s.view === 'case' ? <FlagPane s={s} /> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ player */

export function CaseWalkthrough() {
  const reduce = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const inView = useInView(root, { amount: 0.35 });
  const [s, setS] = useState<S>(() => stateAt(PHASES[0]!.at));
  const [cursor, setCursor] = useState({ x: 60, y: 40 });
  const timers = useRef<number[]>([]);

  const clear = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  const runFrom = useCallback((t0: number) => {
    clear();
    setS(stateAt(t0));
    for (const [at] of STEPS) {
      if (at <= t0) continue;
      timers.current.push(window.setTimeout(() => setS(stateAt(at)), at - t0));
    }
    timers.current.push(window.setTimeout(() => runFrom(0), CYCLE_MS - t0));
  }, [clear]);

  useEffect(() => {
    if (reduce) {
      setS(stateAt(PHASES[1]!.at - 1));
      return;
    }
    if (inView) runFrom(0);
    else clear();
    return clear;
  }, [inView, reduce, runFrom, clear]);

  const jump = (p: (typeof PHASES)[number]) => {
    if (reduce) {
      const next = PHASES[PHASES.indexOf(p) + 1];
      setS({ ...stateAt((next?.at ?? CYCLE_MS) - 1), cursor: null });
      return;
    }
    runFrom(p.at);
  };

  useLayoutEffect(() => {
    if (!s.cursor || !stage.current) return;
    const el = stage.current.querySelector(`[data-cursor="${s.cursor}"]`);
    if (!el) return;
    const sr = stage.current.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setCursor({ x: r.left - sr.left + r.width * 0.55, y: r.top - sr.top + r.height * 0.55 });
  }, [s]);

  return (
    <section ref={root} id="walkthrough" className="wt wrap" aria-labelledby="wt-title" data-prov-scope="walkthrough-note">
      <div className="eyebrow">What a caseworker sees</div>
      <h2 id="wt-title" className="font-display h-section">One case, start to finish, with Stampy beside the worker.</h2>
      <p className="wt-intro">Open a case, check the file, resolve what disagrees, and certify. Stampy reads, flags, cites and recomputes; every change waits for a click.</p>
      <HudFrame label={`Golden case GC-1 · ${PHASES.find((p) => p.id === s.phase)!.label}`}>
        <div className="wt-phases" role="tablist" aria-label="Walkthrough phase">
          {PHASES.map((p) => (
            <button key={p.id} type="button" role="tab" aria-selected={s.phase === p.id} className={`wt-phase ${s.phase === p.id ? 'is-on' : ''}`} onClick={() => jump(p)}>
              <span className="num">{p.num}</span>{p.label}
            </button>
          ))}
        </div>
        <div className="wt-stage-wrap">
          <div ref={stage} className="wt-stage">
            <MockApp s={s} />
            {!reduce && s.cursor ? (
              <div className="wt-cursor" style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }} aria-hidden>
                <svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 2 L4 19 L8.5 14.8 L11.4 21.4 L14.2 20.2 L11.3 13.7 L17.6 13.7 Z" /></svg>
                <AnimatePresence>
                  <motion.span key={s.click} className="wt-cursor__ripple" initial={{ scale: 0.2, opacity: 0.9 }} animate={{ scale: 1.8, opacity: 0 }} transition={{ duration: 0.55 }} />
                </AnimatePresence>
              </div>
            ) : null}
          </div>
          <aside className="wt-callouts" aria-live="polite">
            <AnimatePresence mode="popLayout">
              {CALLOUTS[s.phase].map((c, i) => (
                <motion.div key={`${s.phase}-${c.t}`} className="wt-callout" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ delay: 0.2 + i * 0.35, duration: 0.4 }}>
                  <span className="wt-callout__check">✓</span>
                  <div><div className="wt-callout__t">{c.t}</div><div className="wt-callout__d">{c.d}</div></div>
                </motion.div>
              ))}
            </AnimatePresence>
          </aside>
        </div>
      </HudFrame>
      <p id="walkthrough-note" className="wt-note" data-prov-note="fixture">Demo data: a hand-authored test case (GC-1). The documents and the employer call are simulated.</p>
    </section>
  );
}
