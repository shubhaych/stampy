import type { Hono } from 'hono';
import type Database from 'better-sqlite3';
import type { IntegrationStatus } from '@cleancase/contracts';
import type { Env } from '../env';

export interface FeatureContext {
  db: Database.Database;
  env: Env;
}

/** Every feature folder exports one of these from its index.ts. Features never import each other. */
export interface Feature {
  name: string;
  register(app: Hono, ctx: FeatureContext): void;
  /** Integration status for /status, or null if the feature has no external integration. */
  status(ctx: FeatureContext): IntegrationStatus | IntegrationStatus[] | null;
}

export function stubStatus(name: string, mode: IntegrationStatus['mode'], note: string, dailyLimit: number | null = null): IntegrationStatus {
  return { name, mode, available: mode !== 'off', lastRunAt: null, lastMs: null, runCount: 0, dailyLimit, badge: mode === 'live' ? 'live' : 'fixture', note };
}
