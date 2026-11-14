'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Prov } from '@stampy/contracts';
import type { CaseStatus } from '@stampy/contracts/stampy';
import { Fig } from '@/components/ui';
import type { WorkerIdentity } from '@/lib/stampy/api';
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


/* ---------- caseworker identity (demo sign-in, stored in this browser only) ---------- */

const KEY = 'stampy.caseworker';

function readWorker(): WorkerIdentity | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<WorkerIdentity>;
    return v && typeof v.name === 'string' && typeof v.code === 'string' && v.name ? { name: v.name, code: v.code } : null;
  } catch {
    return null;
  }
}

export function useCaseworker() {
  const [worker, setWorker] = useState<WorkerIdentity | null>(null);
  useEffect(() => {
    setWorker(readWorker());
    const on = (e: StorageEvent) => {
      if (e.key === KEY) setWorker(readWorker());
    };
    window.addEventListener('storage', on);
    return () => window.removeEventListener('storage', on);
  }, []);
  const signIn = useCallback((w: WorkerIdentity) => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(w));
    } catch {
      /* private mode: keep it in memory */
    }
    setWorker(w);
  }, []);
  const signOut = useCallback(() => {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setWorker(null);
  }, []);
  return { worker, signIn, signOut };
}

export function CaseworkerSignIn({ worker, onSignIn, onSignOut }: { worker: WorkerIdentity | null; onSignIn: (w: WorkerIdentity) => void; onSignOut: () => void }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [open, setOpen] = useState(false);
  if (worker) {
    return (
      <div className="stp-signin stp-signin--on">
        <span className="eyebrow opacity-70">Caseworker</span>
        <span className="font-semibold">{worker.name}</span>
        <button type="button" className="stp-link" onClick={onSignOut}>Sign out</button>
      </div>
    );
  }
  if (!open) {
    return (
      <div className="stp-signin">
        <button type="button" className="btn btn--ghost" onClick={() => setOpen(true)}>Caseworker sign-in</button>
      </div>
    );
  }
  return (
    <form
      className="stp-signin stp-signin--form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim() || !code.trim()) return;
        onSignIn({ name: name.trim(), code: code.trim() });
        setOpen(false);
      }}
    >
      <span className="eyebrow opacity-70">Caseworker sign-in</span>
      <input className="stp-input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Caseworker name" autoComplete="name" />
      <input className="stp-input" placeholder="Access code" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Access code" autoComplete="off" />
      <div className="flex items-center gap-2">
        <button type="submit" className="btn btn--primary" disabled={!name.trim() || !code.trim()}>Sign in</button>
        <button type="button" className="stp-link" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      <span className="stp-hint">Demo access code: stampy-worker. The worker checks it on every action.</span>
    </form>
  );
}

export function DataFooter() {
  return <footer className="stp-data-footer">Synthetic documents generated from public USDA QC records. No real applicants. Stampy flags and cites; a merit-staff worker decides. Not an eligibility system.</footer>;
}
