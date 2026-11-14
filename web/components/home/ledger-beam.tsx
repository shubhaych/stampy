'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { Prov } from '@cleancase/contracts';
import { Fig } from '@/components/ui';

/** A4 Ledger Beam: amber pan (over) left, blue pan (under) right; angle from the normalized difference. */
export function LedgerBeam({ over, under, overLabel, underLabel, prov }: { over: number; under: number; overLabel: string; underLabel: string; prov: Prov }) {
  const reduce = useReducedMotion();
  const total = over + under || 1;
  const angle = ((over - under) / total) * -14;
  return (
    <figure className="beam" aria-label={`Overissuance ${overLabel}, underissuance ${underLabel}`}>
      <svg viewBox="0 0 320 170" className="beam__svg" aria-hidden>
        <path d="M150 160 L160 60 L170 160 Z" fill="var(--ink)" opacity="0.85" />
        <motion.g style={{ originX: '160px', originY: '60px' }} initial={{ rotate: 0 }} whileInView={{ rotate: angle }} viewport={{ once: true }} transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 60, damping: 12 }}>
          <line x1="40" y1="60" x2="280" y2="60" stroke="var(--ink)" strokeWidth="3" />
          <line x1="40" y1="60" x2="40" y2="96" stroke="var(--ink)" />
          <line x1="280" y1="60" x2="280" y2="96" stroke="var(--ink)" />
          <path d="M8 96 Q40 120 72 96 Z" fill="var(--over)" />
          <path d="M248 96 Q280 120 312 96 Z" fill="var(--under)" />
        </motion.g>
        <circle cx="160" cy="60" r="5" fill="var(--ink)" />
      </svg>
      <figcaption className="beam__labels">
        <span className="dir dir--over">↑ over <Fig prov={prov}>{overLabel}</Fig></span>
        <span className="dir dir--under">↓ under <Fig prov={prov}>{underLabel}</Fig></span>
      </figcaption>
    </figure>
  );
}
