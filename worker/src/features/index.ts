/**
 * FROZEN after scaffold-v1. Pre-lists every feature so nobody adds lines here later.
 * A feature fills in its own folder; it mounts its routes in register(app).
 */
import type { Feature } from './types';
import { feature as qc } from './qc/index';
import { feature as docgen } from './docgen/index';
import { feature as ledger } from './ledger/index';
import { feature as planner } from './planner/index';
import { feature as seats } from './seats/index';
import { feature as recompute } from './recompute/index';
import { feature as policy } from './policy/index';
import { feature as voice } from './voice/index';
import { feature as evaluation } from './eval/index';

export const FEATURES: readonly Feature[] = [qc, docgen, ledger, planner, seats, recompute, policy, voice, evaluation];
export type { Feature, FeatureContext } from './types';
