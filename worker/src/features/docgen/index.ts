/**
 * qc-data (machine B). Scaffold stub: route mounted, returns 501 until the feature lands.
 * TODO(qc-data): seeded synthetic paystub, lease and bill PNGs with exact bbox sidecars. Badge: Synthetic.
 */
import type { Feature } from '../types';
import { stubStatus } from '../types';

export const feature: Feature = {
  name: 'docgen',
  register(app) {
    app.get('/docs/:id', (c) => c.json({ status: 'stub', feature: 'docgen' }, 501));
  },
  status(ctx) {
    return null;
  },
};
