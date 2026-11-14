import { REPLAY_CAVEAT } from '@cleancase/contracts';
import { Badge, DeckPage, HudFrame } from '@/components/ui';

export const metadata = { title: 'QC projection' };

/** Scaffold of the QC projection dashboard (dashboard-ui). Numbers come from deterministic code once the session has rows. */
export default function DashboardPage() {
  return (
    <DeckPage eyebrow="Session" title="QC projection" prov="fixture">
      <div className="grid gap-4 lg:grid-cols-2">
        <HudFrame label="Ledger beam · this session" right={<Badge kind="fixture" />}>
          <p className="m-0 text-sm opacity-80">↑ over and ↓ under, weighted equally. Populates as cases are worked.</p>
          <div className="mt-6 h-28 rounded-lg" style={{ background: 'linear-gradient(90deg, color-mix(in srgb, var(--over) 30%, transparent), color-mix(in srgb, var(--under) 30%, transparent))' }} aria-hidden />
        </HudFrame>
        <section className="panel">
          <h2 className="panel__title">Projected PER <Badge kind="fixture" /></h2>
          <p className="m-0 text-sm opacity-80">Projection with interval: not computed yet (no worked cases). A projected PER is never the official PER.</p>
        </section>
        <section className="panel">
          <h2 className="panel__title">Dollars at risk by element, both directions <Badge kind="fixture" /></h2>
          <p className="m-0 text-sm opacity-80">Stacked bars land with the dashboard-ui feature.</p>
        </section>
        <section className="panel">
          <h2 className="panel__title">Change-report aging <Badge kind="fixture" /></h2>
          <p className="m-0 text-sm opacity-80">Alerts over 10 days show in the conflict color.</p>
        </section>
        <section className="panel lg:col-span-2">
          <h2 className="panel__title">Replay accuracy <Badge kind="replay" /></h2>
          <p className="m-0 text-sm">{REPLAY_CAVEAT}</p>
        </section>
      </div>
    </DeckPage>
  );
}
