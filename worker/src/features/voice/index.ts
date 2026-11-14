/**
 * voice-engine (machine B). Scaffold stub: route mounted, returns 501 until the feature lands.
 * TODO(voice-engine): Deepgram Voice Agent behind VoiceProvider, Anthropic think model, sim/human/pstn counterparts, call_* rows only.
 */
import type { Feature } from '../types';
import { stubStatus } from '../types';

export const feature: Feature = {
  name: 'voice',
  register(app) {
    app.post('/voice/session', (c) => c.json({ status: 'stub', feature: 'voice' }, 501));
  },
  status(ctx) {
    return stubStatus('deepgram', ctx.env.VOICE_MODE === 'live' && ctx.env.DEEPGRAM_API_KEY ? 'live' : 'fixture', 'voice verifier', ctx.env.VOICE_DAILY_CALL_LIMIT);
  },
};
