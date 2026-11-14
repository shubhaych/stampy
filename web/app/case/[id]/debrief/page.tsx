import { REPLAY_CAVEAT } from '@cleancase/contracts';
import { Badge, DeckPage, Fig, HudFrame } from '@/components/ui';
import { data } from '@/lib/data';
import { money } from '@/lib/format';

export const metadata = { title: 'Debrief' };

/** Scaffold of the Truth Envelope (A10). In live mode the worker serves this only after certification. */
export default async function DebriefPage(props: PageProps<'/case/[id]/debrief'>) {
  const { id } = await props.params;
  const d = await data.debrief(id);
  if (!d) {
    return (
      <DeckPage eyebrow={`Case ${id}`} title="Debrief">
        <p className="opacity-80">The debrief opens after the worker certifies this case.</p>
      </DeckPage>
    );
  }
  const rows: [string, number, number][] = [
    ['Gross income / mo', d.certified.grossIncomeMonthly, d.qcVerified.grossIncomeMonthly],
    ['Shelter / mo', d.certified.shelterMonthly, d.qcVerified.shelterMonthly],
  ];
  return (
    <DeckPage eyebrow={`Case ${id} · debrief`} title="What QC found on this case" prov={d.prov}>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <HudFrame label="QC found on this case" right={<Badge kind={d.prov} />}>
          <table className="deck-table">
            <thead><tr><th>Element</th><th>Certified</th><th>QC-verified</th></tr></thead>
            <tbody>
              {rows.map(([k, a, b]) => (
                <tr key={k}><td>{k}</td><td><Fig prov={d.prov}>{money(a)}</Fig></td><td><Fig prov={d.prov}>{money(b)}</Fig></td></tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 mb-0 text-sm">QC finding: {d.qcFinding.element ?? 'no error'} · direction {d.qcFinding.direction} · responsibility {d.qcFinding.responsibility ?? 'n/a'}</p>
        </HudFrame>
        <section className="panel grid content-start gap-2 text-sm">
          <h2 className="panel__title">AI flags vs QC</h2>
          <div>Matched: {d.flagsMatched.length ? d.flagsMatched.join(', ') : 'none'}</div>
          <div>Missed: {d.flagsMissed.length ? d.flagsMissed.join(', ') : 'none'}</div>
          <div>False flags: {d.falseFlags.length ? d.falseFlags.join(', ') : 'none'}</div>
          <div>Worker overrides: {d.overrides.length ? d.overrides.join(', ') : 'none'}</div>
          <p className="mt-3 mb-0 text-xs opacity-75">{REPLAY_CAVEAT}</p>
        </section>
      </div>
    </DeckPage>
  );
}
