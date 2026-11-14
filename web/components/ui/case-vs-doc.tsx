import type { ReactNode } from 'react';
import type { BBox, Prov } from '@stampy/contracts';
import { Fig } from './fig';

/** "Case file vs Document": budgeted value beside the value read from the document, with its crop and bbox. */
export function CaseVsDoc({ caseLabel = 'Budgeted in case file', caseValue, docLabel = 'Read from document', docValue, crop, bbox, prov, foot = 'AI flag, worker decides' }: {
  caseLabel?: string; caseValue: ReactNode; docLabel?: string; docValue: ReactNode; crop?: ReactNode; bbox?: BBox; prov: Prov; foot?: string;
}) {
  return (
    <div className="case-vs-doc">
      <div className="case-vs-doc__col">
        <span className="case-vs-doc__label">{caseLabel}</span>
        <span className="case-vs-doc__value"><Fig prov={prov}>{caseValue}</Fig></span>
      </div>
      <div className="case-vs-doc__col">
        <span className="case-vs-doc__label">{docLabel}</span>
        <span className="case-vs-doc__value"><Fig prov={prov}>{docValue}</Fig></span>
        {crop ? (
          <div className="case-vs-doc__crop">
            {crop}
            {bbox ? (
              <span
                className="case-vs-doc__bbox"
                style={{ left: `${bbox.x * 100}%`, top: `${bbox.y * 100}%`, width: `${bbox.w * 100}%`, height: `${bbox.h * 100}%` }}
                aria-hidden
              />
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="case-vs-doc__foot">{foot}</div>
    </div>
  );
}
