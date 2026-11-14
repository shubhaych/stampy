'use client';

import { useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react';
import { Fig } from '@/components/ui';
import { FACTS, source, type Fact } from './facts';
import { LedgerBeam } from './ledger-beam';
import { useHomeStatic } from './use-static';

interface Beat { fact: Fact; label: ReactNode }
const BEATS: Beat[] = [
  { fact: FACTS.perFy2025Dollars, label: <>in improper SNAP payments in FY2025, a <Fig prov={FACTS.perFy2025.prov}>{FACTS.perFy2025.value}</Fig> payment error rate</> },
  { fact: FACTS.agencyPoints, label: 'points of FY2023 dollar error were caused by agencies, not households' },
  { fact: FACTS.incomeShare, label: 'of FY2023 variances were in income' },
];

function BeatView({ b }: { b: Beat }) {
  return (
    <div className="beat">
      <div className="beat__figure font-display"><Fig prov={b.fact.prov} source={source(b.fact.src)}>{b.fact.value}</Fig></div>
      <p className="beat__label">{b.label}</p>
      {b.fact.caveat ? <p className="beat__caveat">{b.fact.caveat}</p> : null}
    </div>
  );
}

function TwoWays() {
  return (
    <div className="two-ways wrap">
      <h2 className="font-display h-section two-ways__title">Two ways to be wrong</h2>
      <div className="two-ways__grid">
        <div className="two-ways__col">
          <div className="eyebrow dir dir--over">↑ Overissue</div>
          <div className="two-ways__fig font-display"><Fig prov={FACTS.overissuedFy2023.prov} source={source(FACTS.overissuedFy2023.src)}>{FACTS.overissuedFy2023.value}</Fig></div>
          <p>Paid out beyond what the household was due, FY2023.</p>
        </div>
        <LedgerBeam over={9.28} under={1.33} overLabel={`${FACTS.overFy2025.value} over`} underLabel={`${FACTS.underFy2025.value} under`} prov="replay" />
        <div className="two-ways__col">
          <div className="eyebrow dir dir--under">↓ Underissue</div>
          <div className="two-ways__fig font-display"><Fig prov={FACTS.underissuedFy2023.prov} source={source(FACTS.underissuedFy2023.src)}>{FACTS.underissuedFy2023.value}</Fig></div>
          <p>Short-changed households, FY2023; <Fig prov={FACTS.agencyShareUnder.prov}>{FACTS.agencyShareUnder.value}</Fig> of underpayment variances were agency-caused.</p>
        </div>
      </div>
      <p className="two-ways__note">Underpayments are errors too. CleanCase reports them with the same urgency.</p>
    </div>
  );
}

function BeatsScroll() {
  const track = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: track, offset: ['start start', 'end end'] });
  const [i, setI] = useState(0);
  useMotionValueEvent(scrollYProgress, 'change', (v) => setI(Math.min(BEATS.length - 1, Math.floor(v * BEATS.length))));
  return (
    <div ref={track} className="stats__track">
      <div className="stats__stage">
        <AnimatePresence mode="wait">
          <motion.div key={i} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -24 }} transition={{ duration: 0.35 }}>
            <BeatView b={BEATS[i]!} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Section 2: the cost of getting it wrong. Sticky stat beats, each figure alone on stage, then Two ways to be wrong. */
export function StatBeats() {
  const isStatic = useHomeStatic();
  return (
    <section id="numbers" className="stats" aria-label="The cost of getting it wrong">
      <div className="wrap"><div className="eyebrow stats__eyebrow">The cost of getting it wrong</div></div>
      {isStatic ? <div className="wrap stats__static">{BEATS.map((b) => <BeatView key={b.fact.value} b={b} />)}</div> : <BeatsScroll />}
      <TwoWays />
    </section>
  );
}
