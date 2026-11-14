'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { CaseBundle, GateItem } from '@stampy/contracts';
import { validOverride } from '@stampy/snap-rules';
import { Badge, Btn, DeckPage, StampMark } from '@/components/ui';
import { ROUTES } from '@/lib/routes';

/** Scaffold of the pre-issuance gate (A9). Warnings, never blocks: resolve or override with a typed reason. */
export function GateSheet({ bundle }: { bundle: CaseBundle }) {
  const [items, setItems] = useState<GateItem[]>(bundle.gate);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [certified, setCertified] = useState(false);
  const open = items.filter((i) => !i.resolved && !i.override);

  const override = (id: string) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, override: { reason: reasons[id] ?? '', by: 'worker:demo' } } : x)));
  const resolve = (id: string) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, resolved: true } : x)));

  return (
    <DeckPage eyebrow={`Case ${bundle.case.qcId} · station 10`} title="Before you certify" prov={bundle.case.prov}>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="panel" aria-label="Open items">
          <h2 className="panel__title">Open items ({open.length})</h2>
          {items.length === 0 ? <p className="m-0 text-sm opacity-70">Nothing open. The deterministic checks found no gaps.</p> : null}
          <ul className="m-0 grid list-none gap-3 p-0">
            {items.map((i) => (
              <li key={i.id} className="rounded-lg border p-3" style={{ borderColor: i.resolved || i.override ? 'var(--deck-line)' : 'var(--over)' }} data-gate={i.rule}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span><span className="num text-xs opacity-60">{i.rule} · station {i.station}</span> <strong className="ml-2">{i.label}</strong></span>
                  {i.resolved ? <span className="eyebrow" style={{ color: 'var(--glow)' }}>Resolved</span> : i.override ? <span className="eyebrow" style={{ color: '#F0C267' }}>Overridden: {i.override.reason}</span> : (
                    <span className="flex gap-2">
                      <Link className="btn btn--ghost" style={{ minHeight: 32 }} href={ROUTES.case(bundle.case.id)}>Go to station</Link>
                      <Btn variant="ghost" style={{ minHeight: 32 }} onClick={() => resolve(i.id)}>Mark resolved</Btn>
                    </span>
                  )}
                </div>
                {!i.resolved && !i.override ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input aria-label={`Override reason for ${i.rule}`} className="min-w-[220px] flex-1 rounded-md border bg-transparent px-2 py-1 text-sm" style={{ borderColor: 'var(--deck-line)' }} placeholder="Override reason (required)" value={reasons[i.id] ?? ''} onChange={(e) => setReasons((r) => ({ ...r, [i.id]: e.target.value }))} />
                    <Btn variant="over" style={{ minHeight: 32 }} disabled={!validOverride(reasons[i.id])} onClick={() => override(i.id)}>Override with reason</Btn>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
        <aside className="panel grid content-start gap-4">
          <h2 className="panel__title">Certification <Badge kind="fixture" /></h2>
          <p className="m-0 text-sm opacity-80">The decision is yours. Overrides are shown to the supervisor and in the debrief. Certification is simulated; nothing leaves the app.</p>
          {certified ? (
            <>
              <StampMark />
              <Link href={ROUTES.debrief(bundle.case.id)} className="text-cta">Open the debrief →</Link>
            </>
          ) : (
            <Btn onClick={() => setCertified(true)} disabled={open.length > 0}>{open.length ? `${open.length} items still open` : 'Certify'}</Btn>
          )}
        </aside>
      </div>
    </DeckPage>
  );
}
