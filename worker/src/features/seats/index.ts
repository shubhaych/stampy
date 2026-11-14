/**
 * seats (machine B). Scaffold stub: route mounted, returns 501 until the feature lands.
 * TODO(seats): generic Claude role runner, prompts/<role>.md, zod validation with one repair retry, fail closed to needs_human.
 */
import type { Feature } from '../types';
import { stubStatus } from '../types';

export const feature: Feature = {
  name: 'seats',
  register(app) {
    app.post('/seats/run', (c) => c.json({ status: 'stub', feature: 'seats' }, 501));
  },
  status(ctx) {
    return stubStatus('anthropic', ctx.env.AI_MODE === 'live' && ctx.env.ANTHROPIC_API_KEY ? 'live' : 'fixture', 'Claude roles', ctx.env.AI_DAILY_RUN_LIMIT);
  },
};
