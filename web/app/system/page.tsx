import { Badge, DeckPage } from '@/components/ui';
import { DecisionPipeline } from '@/components/pipeline/decision-pipeline';
import { GC1_WORKED_BUNDLE } from '@stampy/contracts/fixtures';
import { data, DATA_MODE } from '@/lib/data';

export const metadata = { title: 'System' };

export default async function SystemPage() {
  const status = await data.status();
  return (
    <DeckPage eyebrow={`Data source: ${DATA_MODE}`} title="System status" prov={DATA_MODE === 'live' ? 'live' : 'fixture'}>
      <div className="grid gap-4">
        <section className="panel overflow-x-auto">
          <h2 className="panel__title">Integrations</h2>
          <table className="deck-table">
            <thead><tr><th>Integration</th><th>Mode</th><th>Available</th><th>Last run</th><th>Latency</th><th>Runs today</th><th>Daily limit</th><th>Note</th></tr></thead>
            <tbody>
              {status.integrations.map((i) => (
                <tr key={i.name} data-integration={i.name}>
                  <td className="num">{i.name}</td>
                  <td><Badge kind={i.badge} /> <span className="ml-1 text-xs opacity-70">{i.mode}</span></td>
                  <td>{i.available ? 'yes' : 'no'}</td>
                  <td className="text-xs">{i.lastRunAt ?? 'never'}</td>
                  <td className="num text-xs">{i.lastMs === null ? 'n/a' : `${i.lastMs} ms`}</td>
                  <td className="num">{i.runCount}</td>
                  <td className="num">{i.dailyLimit ?? 'n/a'}</td>
                  <td className="text-xs opacity-75">{i.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="panel">
            <h2 className="panel__title">Kill switches</h2>
            <ul className="m-0 grid list-none gap-2 p-0 text-sm">
              <li>AI review: {status.control.aiEnabled ? 'on' : 'offline (worker proceeds manually; the gate still runs)'}</li>
              <li>Moss retrieval: {status.control.mossEnabled ? 'on' : 'offline'}</li>
              <li>Voice verifier: {status.control.voiceEnabled ? 'on' : 'offline (written request path)'}</li>
            </ul>
            <p className="mt-3 mb-0 text-xs opacity-60">Supervisor only; switches flip through the worker, not here, in fixture mode.</p>
          </section>
          <section className="panel">
            <h2 className="panel__title">UNVERIFIED-LIVE</h2>
            <ul className="m-0 grid list-none gap-1 p-0 tabular text-xs">
              {status.unverifiedLive.map((u) => <li key={u}>UNVERIFIED-LIVE: {u}</li>)}
            </ul>
            <p className="mt-3 mb-0 text-xs opacity-60">Recompute match rate on the 500-case sample: {status.recomputeMatchRate?.rate == null ? 'not measured yet' : `${status.recomputeMatchRate.rate}`}</p>
          </section>
        </div>
        <section className="panel">
          <h2 className="panel__title">How decisions are made <Badge kind="fixture" /></h2>
          <DecisionPipeline bundle={GC1_WORKED_BUNDLE} compact />
          <p className="mt-2 mb-0 text-xs opacity-70">Gray: sources and facts · amber: open question · indigo: AI acts · green: ledger and rules · terracotta: a person decides.</p>
        </section>
      </div>
    </DeckPage>
  );
}

// Live mode reads the worker at request time, never at build time.
export const dynamic = 'force-dynamic';
