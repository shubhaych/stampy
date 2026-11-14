'use client';

import type { StationId, StepState } from '@stampy/contracts';
import { STATIONS } from '@stampy/snap-rules';

/** Ten stations, freely navigable. Skipped stations are tracked, never forced. */
export function StationRail({ steps, current, onSelect }: { steps: StepState[]; current: StationId; onSelect?: (id: StationId) => void }) {
  return (
    <ol className="station-rail" aria-label="Stations">
      {STATIONS.map((s) => {
        const st = steps.find((x) => x.station === s.id)?.status ?? 'pending';
        return (
          <li key={s.id}>
            <button
              type="button"
              className="station-rail__item"
              aria-current={current === s.id ? 'step' : undefined}
              onClick={() => onSelect?.(s.id)}
              data-station={s.id}
              data-status={st}
            >
              <span className={`station-rail__bead station-rail__bead--${st}`} aria-hidden />
              <span className="station-rail__num">{s.id}</span>
              <span>{s.short}</span>
              <span className="sr-only">({st.replace('_', ' ')})</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
