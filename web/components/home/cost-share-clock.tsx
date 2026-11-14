'use client';

import { motion, useReducedMotion } from 'motion/react';
import { Badge, SourceChip } from '@/components/ui';
import { source } from './facts';

const STOPS = [
  { x: 60, fy: 'FY2025', note: 'Published' },
  { x: 260, fy: 'FY2026', note: 'Closed Sep 30' },
  { x: 460, fy: 'FY2027', note: 'Sampling now', now: true },
  { x: 700, fy: 'FY2030', note: 'Cost share set' },
];

/** Section 3, A5 Cost-Share Clock. Badge Fixture: the statute as summarized in the research doc. */
export function CostShareClock() {
  const reduce = useReducedMotion();
  const draw = reduce ? {} : { initial: { pathLength: 0 }, whileInView: { pathLength: 1 }, viewport: { once: true, amount: 0.6 } };
  return (
    <section className="clock wrap" aria-labelledby="clock-title">
      <div className="eyebrow">Why now</div>
      <h2 id="clock-title" className="font-display h-section">FY2027 is being sampled right now. It sets your FY2030 share.</h2>
      <p className="clock__sub">Every case worked this year counts.</p>
      <div className="clock__frame">
        <svg viewBox="0 0 760 170" className="clock__svg" role="img" aria-label="Timeline: FY2025 published, FY2026 closed September 30, FY2027 sampling now, FY2030 cost share set by FY2027">
          <line x1="40" y1="110" x2="730" y2="110" stroke="var(--line)" strokeWidth="2" />
          <motion.line x1="40" y1="110" x2="460" y2="110" stroke="var(--pine)" strokeWidth="2" {...draw} transition={{ duration: 1.2 }} />
          <motion.path d="M460 96 C 520 20, 640 20, 700 96" fill="none" stroke="var(--over)" strokeWidth="2" strokeDasharray="4 5" {...draw} transition={{ duration: 1.2, delay: 0.8 }} />
          <path d="M692 88 L700 98 L706 86" fill="none" stroke="var(--over)" strokeWidth="2" />
          {STOPS.map((s) => (
            <g key={s.fy}>
              <circle cx={s.x} cy={110} r={s.now ? 9 : 6} fill={s.now ? 'var(--over)' : s.fy === 'FY2030' ? 'var(--under)' : 'var(--pine)'} className={s.now ? 'clock__now' : undefined} />
              <text x={s.x} y={142} textAnchor="middle" className="clock__fy">{s.fy}</text>
              <text x={s.x} y={160} textAnchor="middle" className="clock__note">{s.note}</text>
            </g>
          ))}
        </svg>
      </div>
      <p className="clock__src"><Badge kind="fixture" /> <SourceChip {...source('statute-cost-share')} /> As summarized; verify before any state-facing claim.</p>
    </section>
  );
}
