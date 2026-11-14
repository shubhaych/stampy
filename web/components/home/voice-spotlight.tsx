'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { GC1_BUNDLE } from '@cleancase/contracts/fixtures';
import { Badge, HudFrame } from '@/components/ui';

const GUARDRAILS = [
  'Says it is an AI assistant calling for the agency, and offers a person',
  'Records household consent before any call',
  'A worker can take over at any moment',
  'Never accuses, negotiates, or shares benefit details',
];

function Wave({ color, active }: { color: string; active: boolean }) {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 120 24" className="wave" aria-hidden>
      {Array.from({ length: 24 }, (_, k) => (
        <motion.rect key={k} x={k * 5} width="3" rx="1.5" fill={color}
          animate={active && !reduce ? { height: [4, 6 + ((k * 7) % 16), 4], y: [10, 12 - ((k * 7) % 16) / 2, 10] } : { height: 4, y: 10 }}
          transition={{ duration: 0.6 + (k % 5) * 0.08, repeat: Infinity }} />
      ))}
    </svg>
  );
}

/** Section 7, A8 Voice Bloom (looping, scripted from the GC-1 fixture call). Badge Synthetic. */
export function VoiceSpotlight() {
  const turns = GC1_BUNDLE.callTurns;
  const facts = GC1_BUNDLE.callFacts;
  const [n, setN] = useState(1);
  useEffect(() => {
    const id = window.setTimeout(() => setN((x) => (x >= turns.length + 2 ? 1 : x + 1)), n > turns.length ? 3000 : 1600);
    return () => window.clearTimeout(id);
  }, [n, turns.length]);
  const shown = turns.slice(0, n);
  const speaker = shown[shown.length - 1]?.speaker;
  const landed = facts.filter((f) => f.turnIds.every((t) => shown.some((s) => s.id === t)));

  return (
    <section className="voice wrap" aria-labelledby="voice-title">
      <div className="eyebrow">Voice Verifier</div>
      <h2 id="voice-title" className="font-display h-section">When the document can&apos;t answer, CleanCase makes the call.</h2>
      <div className="voice__grid">
        <HudFrame label="Employer call · simulated" right={<Badge kind="synthetic" />}>
          <div className="voice__waves">
            <div><span className="eyebrow">AI assistant</span><Wave color="var(--glow)" active={speaker === 'agent'} /></div>
            <div><span className="eyebrow">Employer</span><Wave color="var(--over)" active={speaker === 'counterpart'} /></div>
          </div>
          <ol className="voice__transcript" aria-live="polite">
            {shown.map((t) => (
              <motion.li key={t.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`voice__turn voice__turn--${t.speaker}`}>
                <span className="num voice__ts">0:{String(Math.floor(t.tStart)).padStart(2, '0')}</span> {t.text}
              </motion.li>
            ))}
          </ol>
          <div className="voice__chips">
            {landed.map((f) => (
              <motion.span key={f.id} layout initial={{ opacity: 0, scale: 0.9, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="voice__chip">
                {f.field.replace(/_/g, ' ')}: {f.field === 'pay_frequency' ? f.value : 'confirmed'} · verified by employer, 0:{String(Math.floor(f.tStart)).padStart(2, '0')} · pending worker accept
              </motion.span>
            ))}
          </div>
        </HudFrame>
        <ul className="voice__rails">
          {GUARDRAILS.map((g) => <li key={g}>{g}</li>)}
        </ul>
      </div>
    </section>
  );
}
