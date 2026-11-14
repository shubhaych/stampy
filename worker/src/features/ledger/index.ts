/**
 * ledger (machine B). Scaffold stub: route mounted, returns 501 until the feature lands.
 * TODO(ledger): append-only facts, deterministic conflict detector that opens open_question rows.
 */
import type { Feature } from '../types';
import { stubStatus } from '../types';

export const feature: Feature = {
  name: 'ledger',
  register(app) {
    app.get('/ledger/:caseId', (c) => c.json({ status: 'stub', feature: 'ledger' }, 501));
  },
  status(ctx) {
    return null;
  },
};
