/** In-process Server-Sent Events bus. Events carry ids only; pages refetch the case bundle. */
import type { StampyEvent } from '@stampy/contracts/stampy';

type Listener = (e: StampyEvent) => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function publishCase(caseId: string, action: string): void {
  const e: StampyEvent = { type: 'case.updated', caseId, action, at: new Date().toISOString() };
  for (const fn of listeners) fn(e);
}
