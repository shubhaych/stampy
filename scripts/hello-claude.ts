/** npm run hello:claude — one Messages API call with the fast model. Missing key prints UNVERIFIED-LIVE instead of failing. */
import Anthropic from '@anthropic-ai/sdk';
import { envValue } from './lib';

const key = envValue('ANTHROPIC_API_KEY');
if (!key) {
  console.log('UNVERIFIED-LIVE: anthropic: set ANTHROPIC_API_KEY in .env.local, then npm run hello:claude');
  process.exit(0);
}
const model = envValue('ANTHROPIC_MODEL_FAST', 'claude-haiku-5-5');
const client = new Anthropic({ apiKey: key });
const t0 = performance.now();
try {
  const res = await client.messages.create({
    model,
    max_tokens: 256,
    messages: [{ role: 'user', content: 'Reply with exactly: Stampy hello ok' }],
  });
  const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  console.log(`anthropic ok · ${model} · ${Math.round(performance.now() - t0)} ms · stop=${res.stop_reason}`);
  console.log(`text: ${text}`);
  console.log(`usage: in=${res.usage.input_tokens} out=${res.usage.output_tokens}`);
} catch (e) {
  if (e instanceof Anthropic.AuthenticationError) console.error('anthropic: invalid API key');
  else if (e instanceof Anthropic.RateLimitError) console.error('anthropic: rate limited, retry later');
  else if (e instanceof Anthropic.APIError) console.error(`anthropic: API error ${e.status}: ${e.message}`);
  else throw e;
  process.exit(1);
}
