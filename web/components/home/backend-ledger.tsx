'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react';

/** One scripted loop of what the backend does with one case (golden test case GC-1). */
const STEP_AT = [0, 900, 1800, 2700, 3600, 5000, 7000, 8600, 10200, 11800];
const CYCLE_MS = 15000;
const FINAL = STEP_AT.length - 1;

const SOURCES = [
  { id: 'pay', label: 'Paystub' },
  { id: 'budget', label: 'Case budget' },
  { id: 'match', label: 'Wage match' },
  { id: 'lease', label: 'Lease' },
  { id: 'employer', label: 'Employer' },
] as const;

const FACTS = [
  { at: 1, src: 'pay', field: 'Pay frequency', value: 'biweekly', meta: 'p.1 · 95%' },
  { at: 2, src: 'budget', field: 'Pay frequency', value: 'monthly', meta: 'case file' },
  { at: 3, src: 'match', field: 'Employer', value: 'same employer', meta: 'state wage record' },
  { at: 4, src: 'lease', field: 'Occupants', value: 'Maria R., Daniel R.', meta: 'p.1 · 93%' },
] as const;

const FEATURES = [
  { from: 1, to: 4, t: 'Evidence ledger', d: 'Every fact is stored with its source, page, date and confidence. Nothing is ever overwritten.' },
  { from: 5, to: 5, t: 'Conflict detector', d: 'Plain code, not AI, compares facts. A mismatch opens a question with the dollars at stake.' },
  { from: 6, to: 7, t: 'Resolution planner', d: 'Picks the cheapest way to settle it. A worker approves every call, text or email.' },
  { from: 8, to: 9, t: 'Rules engine + a person', d: 'Recomputes from accepted facts only. The new amount waits for the caseworker’s decision.' },
];

/** Section: what Stampy actually does on the backend. */
export function BackendLedger() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  const [step, setStep] = useState(reduce ? FINAL : 0);

  useEffect(() => {
    if (reduce) { setStep(FINAL); return; }
    if (!inView) return;
    const timers = STEP_AT.map((at, i) => window.setTimeout(() => setStep(i), at));
    timers.push(window.setTimeout(() => setStep(0), CYCLE_MS));
    const loop = window.setInterval(() => {
      STEP_AT.forEach((at, i) => timers.push(window.setTimeout(() => setStep(i), at)));
    }, CYCLE_MS);
    return () => { timers.forEach(clearTimeout); clearInterval(loop); };
  }, [inView, reduce]);

  const firing = FACTS.find((f) => f.at === step)?.src ?? (step === 7 || step === 8 ? 'employer' : null);
  const conflict = step >= 5;
  const routed = step >= 6;
  const answered = step >= 8;
  const recomputed = step >= 9;

  return (
    <section ref={ref} id="backend" className="bl wrap" aria-labelledby="bl-title" data-prov-scope="backend-note">
      <div className="eyebrow bl__k">The backend</div>
      <h2 id="bl-title" className="font-display h-section">What Stampy actually does behind the screen</h2>
      <p className="bl__lede">A case is a pile of facts from different places that often disagree. Stampy keeps every one of them, finds the disagreements, settles each one the cheapest way, and recalculates only after a person accepts the answer.</p>

      <div className="bl__board">
        <ol className="bl__sources" aria-label="Where facts come from">
          {SOURCES.map((s) => (
            <li key={s.id} className={firing === s.id ? 'is-on' : ''}>
              <span className="bl__dot" />{s.label}
              {firing === s.id && !reduce ? <motion.span key={step} className="bl__shot" initial={{ x: 0, opacity: 1 }} animate={{ x: 90, opacity: 0 }} transition={{ duration: 0.7 }} /> : null}
            </li>
          ))}
        </ol>

        <div className="bl__ledger">
          <div className="bl__label">Evidence ledger · append-only</div>
          <AnimatePresence initial={false}>
            {FACTS.filter((f) => step >= f.at).map((f) => {
              const clash = conflict && f.field === 'Pay frequency';
              return (
                <motion.div key={f.src} className={`bl__row ${clash ? 'is-clash' : ''}`} initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }}>
                  <span className="bl__src">{SOURCES.find((s) => s.id === f.src)!.label}</span>
                  <span className="bl__field">{f.field}</span>
                  <span className="bl__val">{f.value}</span>
                  <span className="bl__meta">{f.meta}</span>
                </motion.div>
              );
            })}
            {answered ? (
              <motion.div key="answer" className="bl__row is-answer" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }}>
                <span className="bl__src">Employer</span>
                <span className="bl__field">Pay frequency</span>
                <span className="bl__val">biweekly</span>
                <span className="bl__meta">call, quote at 0:22 · answers Q1</span>
              </motion.div>
            ) : null}
          </AnimatePresence>
          {conflict ? <motion.div className="bl__neq" initial={{ scale: 0 }} animate={{ scale: 1 }}>≠</motion.div> : null}
        </div>

        <div className="bl__questions">
          <div className="bl__label">Open questions</div>
          <AnimatePresence>
            {conflict ? (
              <motion.div key="q1" className={`bl__q ${answered ? 'is-closed' : ''}`} initial={{ opacity: 0, y: 12, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
                <div className="bl__q-t">{answered ? '✓ Closed: biweekly' : 'Q1 · How often is she paid?'}</div>
                <div className="bl__q-m">{answered ? 'Answer attached to the question that asked for it' : '$1,426 a month at stake · ↑ over'}</div>
                {routed && !answered ? (
                  <div className="bl__route">
                    <span className="is-pick">Call employer</span><span>Email</span><span>Interview</span>
                    {step === 7 && !reduce ? <motion.span className="bl__ping" initial={{ x: 0 }} animate={{ x: [0, 60, 0] }} transition={{ duration: 1.4 }} /> : null}
                  </div>
                ) : null}
              </motion.div>
            ) : null}
            {conflict ? (
              <motion.div key="q2" className="bl__q" initial={{ opacity: 0, y: 12, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.3 }}>
                <div className="bl__q-t">Q2 · Who is Daniel?</div>
                <div className="bl__q-m">Lease lists 2 people, case has 1 · ask in the interview</div>
              </motion.div>
            ) : null}
          </AnimatePresence>
          {recomputed ? (
            <motion.div className="bl__recompute" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="bl__label">Rules engine</div>
              <div className="bl__amount"><s>$1,240</s> → <b>$2,666</b> / mo income</div>
              <div className="bl__wait">Waiting on the caseworker to approve</div>
            </motion.div>
          ) : null}
        </div>
      </div>

      <ol className="bl__features">
        {FEATURES.map((f) => (
          <li key={f.t} className={step >= f.from && step <= f.to ? 'is-on' : ''}>
            <div className="bl__f-t">{f.t}</div>
            <div className="bl__f-d">{f.d}</div>
          </li>
        ))}
      </ol>
      <p id="backend-note" className="bl__note" data-prov-note="fixture">Example values are from a hand-authored test case (GC-1).</p>
    </section>
  );
}
