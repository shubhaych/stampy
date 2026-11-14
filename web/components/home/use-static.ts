'use client';

import { useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';

/**
 * True when the home page should render the static stacked versions of A1 to A6:
 * reduced motion, or a narrow (phone) viewport. Starts true so SSR and first paint are the static, readable version.
 */
export function useHomeStatic(): boolean {
  const reduce = useReducedMotion();
  const [narrow, setNarrow] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 719px)');
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return Boolean(reduce) || narrow;
}
