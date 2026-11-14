import { Badge, DeckPage, HudFrame } from '@/components/ui';

export const metadata = { title: 'Answer a call' };

/** Counterpart page for VOICE_COUNTERPART=human (voice-ui): a teammate answers as the employer or landlord. */
export default async function VoiceAnswerPage(props: PageProps<'/voice/answer/[callId]'>) {
  const { callId } = await props.params;
  return (
    <DeckPage eyebrow={`Call ${callId}`} title="You are the employer" prov="synthetic">
      <HudFrame label="Counterpart" right={<Badge kind="synthetic" />}>
        <p className="m-0 text-sm opacity-80">When the worker starts the call, the AI assistant will introduce itself and ask a few questions. Answer as the employer or landlord would. Say “I can’t share that” to test a refusal, or ask for a person to test the takeover.</p>
        <button type="button" className="btn btn--primary mt-4" disabled>Waiting for the call…</button>
      </HudFrame>
    </DeckPage>
  );
}
