import { SectionDivider, TextCta } from '@/components/ui';
import { ROUTES } from '@/lib/routes';
import { Hero } from '@/components/home/hero';
import { ProblemScroll } from '@/components/home/problem-scroll';
import { PipelineDiagram } from '@/components/home/pipeline-diagram';
import { SmoothScroll } from '@/components/home/smooth-scroll';

export default function HomePage() {
  return (
    <main className="home">
      <SmoothScroll />
      <Hero />
      <ProblemScroll />
      <SectionDivider />
      <PipelineDiagram />
      <section className="closing wrap" aria-labelledby="closing-title">
        <h2 id="closing-title" className="font-display h-section">See the records behind this.</h2>
        <TextCta href={ROUTES.data}>Open the data →</TextCta>
      </section>
    </main>
  );
}
