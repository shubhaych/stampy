import type { Prov } from '@stampy/contracts';

/** Hard rule 8: every number on screen sits next to one of these. */
export const BADGE_LABEL: Record<Prov, string> = { live: 'Live', replay: 'Replay', synthetic: 'Synthetic', fixture: 'Fixture', sandbox: 'Sandbox' };

export const BADGE_TITLE: Record<Prov, string> = {
  live: 'Computed now from database rows or a real API run',
  replay: 'From the USDA SNAP QC public-use file',
  synthetic: 'A document or call generated from a QC record or a persona',
  fixture: 'Recorded or hand-written test data',
  sandbox: 'Vendor sandbox, not production',
};

export function Badge({ kind, className = '' }: { kind: Prov; className?: string }) {
  return (
    <span className={`badge badge--${kind} ${className}`} title={BADGE_TITLE[kind]} data-prov={kind}>
      {BADGE_LABEL[kind]}
    </span>
  );
}
