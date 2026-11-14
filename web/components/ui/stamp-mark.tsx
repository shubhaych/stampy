'use client';

import { useId } from 'react';
import { motion, useReducedMotion } from 'motion/react';

/** A3 The Stamp: scale 1.6 → 1, rotate -8° → -4°, 280 ms spring, ink bleed. Reduced motion: fade only. */
export function StampMark({ label = 'Reviewed · Merit staff', tone = 'pine', play = true }: { label?: string; tone?: 'pine' | 'conflict'; play?: boolean }) {
  const reduce = useReducedMotion();
  const fid = `stamp-ink-${useId().replace(/:/g, '')}`;
  const initial = reduce ? { opacity: 0 } : { opacity: 0, scale: 1.6, rotate: -8 };
  const target = reduce ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: -4 };
  return (
    <motion.span
      className={`stamp-mark ${tone === 'pine' ? 'stamp-mark--pine' : ''}`}
      initial={initial}
      animate={play ? target : initial}
      transition={reduce ? { duration: 0.2 } : { type: 'spring', stiffness: 520, damping: 22 }}
      style={{ filter: `url(#${fid})` }}
    >
      {label}
      <svg width="0" height="0" aria-hidden style={{ position: 'absolute' }}>
        <filter id={fid}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" />
        </filter>
      </svg>
    </motion.span>
  );
}
