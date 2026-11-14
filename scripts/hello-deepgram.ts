/**
 * npm run hello:deepgram — open a Voice Agent session, send Settings with the Anthropic think provider,
 * print the events received for a few seconds. Event and field names follow master prompt section 13 and
 * must be verified against Deepgram's docs by the voice-engine feature.
 */
import { envValue } from './lib';

const key = envValue('DEEPGRAM_API_KEY');
if (!key) {
  console.log('UNVERIFIED-LIVE: deepgram: set DEEPGRAM_API_KEY in .env.local, then npm run hello:deepgram');
  process.exit(0);
}
const url = envValue('DEEPGRAM_AGENT_URL', 'wss://agent.deepgram.com/v1/agent/converse');
// Node 22 WebSocket (undici) cannot set headers; Deepgram accepts the token subprotocol.
const ws = new WebSocket(url, ['token', key]);
const seen: string[] = [];
ws.addEventListener('open', () => {
  ws.send(JSON.stringify({
    type: 'Settings',
    audio: { input: { encoding: 'linear16', sample_rate: 24000 }, output: { encoding: 'linear16', sample_rate: 24000, container: 'none' } },
    agent: {
      listen: { provider: { type: 'deepgram', model: envValue('DEEPGRAM_LISTEN_MODEL', 'nova-3') } },
      think: { provider: { type: envValue('VOICE_THINK_PROVIDER', 'anthropic'), model: envValue('VOICE_THINK_MODEL', 'claude-haiku-4-5') }, prompt: 'You are a test agent. Say hello in one sentence.' },
      speak: { provider: { type: 'deepgram', model: envValue('DEEPGRAM_SPEAK_MODEL', 'aura-2-thalia-en') } },
      greeting: 'This is an AI assistant test call. Hello.',
    },
  }));
});
ws.addEventListener('message', (m) => {
  if (typeof m.data !== 'string') return;
  const e = JSON.parse(m.data) as { type?: string; role?: string; content?: string; description?: string };
  seen.push(e.type ?? '?');
  console.log(`event ${e.type}${e.content ? `: ${e.role}: ${e.content}` : ''}${e.description ? `: ${e.description}` : ''}`);
});
ws.addEventListener('error', () => console.error('deepgram: websocket error'));
setTimeout(() => {
  ws.close();
  console.log(seen.includes('SettingsApplied') ? 'deepgram ok · SettingsApplied received' : `UNVERIFIED-LIVE: deepgram: no SettingsApplied (saw ${seen.join(', ') || 'nothing'})`);
  process.exit(0);
}, 6000);
