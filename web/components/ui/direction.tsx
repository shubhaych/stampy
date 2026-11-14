import type { Direction as Dir } from '@cleancase/contracts';

/** Amber and blue are never the only signal: always an arrow glyph and the word. */
export function Direction({ dir, long = false }: { dir: Dir; long?: boolean }) {
  if (dir === 'over') return <span className="dir dir--over">↑ {long ? 'overissuance risk' : 'over'}</span>;
  if (dir === 'under') return <span className="dir dir--under">↓ {long ? 'underissuance risk' : 'under'}</span>;
  return <span className="dir dir--none">· {long ? 'no dollar direction' : 'question'}</span>;
}
