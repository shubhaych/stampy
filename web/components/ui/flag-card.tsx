import type { Flag } from '@cleancase/contracts';
import { Direction } from './direction';
import { Fig } from './fig';
import { signedMoney } from '@/lib/format';

/** A flag is a suggestion. The worker accepts, dismisses, or asks a question. */
export function FlagCard({ flag, onProof, onAccept, onDismiss }: { flag: Flag; onProof?: () => void; onAccept?: () => void; onDismiss?: () => void }) {
  return (
    <article className={`flag-card flag-card--${flag.direction}`} data-flag={flag.id}>
      <div className="flex items-center justify-between gap-2">
        <Direction dir={flag.direction} />
        <span className="flag-card__rule">{flag.ruleId} · station {flag.station}</span>
      </div>
      <div className="flag-card__title">{flag.title}</div>
      {flag.deltaMonthly !== null ? (
        <div className="text-sm">
          <Fig prov={flag.prov}>{signedMoney(flag.deltaMonthly)} / mo</Fig>
        </div>
      ) : null}
      {flag.question ? <p className="m-0 text-sm opacity-80">Ask: {flag.question}</p> : null}
      <div className="flag-card__actions">
        <button type="button" className="btn btn--ghost" onClick={onProof}>View proof</button>
        {flag.status === 'open' ? (
          <>
            <button type="button" className="btn btn--primary" onClick={onAccept}>Accept</button>
            <button type="button" className="btn btn--ghost" onClick={onDismiss}>Dismiss</button>
          </>
        ) : (
          <span className="eyebrow opacity-70">{flag.status} by worker</span>
        )}
      </div>
    </article>
  );
}
