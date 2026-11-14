# Voice Verifier

Spec: master prompt section 13. Deepgram Voice Agent behind a `VoiceProvider` interface, Anthropic as the think model, worker-held key, browser gets a short-lived session. Calls write only `call_*` rows; "Add to case file" is a separate human click. Consent recorded before the call button enables (also enforced by the `call_needs_consent` trigger). `VOICE_MODE=fixture` plays the stored GC-1 transcript (`packages/contracts/fixtures/golden.ts`). Event names and the supported think-model list must be verified in Deepgram's docs before coding.
