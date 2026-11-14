'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';
import { useReducedMotion } from 'motion/react';

/** Reading pause at each beat (was 520 ms; shortened 40%). */
const HOLD_MS = 312;

/**
 * Home-only smooth scrolling (Lenis) with reading holds: when the page centre crosses an element marked
 * [data-scroll-hold], scrolling pauses briefly, so each beat lands before the next one starts.
 * Off for reduced motion and touch-first phones (native scroll there).
 */
export function SmoothScroll() {
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce || window.matchMedia('(max-width: 719px), (pointer: coarse)').matches) return;
    const lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    let raf = 0;
    const loop = (t: number) => {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    let lastY = window.scrollY;
    let holding = false;
    const done = new Set<Element>();
    const onScroll = ({ scroll }: { scroll: number }) => {
      if (holding) return;
      const mid = window.innerHeight / 2;
      for (const el of document.querySelectorAll('[data-scroll-hold]')) {
        const top = el.getBoundingClientRect().top + scroll;
        const crossedDown = lastY + mid < top && scroll + mid >= top;
        const crossedUp = lastY + mid > top && scroll + mid <= top;
        if ((crossedDown || crossedUp) && !done.has(el)) {
          done.add(el);
          window.setTimeout(() => done.delete(el), 1200);
          holding = true;
          lenis.stop();
          window.setTimeout(() => {
            lenis.start();
            holding = false;
          }, HOLD_MS);
          break;
        }
      }
      lastY = scroll;
    };
    lenis.on('scroll', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, [reduce]);
  return null;
}
