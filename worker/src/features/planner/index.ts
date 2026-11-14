/**
 * planner (machine B). Scaffold stub: route mounted, returns 501 until the feature lands.
 * TODO(planner): resolution_planner role (fixture first), outreach drafts, worker approval, Messenger/Emailer adapters.
 */
import type { Feature } from '../types';
import { stubStatus } from '../types';

export const feature: Feature = {
  name: 'planner',
  register(app) {
    app.post('/planner/plan', (c) => c.json({ status: 'stub', feature: 'planner' }, 501));
  },
  status(ctx) {
    return [stubStatus('messaging', ctx.env.MESSAGING_PROVIDER === 'fixture' ? 'fixture' : 'live', 'messages shown, not sent', ctx.env.OUTREACH_DAILY_LIMIT), stubStatus('email', ctx.env.EMAIL_PROVIDER === 'fixture' ? 'fixture' : 'live', 'recorded as sent-simulated', ctx.env.OUTREACH_DAILY_LIMIT)];
  },
};
