/**
 * eval (machine B). Scaffold stub: route mounted, returns 501 until the feature lands.
 * TODO(eval): replay evaluation and the recompute match rate (gate G3), reported as measured.
 */
import type { Feature } from '../types';
import { stubStatus } from '../types';

export const feature: Feature = {
  name: 'eval',
  register(app) {
    app.post('/eval/run', (c) => c.json({ status: 'stub', feature: 'eval' }, 501));
  },
  status(ctx) {
    return null;
  },
};
