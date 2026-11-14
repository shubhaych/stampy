import type { ReactNode } from 'react';
import type { Prov } from '@stampy/contracts';
import { Badge } from './badge';
import { SourceChip } from './source-chip';

/**
 * A rendered figure with its badge (and optional source chip). check:badges and the smoke test
 * require every money or percent figure to live inside one of these ([data-figure]).
 */
export function Fig({ children, prov, source, className = '', badgeFirst = false }: { children: ReactNode; prov: Prov; source?: { label: string; href?: string | null }; className?: string; badgeFirst?: boolean }) {
  return (
    <span className={`fig ${className}`} data-figure>
      {badgeFirst ? <Badge kind={prov} /> : null}
      <span className="num">{children}</span>
      {badgeFirst ? null : <Badge kind={prov} />}
      {source ? <SourceChip label={source.label} href={source.href ?? null} /> : null}
    </span>
  );
}
