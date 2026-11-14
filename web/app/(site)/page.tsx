import { SectionDivider, TextCta } from '@/components/ui';
import { ROUTES } from '@/lib/routes';
import { Hero } from '@/components/home/hero';
import { ProblemScroll } from '@/components/home/problem-scroll';
import { CaseWalkthrough } from '@/components/home/case-walkthrough';
import { BackendLedger } from '@/components/home/backend-ledger';
import { SmoothScroll } from '@/components/home/smooth-scroll';

export default function HomePage() {
  return (
    <main className="home">
      <SmoothScroll />
      <Hero />
      <ProblemScroll />
      <SectionDivider />
      <CaseWalkthrough />
      <SectionDivider />
      <BackendLedger />
      <section className="closing wrap" aria-labelledby="closing-title">
        <h2 id="closing-title" className="font-display h-section">Work a case yourself.</h2>
        <TextCta href={ROUTES.apply}>Start the demo →</TextCta>
      </section>
    </main>
  );
}
