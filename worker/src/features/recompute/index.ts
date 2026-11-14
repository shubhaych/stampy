/**
 * seats (machine B). Scaffold stub: route mounted, returns 501 until the feature lands.
 * TODO(seats): snap-rules recompute from accepted facts only; PolicyEngine-US cross-check when POLICYENGINE_MODE=api.
 */
import type { Feature } from '../types';
import { stubStatus } from '../types';

export const feature: Feature = {
  name: 'recompute',
  register(app) {
    app.post('/recompute', (c) => c.json({ status: 'stub', feature: 'recompute' }, 501));
  },
  status(ctx) {
    return stubStatus('policyengine', ctx.env.POLICYENGINE_MODE === 'api' ? 'live' : 'off', 'optional cross-check');
  },
};
