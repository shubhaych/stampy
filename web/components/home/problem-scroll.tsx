'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react';
import { Odometer } from '@/components/ui';
import { FACTS } from './facts';
import { LedgerBeam } from './ledger-beam';
import { useHomeStatic } from './use-static';

/** 6.65 of 11.68 points of FY2023 dollar error were agency-caused (facts ledger row 4), shown as a share. */
const AGENCY_SHARE = ((6.65 / 11.68) * 100).toFixed(1);

/** Rolls up from zero once mounted, so each beat's number counts in as it lands. */
function Roll({ to, format }: { to: number; format: (n: number) => string }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const id = window.setTimeout(() => setV(to), 120);
    return () => window.clearTimeout(id);
  }, [to]);
  return <Odometer value={v} format={format} />;
}

const Issue = () => <div className="eyebrow beat2__k">The Issue</div>;

function BeatPER() {
  return (
    <div className="beat2">
      <Issue />
      <div className="beat2__big font-display"><Roll to={10.1} format={(n) => `$${n.toFixed(1)}B`} /></div>
      <p className="beat2__say">in improper SNAP payments in FY2025, a <span className="num">{FACTS.perFy2025.value}</span> payment error rate.</p>
    </div>
  );
}

function BeatAgency() {
  return (
    <div className="beat2">
      <Issue />
      <div className="beat2__big font-display"><Roll to={Number(AGENCY_SHARE)} format={(n) => `${n.toFixed(1)}%`} /></div>
      <p className="beat2__say">of SNAP payment error dollars come from the agency side, not from households.</p>
      <p className="beat2__why">Budgeting slips that a second check can catch before the money goes out.</p>
    </div>
  );
}

const SEGMENTS = [
  { value: FACTS.foundCaseFile.value, where: 'In the case file', part: 'Stampy reads the documents', pct: 44.54, color: 'var(--pine)' },
  { value: FACTS.foundHousehold.value, where: 'From the household', part: 'Stampy writes the question', pct: 35.0, color: 'var(--over)' },
  { value: FACTS.foundCollateral.value, where: 'From an employer or landlord', part: 'Stampy makes the call', pct: 20.46, color: 'var(--under)' },
];

function BeatWhere() {
  return (
    <div className="beat2 beat2--wide">
      <Issue />
      <h2 className="font-display h-section beat2__title">About 45% of errors are visible in the case file. The rest need to communicate with a person. Stampy solves both.</h2>
      <div className="where__bar">
        {SEGMENTS.map((s, i) => (
          <motion.div key={s.where} className="where__seg" style={{ background: s.color }} initial={{ width: 0 }} animate={{ width: `${s.pct}%` }} transition={{ duration: 0.7, delay: 0.15 + i * 0.3 }} />
        ))}
      </div>
      <ul className="where__legend">
        {SEGMENTS.map((s, i) => (
          <motion.li key={s.where} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 + i * 0.2 }}>
            <span className="where__swatch" style={{ background: s.color }} />
            <span className="num where__pct">{s.value}</span>
            <span>{s.where}</span>
            <span className="where__arrow">→ {s.part}</span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

function BeatTwoWays() {
  return (
    <div className="beat2 beat2--wide">
      <Issue />
      <h2 className="font-display h-section beat2__title two2__title">The Two Ways States Are Wrong</h2>
      <div className="two2">
        <motion.div className="two2__col two2__col--over" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="two2__word"><span aria-hidden>↑</span> Overissue</div>
          <div className="two2__fig font-display"><Roll to={9.04} format={(n) => `$${n.toFixed(2)}B`} /></div>
          <p>Paid out beyond what households were due.</p>
        </motion.div>
        <LedgerBeam over={9.28} under={1.33} overLabel={`${FACTS.overFy2025.value} over`} underLabel={`${FACTS.underFy2025.value} under`} plain large />
        <motion.div className="two2__col two2__col--under" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
          <div className="two2__word"><span aria-hidden>↓</span> Underissue</div>
          <div className="two2__fig font-display"><Roll to={1.48} format={(n) => `$${n.toFixed(2)}B`} /></div>
          <p>Households short-changed on what they were owed.</p>
        </motion.div>
      </div>
    </div>
  );
}

const CLOCK = [
  { x: 70, fy: 'FY2025', note: 'Published' },
  { x: 250, fy: 'FY2026', note: 'Closed' },
  { x: 430, fy: 'FY2027', note: 'Sampled now' },
  { x: 690, fy: 'FY2030', note: 'Cost share set' },
];

function BeatClock({ local }: { local: number }) {
  const step = Math.min(CLOCK.length - 1, Math.floor(local * CLOCK.length * 1.3));
  return (
    <div className="beat2 beat2--wide">
      <Issue />
      <h2 className="font-display h-section beat2__title">States have to fix this in FY2027.</h2>
      <p className="clock2__lede">
        Federal quality control is sampling FY2027 cases right now, and that year&apos;s error rate sets how much each state pays in FY2030. States are facing it today and are already looking for tools to get ahead of it.
      </p>
      <svg viewBox="0 0 760 170" className="clock2" role="img" aria-label="Timeline: FY2025 published, FY2026 closed, FY2027 sampled now, and FY2027 sets the FY2030 cost share">
        <line x1="40" y1="110" x2="730" y2="110" className="clock2__rail" />
        <motion.line x1="70" y1="110" y2="110" className="clock2__done" initial={{ x2: 70 }} animate={{ x2: CLOCK[Math.min(step, 2)]!.x }} transition={{ duration: 0.6 }} />
        <motion.path d="M430 96 C 500 14, 620 14, 690 96" className="clock2__arc" initial={{ pathLength: 0 }} animate={{ pathLength: step >= 3 ? 1 : 0 }} transition={{ duration: 0.9 }} />
        <text x="560" y="26" textAnchor="middle" className="clock2__lag" opacity={step >= 3 ? 1 : 0}>FY2027 sets it</text>
        {CLOCK.map((c, i) => (
          <g key={c.fy} opacity={i <= step ? 1 : 0.3}>
            <circle cx={c.x} cy={110} r={i === 2 ? 11 : 7} className={`clock2__dot clock2__dot--${i}`} />
            {i === 2 ? <circle cx={c.x} cy={110} r={11} className="clock2__pulse" /> : null}
            <text x={c.x} y={145} textAnchor="middle" className="clock2__fy">{c.fy}</text>
            <text x={c.x} y={164} textAnchor="middle" className="clock2__note">{c.note}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/** CBPP (June 24, 2026), Table 1: approximate FY2028 cost shift at FY2025 error rates, in $ millions. */
const COST_STATES = [
  { st: 'California', m: 1900, label: '$1.9B' },
  { st: 'New York', m: 1150, label: '$1.15B' },
  { st: 'Florida', m: 900, label: '$900M' },
  { st: 'Texas', m: 725, label: '$725M' },
  { st: 'Pennsylvania', m: 410, label: '$410M' },
];

function BeatCost() {
  const max = COST_STATES[0]!.m;
  return (
    <div className="beat2 beat2--wide">
      <Issue />
      <div className="cost">
        <div>
          <h2 className="font-display h-section beat2__title">What it costs states</h2>
          <div className="cost__big font-display"><Roll to={9} format={(n) => `≈ $${n.toFixed(0)}B`} /></div>
          <p className="cost__say">is what states would owe for SNAP benefits in FY2028 alone, the first year of the cost shift, at FY2025 error rates. Almost half of states could owe $100 million or more.</p>
          <p className="cost__why">That comes on top of the cut to federal funding for running SNAP, which started October 1, 2026.</p>
        </div>
        <ul className="cost__bars" aria-label="Largest estimated FY2028 state bills">
          {COST_STATES.map((c, i) => (
            <li key={c.st}>
              <span className="cost__st">{c.st}</span>
              <span className="cost__track">
                <motion.span className="cost__fill" initial={{ width: 0 }} animate={{ width: `${(c.m / max) * 100}%` }} transition={{ duration: 0.8, delay: 0.3 + i * 0.12, ease: [0.2, 0.7, 0.2, 1] }} />
              </span>
              <span className="num cost__amt">{c.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const BEATS: ((local: number) => ReactNode)[] = [
  () => <BeatPER />, () => <BeatAgency />, () => <BeatWhere />, () => <BeatTwoWays />, (l) => <BeatClock local={l} />, () => <BeatCost />,
];

function SourceNote() {
  return (
    <p id="issue-sources" className="wrap issue__sources" data-prov-note="replay">
      Sources: USDA FNA FY2025 payment error rate; FNS SNAP Quality Control Annual Report FY2023 (agency share = 6.65 of 11.68 points of dollar error; how errors were found; over- and underissuance). Cost-share timing as summarized from the statute. State cost estimate:{' '}
      <a href="https://www.cbpp.org/blog/states-first-ever-bill-for-snap-benefits-could-cost-billions" target="_blank" rel="noreferrer">CBPP, June 24, 2026</a>{' '}
      (FY2028 at FY2025 error rates; actual bills depend on FY2025 or FY2026 rates and FY2028 benefit costs).
    </p>
  );
}

function Scrolling() {
  const track = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: track, offset: ['start start', 'end end'] });
  const [pos, setPos] = useState({ i: 0, local: 0 });
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const x = Math.min(0.9999, Math.max(0, v)) * BEATS.length;
    const i = Math.floor(x);
    setPos((p) => (p.i === i && Math.abs(p.local - (x - i)) < 0.02 ? p : { i, local: x - i }));
  });
  return (
    <div ref={track} className="problem__track" style={{ height: `${(BEATS.length + 1) * 100}vh` }}>
      {BEATS.map((_, i) => <div key={i} data-scroll-hold className="problem__hold" style={{ top: `${(i + 1) * 100}vh` }} aria-hidden />)}
      <div className="problem__stage">
        <AnimatePresence mode="wait">
          <motion.div key={pos.i} className="problem__beat" initial={{ opacity: 0, y: 40, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -40, filter: 'blur(6px)', transition: { duration: 0.2 } }} transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}>
            {BEATS[pos.i]!(pos.local)}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Section 2: the issue, straight after the hero. Sticky stage, one beat at a time, short holds between beats. */
export function ProblemScroll() {
  const isStatic = useHomeStatic();
  return (
    <section id="problem" className="problem" aria-label="The issue" data-prov-scope="issue-sources">
      {isStatic ? <div className="wrap problem__static">{BEATS.map((b, i) => <div key={i}>{b(1)}</div>)}</div> : <Scrolling />}
      <SourceNote />
    </section>
  );
}
