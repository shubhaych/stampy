import type { StateProfile } from '@stampy/contracts';
import { FIXTURE_QUEUE, FIXTURE_SYSTEM_STATUS, GOLDEN_BUNDLES, GOLDEN_DEBRIEFS } from '@stampy/contracts/fixtures';
import statesFile from '../../../data/states.json';
import type { DataSource } from './index';

const states = (statesFile as { states: StateProfile[] }).states;

export const fixtureSource: DataSource = {
  kind: 'fixture',
  async states() {
    return states;
  },
  async startShift(state, seed = 7) {
    return { id: `SHIFT-${state}-${seed}`, state, seed, caseIds: FIXTURE_QUEUE.map((q) => q.caseId), createdAt: new Date().toISOString(), prov: 'fixture' };
  },
  async queue() {
    return FIXTURE_QUEUE;
  },
  async caseBundle(id) {
    return GOLDEN_BUNDLES.find((b) => b.case.id === id) ?? null;
  },
  async debrief(id) {
    return GOLDEN_DEBRIEFS.find((d) => d.caseId === id) ?? null;
  },
  async status() {
    return FIXTURE_SYSTEM_STATUS;
  },
  subscribe() {
    return () => {};
  },
};
