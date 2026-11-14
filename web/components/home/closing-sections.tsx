'use client';

import { useEffect, useState } from 'react';
import type { IntegrationStatus } from '@cleancase/contracts';
import { FIXTURE_SYSTEM_STATUS } from '@cleancase/contracts/fixtures';
import { Badge, Fig, SourceChip, StampMark, TextCta } from '@/components/ui';
import { data } from '@/lib/data';
import { FACTS, MARKET, source } from './facts';

const NEVER = ['Never deny', 'Never auto-correct', 'Cite every flag', 'Both directions'];
const NOT_CLAIMED = [
  'CleanCase does not decide eligibility. A merit-staff worker decides.',
  'It is not built to find intentional program violations. It checks the case file for accuracy, in both directions.',
  'It does not promise any reduction in a state’s payment error rate.',
  'It is not FNA-approved, and it holds no FedRAMP, StateRAMP, or Pub 1075 authorization.',
  'It does not use credit-bureau data to verify applicants.',
  'It is not connected to CalSAWS, TIERS, or any state eligibility system.',
  'Its projected error rate is not the official payment error rate.',
];

/** Section 8: guardrails. */
export function Guardrails() {
  return (
    <section className="guard wrap" aria-labelledby="guard-title">
      <div className="eyebrow">Guardrails</div>
      <h2 id="guard-title" className="font-display h-section">What we will never do</h2>
      <div className="guard__stamps">
        {NEVER.map((n, i) => (
          <div key={n} className="guard__stamp" style={{ rotate: `${[-3, 2, -2, 3][i]}deg` }}><StampMark label={n} /></div>
        ))}
      </div>
      <h3 className="guard__sub">What we do not claim</h3>
      <ul className="guard__list">{NOT_CLAIMED.map((c) => <li key={c}>{c}</li>)}</ul>
    </section>
  );
}

/** Section 9: market proof (facts ledger row 12). */
export function MarketProof() {
  return (
    <section className="market wrap" aria-labelledby="market-title">
      <div className="eyebrow">Already happening</div>
      <h2 id="market-title" className="font-display h-section">States are buying this category now.</h2>
      <div className="market__row">
        {MARKET.map((m) => (
          <article key={m.src} className="market__card">
            <div className="market__fig font-display"><Fig prov={m.prov}>{m.figure}</Fig></div>
            <p>{m.what}</p>
            <SourceChip {...source(m.src)} />
          </article>
        ))}
      </div>
      <p className="market__tag">CleanCase starts as a free shadow-mode replay.</p>
      <p className="market__nyu">
        Independent support: risk-based review alone costs <Fig prov={FACTS.nyu.prov} source={source(FACTS.nyu.src)}>{FACTS.nyu.value}</Fig> as much as AI flags combined with risk scores. <span className="market__caveat">{FACTS.nyu.caveat}.</span>
      </p>
    </section>
  );
}

const START = [
  { t: 'Replay your state', d: 'Run the public QC file for your state. Free.' },
  { t: 'Shadow mode', d: '200 closed cases, no system access.' },
  { t: 'Pre-issuance pilot', d: 'Paid pilot on one office queue.' },
  { t: 'Accuracy report', d: 'Findings in both directions, with proof.' },
];

/** Section 10: how a state starts. */
export function StateStart() {
  return (
    <section className="start wrap" aria-labelledby="start-title">
      <div className="eyebrow">How a state starts</div>
      <h2 id="start-title" className="font-display h-section">Start with a replay. Decide with evidence.</h2>
      <ol className="start__rail">
        {START.map((s, i) => (
          <li key={s.t}><span className="num start__n">{String(i + 1).padStart(2, '0')}</span><strong>{s.t}</strong><span>{s.d}</span></li>
        ))}
      </ol>
      <p className="start__ask">The ask: 200 closed QC cases or a de-identified replay.</p>
    </section>
  );
}

const POWERED: { name: string; status: string; does: string }[] = [
  { name: 'Anthropic Claude', status: 'anthropic', does: 'Runs every review role: reads documents, words questions, plans the cheapest way to close each one. Every output is a suggestion a worker accepts or dismisses.' },
  { name: 'Moss', status: 'moss', does: 'Retrieves the policy passage behind each flag from 7 CFR 273 and state manuals, with the retrieval time shown on the citation.' },
  { name: 'SQLite with the QC history', status: 'sqlite', does: 'Holds the USDA QC public-use records the queue is drawn from, plus an append-only ledger and audit log of every step.' },
  { name: 'Deepgram voice', status: 'deepgram', does: 'Carries the employer and landlord calls: speech in, speech out, turn-taking, with Claude deciding what to say.' },
  { name: 'PolicyEngine-US', status: 'policyengine', does: 'Optional second calculation of the benefit, labelled only when it actually ran.' },
];

/** Section 11: powered by (accordion). Badges reflect /system status at runtime; fixture until the worker answers. */
export function PoweredBy() {
  const [status, setStatus] = useState<IntegrationStatus[]>(FIXTURE_SYSTEM_STATUS.integrations);
  useEffect(() => {
    let live = true;
    data.status().then((s) => live && setStatus(s.integrations)).catch(() => {});
    return () => { live = false; };
  }, []);
  return (
    <section className="powered wrap" aria-labelledby="powered-title">
      <div className="eyebrow">Powered by</div>
      <h2 id="powered-title" className="font-display h-section">What each tool actually does here</h2>
      <div className="powered__list">
        {POWERED.map((p) => {
          const s = status.find((x) => x.name === p.status);
          return (
            <details key={p.name} className="powered__item">
              <summary><span>{p.name}</span><Badge kind={s?.badge ?? 'fixture'} /></summary>
              <p>{p.does}</p>
              {s?.note ? <p className="powered__note">Now: {s.mode} · {s.note}</p> : null}
            </details>
          );
        })}
      </div>
    </section>
  );
}

/** Section 12: closing CTA (the footer line itself renders in the layout on every page). */
export function Closing() {
  return (
    <section className="closing wrap">
      <h2 className="font-display h-section">See one case, start to finish.</h2>
      <TextCta href="/demo">Work a case →</TextCta>
    </section>
  );
}
