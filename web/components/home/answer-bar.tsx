'use client';

import { motion, useReducedMotion } from 'motion/react';
import { Badge, Fig, SourceChip } from '@/components/ui';
import { FACTS, source } from './facts';

const SEGMENTS = [
  { fact: FACTS.foundCaseFile, where: 'Case file', part: 'Document Reader', pct: 44.54, color: 'var(--pine)' },
  { fact: FACTS.foundHousehold, where: 'Household', part: 'Interview questions we write', pct: 35.0, color: 'var(--over)' },
  { fact: FACTS.foundCollateral, where: 'Collateral contacts', part: 'Voice Verifier', pct: 20.46, color: 'var(--under)' },
];

const CARDS = [
  { k: '01 · Read', t: 'Document Reader and the review roles', d: 'Reads paystubs, leases and bills, maps each to a verification requirement, and flags what disagrees with the case file, with the exact line.' },
  { k: '02 · Ask', t: 'Questions CleanCase writes, never answers', d: 'When only the household knows, CleanCase writes the question for the interview. The worker asks it and records the answer.' },
  { k: '03 · Call', t: 'Voice Verifier', d: 'Calls the employer or landlord after household consent, says it is an AI, asks only the planned questions, and returns quotes with timestamps.' },
];

/** Section 4, A6 Where the answer lives: one bar split by how FY2023 variances were found, then three cards. */
export function AnswerBar() {
  const reduce = useReducedMotion();
  return (
    <section className="answer wrap" aria-labelledby="answer-title">
      <div className="eyebrow">Where the answer lives</div>
      <div data-figure>
        <h2 id="answer-title" className="font-display h-section">About 45% of errors are visible in the case file. The rest need a person.</h2>
        <Badge kind="replay" /> <SourceChip {...source(FACTS.foundCaseFile.src)} />
      </div>
      <div className="answer__bar" role="img" aria-label="How FY2023 variances were found: case file 44.54%, household 35.00%, collateral contacts 20.46%">
        {SEGMENTS.map((s, i) => (
          <motion.div key={s.where} className="answer__seg" style={{ background: s.color }} initial={reduce ? false : { width: 0 }} whileInView={{ width: `${s.pct}%` }} viewport={{ once: true, amount: 0.6 }} transition={{ duration: 0.7, delay: i * 0.35 }} />
        ))}
      </div>
      <ul className="answer__legend">
        {SEGMENTS.map((s, i) => (
          <motion.li key={s.where} initial={reduce ? false : { opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 1.1 + i * 0.2 }}>
            <span className="answer__swatch" style={{ background: s.color }} />
            <span><Fig prov={s.fact.prov}>{s.fact.value}</Fig> {s.where} <span className="answer__arrow">→ {s.part}</span></span>
          </motion.li>
        ))}
      </ul>
      <div className="answer__cards">
        {CARDS.map((c) => (
          <article key={c.k} className="tele-card">
            <div className="eyebrow tele-card__k">{c.k}</div>
            <h3 className="tele-card__t">{c.t}</h3>
            <p className="tele-card__d">{c.d}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
