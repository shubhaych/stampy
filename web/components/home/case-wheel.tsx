'use client';

import { useEffect, useRef, useState } from 'react';
import { CARD_COUNT, DRIFT_DEG_PER_SEC, SCROLL_DEG_PER_PX, layoutForFrame, poseFor } from './wheel-math';

const KINDS = ['Paystub', 'Lease', 'Utility bill', 'Interview note', 'Match alert'] as const;
const CHIPS = ['Pay frequency', 'Rent mismatch', 'SUA not applied', 'Unworked match'] as const;

/** A1 Case Wheel: an arc fan of document cards that deals in, drifts, drags, and turns a few degrees with scroll. */
export function CaseWheel() {
  const frame = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const drag = useRef<{ x: number; rot: number } | null>(null);
  const userRot = useRef(0);
  const [chipTick, setChipTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setChipTick((t) => t + 1), 2400);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = (now - t0) / 1000;
      const { width, height } = el.getBoundingClientRect();
      const layout = layoutForFrame(width, height);
      const rot = -t * DRIFT_DEG_PER_SEC + userRot.current + window.scrollY * SCROLL_DEG_PER_PX;
      cards.current.forEach((card, i) => {
        if (!card) return;
        const p = poseFor(i, rot, t, layout);
        card.style.width = `${layout.cardW}px`;
        card.style.opacity = p.visible ? String(p.opacity) : '0';
        card.style.zIndex = String(p.z);
        card.style.transform = `translate(-50%, 0) rotate(${p.angle}deg) translateY(-${layout.radius}px) scale(${p.scale})`;
        card.style.top = `${layout.pivotY}px`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, rot: userRot.current };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (drag.current) userRot.current = drag.current.rot + (e.clientX - drag.current.x) * 0.12;
  };
  const onUp = () => (drag.current = null);

  return (
    <div ref={frame} className="case-wheel" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} aria-hidden>
      {Array.from({ length: CARD_COUNT }, (_, i) => {
        const kind = KINDS[i % KINDS.length]!;
        const chip = CHIPS[(i + chipTick) % CHIPS.length]!;
        return (
          <div key={i} ref={(n) => { cards.current[i] = n; }} className="case-wheel__card" style={{ opacity: 0 }}>
            <div className="case-wheel__kind">{kind}</div>
            <div className="case-wheel__lines"><span /><span /><span style={{ width: '60%' }} /><span style={{ width: '80%' }} /></div>
            <div className="case-wheel__chip">{chip}</div>
          </div>
        );
      })}
    </div>
  );
}
