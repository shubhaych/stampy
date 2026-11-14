'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { StateProfile } from '@cleancase/contracts';
import { Badge, Btn, Fig, HudFrame } from '@/components/ui';
import { data } from '@/lib/data';
import { ROUTES } from '@/lib/routes';
import { pct } from '@/lib/format';

const BANDS = [
  { label: 'under 6%', max: 6 },
  { label: '6 to 7.99', max: 8 },
  { label: '8 to 9.99', max: 10 },
  { label: '10 to 13.33', max: 13.34 },
  { label: 'above 13.34', max: Infinity },
];

function band(per: number | null): number | null {
  if (per === null) return null;
  return BANDS.findIndex((b) => per < b.max);
}

/** Scaffold of A11 Tile Ripple + the state profile. demo-shell refines the ripple and hover lift. */
export function StateSelect({ states }: { states: StateProfile[] }) {
  const router = useRouter();
  const [code, setCode] = useState('CA');
  const [busy, setBusy] = useState(false);
  const sel = useMemo(() => states.find((s) => s.code === code) ?? states[0]!, [states, code]);

  async function start() {
    setBusy(true);
    await data.startShift(sel.code);
    router.push(ROUTES.queue);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section className="panel" aria-label="Choose a state">
        <h2 className="panel__title">
          FY2025 payment error rate by state <Badge kind={sel.prov} />
        </h2>
        <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(11, minmax(0, 1fr))' }} role="listbox" aria-label="States">
          {states.map((s) => {
            const b = band(s.perFy2025);
            return (
              <button
                key={s.code}
                type="button"
                role="option"
                aria-selected={s.code === code}
                onClick={() => setCode(s.code)}
                disabled={s.code !== 'CA'}
                className="aspect-square rounded-md font-mono text-[0.68rem] transition-transform hover:-translate-y-0.5"
                style={{
                  gridColumn: s.col + 1,
                  gridRow: s.row + 1,
                  background: b === null ? 'var(--glass)' : `color-mix(in srgb, var(--over) ${20 + b * 18}%, var(--deck-2))`,
                  border: s.code === code ? '1.5px solid var(--glow)' : '1px solid var(--deck-line)',
                  opacity: s.code === 'CA' ? 1 : 0.48,
                }}
                title={s.code === 'CA' ? `${s.name}: ${s.perFy2025 === null ? 'n/a' : pct(s.perFy2025)}` : `${s.name}: available after the California pilot`}
              >
                {s.code}
              </button>
            );
          })}
        </div>
        {/* PER band labels are legend text, not figures. */}
        <div className="mt-4 flex flex-wrap gap-3 text-xs opacity-75" data-badge-exempt>
          {BANDS.map((b, i) => (
            <span key={b.label} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: `color-mix(in srgb, var(--over) ${20 + i * 18}%, var(--deck-2))` }} />
              {b.label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: 'var(--glass)', border: '1px solid var(--deck-line)' }} />
            n/a (not loaded)
          </span>
        </div>
      </section>

      <HudFrame label="State profile" right={<Badge kind={sel.prov} />}>
        <h2 className="font-display m-0 text-2xl">{sel.name}</h2>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="opacity-60">FY2025 PER</dt>
          <dd className="m-0">{sel.perFy2025 === null ? 'n/a (not loaded)' : <Fig prov={sel.prov}>{pct(sel.perFy2025)}</Fig>}</dd>
          <dt className="opacity-60">Over / under</dt>
          <dd className="m-0">
            {sel.overFy2025 === null || sel.underFy2025 === null ? 'n/a (not loaded)' : (
              <Fig prov={sel.prov}>↑ {pct(sel.overFy2025)} over · ↓ {pct(sel.underFy2025)} under</Fig>
            )}
          </dd>
          <dt className="opacity-60">Administration</dt>
          <dd className="m-0">{sel.adminType ?? 'not loaded'}</dd>
          <dt className="opacity-60">Reporting system</dt>
          <dd className="m-0">{sel.reportingSystem ?? 'not loaded'}</dd>
          <dt className="opacity-60">Policy manual</dt>
          <dd className="m-0">{sel.manual ?? 'Federal 7 CFR 273 only (state manual not loaded)'}</dd>
        </dl>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Btn onClick={start} disabled={busy}>Start California review</Btn>
        </div>
        <p className="mt-3 text-xs opacity-60">California pilot: the review queue uses available case bundles. Fixture examples are labeled Fixture. Public QC rows require a case builder before they can be reviewed here.</p>
      </HudFrame>
    </div>
  );
}
