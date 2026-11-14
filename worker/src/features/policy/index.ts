/**
 * policy (machine B). Scaffold stub: route mounted, returns 501 until the feature lands.
 * TODO(policy): PolicySearch over fetched data/policy text; Moss live, local BM25 fallback; show ms on every citation.
 */
import type { Feature } from '../types';
import { stubStatus } from '../types';

export const feature: Feature = {
  name: 'policy',
  register(app) {
    app.get('/policy/search', (c) => c.json({ status: 'stub', feature: 'policy' }, 501));
  },
  status(ctx) {
    return stubStatus('moss', ctx.env.MOSS_MODE === 'live' && ctx.env.MOSS_PROJECT_KEY ? 'live' : 'local', 'policy retrieval');
  },
};
