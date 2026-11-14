'use client';

import { useRef, useState } from 'react';
import { motion, useMotionValueEvent, useScroll, useTransform, type MotionValue } from 'motion/react';
import { Badge, Fig, Odometer, StampMark, TextCta } from '@/components/ui';
import { money } from '@/lib/format';
import { CaseWheel } from './case-wheel';
import { useHomeStatic } from './use-static';

const CITE = '7 CFR 273.10(c) · biweekly × 2.15';

function Hero({ animated }: { animated: boolean }) {
  return (
    <div className="hero">
      {animated ? <CaseWheel /> : null}
      <div className="hero__copy wrap">
        <div className="eyebrow hero__eyebrow">CleanCase · Pre-issuance accuracy for SNAP</div>
        <h1 className="font-display h-hero hero__title">Check the case before the benefit goes out.</h1>
        <p className="hero__sub">
          CleanCase reads the case file, flags what doesn&apos;t match with the exact source line and the rule behind it, and recomputes the benefit. A merit-staff worker makes every decision.
        </p>
        <div className="hero__ctas">
          <TextCta href="/demo">Work a case →</TextCta>
          <a href="#numbers" className="hero__secondary">See the numbers</a>
        </div>
        <p className="eyebrow hero__mono">Every dollar right, in both directions · We never deny · We never auto-correct</p>
      </div>
    </div>
  );
}

function Paystub({ scan, box }: { scan?: MotionValue<string>; box?: MotionValue<number> }) {
  return (
    <div className="pass-stub" data-figure>
      <div className="pass-stub__head">
        <span>Paystub · Employer A</span>
        <Badge kind="synthetic" />
      </div>
      <div className="pass-stub__row">Pay period 10/01/2026 to 10/14/2026</div>
      <div className="pass-stub__row pass-stub__row--freq">Pay frequency: <b>Biweekly</b></div>
      <div className="pass-stub__row">Hours 80.00</div>
      <div className="pass-stub__row pass-stub__row--gross">Gross <b>$1,240.00</b></div>
      <svg className="pass-stub__boxes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <motion.rect x="4" y="34" width="62" height="12" rx="1.5" style={box ? { pathLength: box } : undefined} />
        <motion.rect x="4" y="62" width="56" height="12" rx="1.5" style={box ? { pathLength: box } : undefined} />
      </svg>
      {scan ? <motion.div className="pass-stub__beam" style={{ top: scan }} aria-hidden /> : null}
    </div>
  );
}

function Sheet({ recomputed, struck }: { recomputed: boolean; struck: boolean }) {
  return (
    <div className="pass-sheet">
      <div className="eyebrow pass-sheet__title">Budget sheet · Case GC-1 <Badge kind="fixture" /></div>
      <div className="pass-sheet__row">
        <span>Earned income</span>
        <span className="fig" data-figure>
          <span className={`num ${struck ? 'pass-struck' : ''}`}>{money(1240)} / mo</span>
          {recomputed ? <span className="num pass-new"><Odometer value={2666} format={(n) => money(n)} /> / mo</span> : null}
          <Badge kind="fixture" />
        </span>
      </div>
      <div className="pass-sheet__row"><span>Pay frequency</span><span className="num">{recomputed ? 'biweekly (pending accept)' : 'monthly'}</span></div>
    </div>
  );
}

function PassStatic() {
  return (
    <div className="wrap pass-static">
      <Paystub />
      <Sheet recomputed struck />
      <div className="pass-chips">
        <Fig prov="fixture">+$1,426 / mo not counted · ↑ overissuance risk</Fig>
        <span className="source-chip">{CITE} (verify)</span>
      </div>
      <div className="pass-stamp"><StampMark /><p className="pass-caption">Flag. Cite. Recompute. A person decides.</p></div>
    </div>
  );
}

function PassScroll() {
  const track = useRef<HTMLDivElement>(null);
  const { scrollYProgress: p } = useScroll({ target: track, offset: ['start start', 'end end'] });
  const lift = useTransform(p, [0, 0.14], [0, 1]);
  const liftY = useTransform(p, [0, 0.14], [80, 0]);
  const scan = useTransform(p, [0.14, 0.34], ['0%', '100%']);
  const box = useTransform(p, [0.3, 0.44], [0, 1]);
  const chips = useTransform(p, [0.44, 0.54], [0, 1]);
  const chipsX = useTransform(p, [0.44, 0.54], [-40, 0]);
  const delta = useTransform(p, [0.66, 0.72], [0, 1]);
  const cite = useTransform(p, [0.74, 0.8], [0, 1]);
  const [phase, setPhase] = useState({ struck: false, recomputed: false, stamp: false });
  useMotionValueEvent(p, 'change', (v) => setPhase({ struck: v > 0.56, recomputed: v > 0.6, stamp: v > 0.86 }));

  return (
    <div ref={track} className="pass-track">
      <div className="pass-stage">
        <div className="wrap pass-grid">
          <motion.div style={{ opacity: lift, y: liftY }}><Paystub scan={scan} box={box} /></motion.div>
          <div className="pass-right">
            <motion.div className="pass-flying" style={{ opacity: chips, x: chipsX }}>
              <span className="source-chip">Gross $1,240.00</span>
              <span className="source-chip">Biweekly</span>
            </motion.div>
            <Sheet recomputed={phase.recomputed} struck={phase.struck} />
            <motion.div style={{ opacity: delta }}><Fig prov="fixture">+$1,426 / mo not counted · ↑ overissuance risk</Fig></motion.div>
            <motion.div style={{ opacity: cite }}><span className="source-chip">{CITE} (verify)</span></motion.div>
          </div>
        </div>
        <div className="pass-stamp pass-stamp--float">
          {phase.stamp ? <StampMark /> : null}
          <motion.p className="pass-caption" style={{ opacity: phase.stamp ? 1 : 0 }}>Flag. Cite. Recompute. A person decides.</motion.p>
        </div>
      </div>
    </div>
  );
}

/** Section 1: hero (A1), The Pass (A2), The Stamp (A3). Static stacked version on phones and reduced motion. */
export function OpeningScene() {
  const isStatic = useHomeStatic();
  return (
    <section className="opening" aria-label="CleanCase">
      <Hero animated={!isStatic} />
      {isStatic ? <PassStatic /> : <PassScroll />}
    </section>
  );
}
