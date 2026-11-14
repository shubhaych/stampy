'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { Prov } from '@cleancase/contracts';
import { Fig } from '@/components/ui';

/** A4 Ledger Beam: peach pan (over) left, blue pan (under) right; angle from the normalized difference. */
export function LedgerBeam({ over, under, overLabel, underLabel, prov, plain = false, large = false }: {
  over: number; under: number; overLabel: string; underLabel: string; prov?: Prov; plain?: boolean; large?: boolean;
}) {
  const reduce = useReducedMotion();
  const total = over + under || 1;
  const angle = ((over - under) / total) * -14;
  const label = (text: string) => (plain || !prov ? <span className="num">{text}</span> : <Fig prov={prov}>{text}</Fig>);
  return (
    <figure className={`beam ${large ? 'beam--large' : ''}`} aria-label={`Overissuance ${overLabel}, underissuance ${underLabel}`}>
      <svg viewBox="0 0 320 170" className="beam__svg" aria-hidden>
        <path d="M150 160 L160 60 L170 160 Z" className="beam__post" />
        <motion.g style={{ transformBox: 'view-box', originX: 0.5, originY: 60 / 170 }} initial={{ rotate: 0 }} whileInView={{ rotate: angle }} viewport={{ once: true }} transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 60, damping: 12, delay: 0.3 }}>
          <line x1="40" y1="60" x2="280" y2="60" className="beam__bar" />
          <line x1="40" y1="60" x2="40" y2="96" className="beam__string" />
          <line x1="280" y1="60" x2="280" y2="96" className="beam__string" />
          <path d="M8 96 Q40 122 72 96 Z" fill="var(--over)" />
          <path d="M248 96 Q280 122 312 96 Z" fill="var(--under)" />
        </motion.g>
        <circle cx="160" cy="60" r="5" className="beam__pin" />
      </svg>
      <figcaption className="beam__labels">
        <span className="dir dir--over">↑ {label(overLabel)}</span>
        <span className="dir dir--under">↓ {label(underLabel)}</span>
      </figcaption>
    </figure>
  );
}
