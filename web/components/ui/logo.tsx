import { useId } from 'react';

/**
 * Stampy mark: a perforated postage stamp with a check cut out of it, tilted like a stamp pressed by hand.
 * The perforations and the check are a mask, so the mark is one solid shape in currentColor on any background.
 */
const EDGE = [8.2, 13.4, 18.6, 23.8];
const HOLES: [number, number][] = [
  ...EDGE.flatMap((v): [number, number][] => [[v, 3], [v, 29], [3, v], [29, v]]),
  [3, 3], [29, 3], [3, 29], [29, 29],
];

export function StampyMark({ size = 22, className = '', title }: { size?: number; className?: string; title?: string }) {
  const id = `stampy-mark-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      <defs>
        <mask id={id}>
          <rect width="32" height="32" fill="#fff" />
          {HOLES.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.55" fill="#000" />)}
          <path d="M11 16.4l3.4 3.4 7-7.4" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </mask>
      </defs>
      <rect x="3" y="3" width="26" height="26" fill="currentColor" mask={`url(#${id})`} transform="rotate(-6 16 16)" />
    </svg>
  );
}
