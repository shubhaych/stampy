'use client';

import { TextCta } from '@/components/ui';
import { CaseWheel } from './case-wheel';
import { useHomeStatic } from './use-static';

/** Section 1: the original hero. Case Wheel (A1) fans over the copy; static on phones and reduced motion. */
export function Hero() {
  const isStatic = useHomeStatic();
  return (
    <section className="hero" aria-label="Stampy">
      {isStatic ? null : <CaseWheel />}
      <div className="hero__copy wrap">
        <div className="eyebrow hero__eyebrow">Stampy · Pre-issuance accuracy for SNAP</div>
        <h1 className="font-display h-hero hero__title">Check the case before the benefit goes out.</h1>
        <p className="hero__sub">
          Stampy reads the case file, flags what doesn&apos;t match with the exact source line and the rule behind it, and recomputes the benefit. A merit-staff worker makes every decision.
        </p>
        <div className="hero__ctas">
          <TextCta href="/demo">Work a case →</TextCta>
          <a href="#problem" className="hero__secondary">See the issue</a>
        </div>
        <p className="eyebrow hero__mono">Every dollar right, in both directions · We never deny · We never auto-correct</p>
      </div>
    </section>
  );
}
