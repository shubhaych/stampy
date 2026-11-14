/**
 * Identities and segregation of duties (master prompt 0.2 and 14). Enforced in the service layer.
 * - Only a human role (worker, supervisor) may accept a flag or fact, approve outreach, override, or certify.
 * - Review requires a supervisor whose identity differs from the certifier.
 * - The `ai` identity may only append AI rows and drafts; it can never call a human function.
 */
export type Role = 'worker' | 'supervisor' | 'ai' | 'system';

export interface Identity {
  id: string;
  role: Role;
}

export const AI: Identity = { id: 'ai', role: 'ai' };
export const SYSTEM: Identity = { id: 'system', role: 'system' };

export const HUMAN_ACTIONS = [
  'flag.accept', 'flag.dismiss', 'flag.question',
  'fact.accept', 'fact.reject',
  'outreach.approve', 'consent.record',
  'gate.override', 'change.approve', 'change.reject',
  'case.certify', 'case.review', 'call.takeover',
  'control.set',
] as const;
export type HumanAction = (typeof HUMAN_ACTIONS)[number];

/** Tables the AI identity may append to. */
export const AI_APPEND_TABLES = [
  'fact', 'extraction', 'flag', 'citation', 'agent_run', 'resolution_plan',
  'outreach_draft', 'call', 'call_turn', 'call_fact', 'call_event', 'open_question_text',
] as const;
export type AiAppendTable = (typeof AI_APPEND_TABLES)[number];

export class AuthzError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthzError';
  }
}

export function isHuman(who: Identity): boolean {
  return who.role === 'worker' || who.role === 'supervisor';
}

export function can(who: Identity, action: HumanAction): boolean {
  if (!isHuman(who)) return false;
  if (action === 'case.review' || action === 'control.set') return who.role === 'supervisor';
  return true;
}

export function assertCan(who: Identity, action: HumanAction): void {
  if (!can(who, action)) throw new AuthzError(`${who.role}:${who.id} may not ${action}`);
}

export function assertAiAppend(who: Identity, table: string): void {
  if (who.role === 'ai' || who.role === 'system') {
    if (!(AI_APPEND_TABLES as readonly string[]).includes(table)) throw new AuthzError(`${who.role} may not write ${table}`);
    return;
  }
  if (!isHuman(who)) throw new AuthzError(`unknown identity ${who.id}`);
}

/** Second-party review: a supervisor, and not the person who certified. */
export function assertReview(reviewer: Identity, certifierId: string): void {
  assertCan(reviewer, 'case.review');
  if (reviewer.id === certifierId) throw new AuthzError('review requires a different identity than the certifier');
}

/** Resolve a browser identity from the demo access codes. Never returns `ai`. */
export function identityFromCode(code: string | undefined, name: string, env: { DEMO_WORKER_CODE: string; DEMO_SUPERVISOR_CODE: string }): Identity | null {
  if (!code) return null;
  if (code === env.DEMO_SUPERVISOR_CODE) return { id: `supervisor:${name}`, role: 'supervisor' };
  if (code === env.DEMO_WORKER_CODE) return { id: `worker:${name}`, role: 'worker' };
  return null;
}
