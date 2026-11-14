/**
 * The one data interface the web app uses (master prompt 5.7). The web app never opens the database.
 * NEXT_PUBLIC_DATA=fixture reads packages/contracts/fixtures; live talks to the worker over REST + SSE.
 * Both return the same contract types, so features build against fixtures and flip to live unchanged.
 */
import type { CaseBundle, Debrief, QueueItem, ServerEvent, Shift, StateProfile, SystemStatus } from '@stampy/contracts';
import { fixtureSource } from './fixture';
import { liveSource } from './live';

export interface DataSource {
  kind: 'fixture' | 'live';
  states(): Promise<StateProfile[]>;
  startShift(state: string, seed?: number): Promise<Shift>;
  queue(): Promise<QueueItem[]>;
  caseBundle(id: string): Promise<CaseBundle | null>;
  /** Only resolves after the worker has certified the case (truth is server-only until then). */
  debrief(id: string): Promise<Debrief | null>;
  status(): Promise<SystemStatus>;
  /** SSE subscription. Returns an unsubscribe function. Fixture mode never emits. */
  subscribe(onEvent: (e: ServerEvent) => void): () => void;
}

export const DATA_MODE: 'fixture' | 'live' = process.env.NEXT_PUBLIC_DATA === 'live' ? 'live' : 'fixture';

export const data: DataSource = DATA_MODE === 'live' ? liveSource : fixtureSource;
