'use client';

import { TextCta } from '@/components/ui';
import { ROUTES } from '@/lib/routes';
import { CaseWheel } from './case-wheel';
import { useHomeStatic } from './use-static';

/** Section 1: the original hero. Case Wheel (A1) fans over the copy; static on phones and reduced motion. */
export function Hero() {
  const isStatic = useHomeStatic();
  return (
    <section className="hero" aria-label="Stampy">
      {isStatic ? null : <CaseWheel />}
      <div className="hero__copy wrap">
        <div className="eyebrow hero__eyebrow">This is Stampy</div>
        <h1 className="font-display h-hero hero__title">The pre-issuance accuracy checker for SNAP.</h1>
        <p className="hero__sub">
          Stampy checks the case before the benefit goes out. It reads the case file, flags what doesn&apos;t match with the exact source line and the rule behind it, and recomputes the benefit. A merit-staff worker makes every decision.
        </p>
        <div className="hero__ctas">
          <TextCta href={ROUTES.cases}>Work a case →</TextCta>
          <a href="#problem" className="hero__secondary">See the issue</a>
        </div>
        <p className="eyebrow hero__mono">Every dollar right, in both directions · We never deny · We never auto-correct</p>
      </div>
    </section>
  );
}
