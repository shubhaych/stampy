import { SectionDivider } from '@/components/ui';
import { OpeningScene } from '@/components/home/opening-scene';
import { StatBeats } from '@/components/home/stat-beats';
import { CostShareClock } from '@/components/home/cost-share-clock';
import { AnswerBar } from '@/components/home/answer-bar';
import { HowItWorks } from '@/components/home/how-it-works';
import { MiniDemo } from '@/components/home/mini-demo';
import { VoiceSpotlight } from '@/components/home/voice-spotlight';
import { Closing, Guardrails, MarketProof, PoweredBy, StateStart } from '@/components/home/closing-sections';

export default function HomePage() {
  return (
    <main className="home">
      <OpeningScene />
      <SectionDivider />
      <StatBeats />
      <SectionDivider />
      <CostShareClock />
      <SectionDivider />
      <AnswerBar />
      <SectionDivider />
      <HowItWorks />
      <SectionDivider />
      <MiniDemo />
      <SectionDivider />
      <VoiceSpotlight />
      <SectionDivider />
      <Guardrails />
      <SectionDivider />
      <MarketProof />
      <SectionDivider />
      <StateStart />
      <SectionDivider />
      <PoweredBy />
      <Closing />
    </main>
  );
}
