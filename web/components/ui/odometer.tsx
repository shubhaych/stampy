'use client';

import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'motion/react';

/** Digit-roll number (450 ms per digit, capped). aria-live polite. Reduced motion jumps straight to the value. */
export function Odometer({ value, format = (n: number) => Math.round(n).toLocaleString('en-US'), className = '' }: { value: number; format?: (n: number) => string; className?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) {
      setShown(value);
      from.current = value;
      return;
    }
    const digits = String(Math.round(Math.abs(value))).length;
    const ctrl = animate(from.current, value, { duration: Math.min(0.45 * digits, 1.8), ease: [0.2, 0.7, 0.2, 1], onUpdate: setShown });
    from.current = value;
    return () => ctrl.stop();
  }, [value, reduce]);
  return (
    <span className={`num ${className}`} aria-live="polite">
      {format(shown)}
    </span>
  );
}
