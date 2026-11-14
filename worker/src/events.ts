/** Server-Sent Events bus. Every payload is checked for truth keys and dropped if any are present (hard rule 15). */
import type { ServerEvent } from '@cleancase/contracts';
import { containsTruth } from './core/truth';

type Listener = (e: ServerEvent) => void;
const listeners = new Set<Listener>();
let dropped = 0;

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function publish(e: ServerEvent): boolean {
  if (containsTruth(e)) {
    dropped += 1;
    console.error(`[events] dropped an event containing truth keys (type=${e.type})`);
    return false;
  }
  for (const fn of listeners) fn(e);
  return true;
}

export function droppedCount(): number {
  return dropped;
}
