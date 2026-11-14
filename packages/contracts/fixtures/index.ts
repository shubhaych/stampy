/** Fixture data for NEXT_PUBLIC_DATA=fixture and worker fixture mode. Badge: Fixture. */
import type { QueueItem, SystemStatus, CaseBundle } from '../src/index';
import { GOLDEN_BUNDLES, GOLDEN_DEBRIEFS, GC1_BUNDLE, GC1_WORKED_BUNDLE, GC2_BUNDLE, GC3_BUNDLE, GC4_BUNDLE } from './golden';

export { GOLDEN_BUNDLES, GOLDEN_DEBRIEFS, GC1_BUNDLE, GC1_WORKED_BUNDLE, GC2_BUNDLE, GC3_BUNDLE, GC4_BUNDLE };

export const FIXTURE_QUEUE: QueueItem[] = GOLDEN_BUNDLES.map((b: CaseBundle, i) => ({
  caseId: b.case.id,
  qcId: b.case.qcId,
  state: b.case.state,
  householdSize: b.case.householdSize,
  filedAt: b.case.filedAt,
  dayOfThirty: [11, 8, 13, 6][i] ?? 1,
  expeditedDaysLeft: null,
  docsReady: b.docs.length,
  openFlags: b.flags.filter((f) => f.status === 'open').length,
  status: 'new',
  prov: 'fixture',
}));

export const FIXTURE_SYSTEM_STATUS: SystemStatus = {
  integrations: [
    { name: 'anthropic', mode: 'fixture', available: true, lastRunAt: null, lastMs: null, runCount: 0, dailyLimit: 60, badge: 'fixture', note: 'Claude roles answer from worker/fixtures/seats' },
    { name: 'moss', mode: 'local', available: true, lastRunAt: null, lastMs: null, runCount: 0, dailyLimit: null, badge: 'fixture', note: 'local BM25 fallback' },
    { name: 'sqlite', mode: 'fixture', available: true, lastRunAt: null, lastMs: null, runCount: 0, dailyLimit: null, badge: 'fixture', note: 'qc_history loaded from data/golden until the QC file is ingested' },
    { name: 'deepgram', mode: 'fixture', available: true, lastRunAt: null, lastMs: null, runCount: 0, dailyLimit: 6, badge: 'fixture', note: 'stored transcript playback' },
    { name: 'policyengine', mode: 'off', available: false, lastRunAt: null, lastMs: null, runCount: 0, dailyLimit: null, badge: 'fixture', note: 'cross-check off' },
    { name: 'messaging', mode: 'fixture', available: true, lastRunAt: null, lastMs: null, runCount: 0, dailyLimit: 20, badge: 'fixture', note: 'messages shown, not sent' },
    { name: 'email', mode: 'fixture', available: true, lastRunAt: null, lastMs: null, runCount: 0, dailyLimit: 20, badge: 'fixture', note: 'recorded as sent-simulated' },
  ],
  control: { aiEnabled: true, mossEnabled: true, voiceEnabled: true },
  unverifiedLive: ['qc-file', 'anthropic', 'moss', 'deepgram', 'policyengine'],
  recomputeMatchRate: null,
};
