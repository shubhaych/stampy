'use client';

import { createContext, useCallback, useContext, type ReactNode } from 'react';
import type { Prov } from '@stampy/contracts';
import type { CaseStatus } from '@stampy/contracts/stampy';
import { Fig } from '@/components/ui';
import { splitMoney } from '@/lib/stampy/util';

/* ---------- provenance: a fixture view never shows a Live badge ---------- */

const FixtureCtx = createContext(false);
const EvidenceCtx = createContext<Prov>('live');

export function FixtureProvider({ fixture, provenance = 'live', children }: { fixture: boolean; provenance?: Prov; children: ReactNode }) {
  return <FixtureCtx.Provider value={fixture}><EvidenceCtx.Provider value={provenance}>{children}</EvidenceCtx.Provider></FixtureCtx.Provider>;
}

/** Returns the badge to show for a figure: the given provenance, or Fixture when the page renders the dev fixture. */
export function useProv(): (p: Prov) => Prov {
  const fixture = useContext(FixtureCtx);
  const provenance = useContext(EvidenceCtx);
  return useCallback((p: Prov) => (fixture ? 'fixture' : p === 'live' ? provenance : p), [fixture, provenance]);
}

export function useIsFixture() {
  return useContext(FixtureCtx);
}

/** Text that may quote money: every amount is wrapped in a badged figure (hard rule 8). */
export function MoneyText({ text, prov }: { text: string | null | undefined; prov: Prov }) {
  if (!text) return null;
  const parts = splitMoney(text);
  return (
    <>
      {parts.map((p, i) => (i % 2 === 1 ? <Fig key={i} prov={prov}>{p}</Fig> : <span key={i}>{p}</span>))}
    </>
  );
}

/* ---------- status ---------- */

const STATUS_LABEL: Record<CaseStatus, string> = {
  reading: 'Reading documents',
  questions_open: 'Questions open',
  ready_for_review: 'Ready for review',
  approved: 'Approved by caseworker',
  rejected: 'Rejected by caseworker',
  needs_person: 'Needs a person',
};

export function StatusChip({ status }: { status: CaseStatus }) {
  return (
    <span className={`stp-status stp-status--${status}`} data-status={status}>
      <span className="stp-status__dot" aria-hidden />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function ModeChips({ modes, phoneNumber }: { modes: Record<string, string>; phoneNumber?: string | null }) {
  const names: Record<string, string> = { ai: 'AI', email: 'Email', voice: 'Voice', rules: 'Rules' };
  return (
    <div className="stp-modes" aria-label="Integration modes">
      {Object.entries(modes).map(([k, v]) => (
        <span key={k} className={`stp-mode ${v === 'live' ? 'stp-mode--live' : ''}`} title={`${names[k] ?? k}: ${v}`}>
          {names[k] ?? k} <b>{v}</b>
        </span>
      ))}
      {phoneNumber !== undefined ? (
        <span className="stp-mode" title="Call-in line">
          Line <b>{phoneNumber ?? 'not loaded'}</b>
        </span>
      ) : null}
    </div>
  );
}

export function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="stp-error" role="alert">
      {error}
    </p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="stp-empty">{children}</p>;
}

export function SourceBadge({ source }: { source: 'upload' | 'email' }) {
  return <span className="stp-pill">{source === 'upload' ? 'Uploaded' : 'By email'}</span>;
}


export function DataFooter() {
  return <footer className="stp-data-footer">Synthetic documents generated from public USDA QC records. No real applicants. Stampy flags and cites; a merit-staff worker decides. Not an eligibility system.</footer>;
}
