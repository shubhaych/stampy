import { randomBytes, randomInt } from 'node:crypto';

/** Short unique ids with a readable prefix: F-k3j9x2..., Q-..., DOC-... */
export function id(prefix: string): string {
  return `${prefix}-${randomBytes(6).toString('base64url').replace(/[-_]/g, 'x')}`;
}

/** Six digits, no leading zero: easy to read aloud on a call. */
export function refCode(): string {
  return String(randomInt(100000, 1000000));
}
