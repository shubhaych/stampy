import type { ReactNode } from 'react';
import type { Prov } from '@stampy/contracts';
import { Badge } from './badge';

/** Work-page shell: switches the body to the dark deck (body:has(.app-dark)). */
export function DeckPage({ children, title, eyebrow, prov, right }: { children: ReactNode; title?: ReactNode; eyebrow?: string; prov?: Prov; right?: ReactNode }) {
  return (
    <main className="app-dark deck-page">
      <div className="wrap" style={{ maxWidth: 1280 }}>
        {title || eyebrow ? (
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              {eyebrow ? (
                <div className="eyebrow mb-2 flex items-center gap-2 opacity-70">
                  {eyebrow} {prov ? <Badge kind={prov} /> : null}
                </div>
              ) : null}
              {title ? <h1 className="font-display h-section m-0">{title}</h1> : null}
            </div>
            {right}
          </div>
        ) : null}
        {children}
      </div>
    </main>
  );
}
