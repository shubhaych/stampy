import Link from 'next/link';
import { Badge, ClockChip, DeckPage, HudFrame } from '@/components/ui';
import { data } from '@/lib/data';
import { ROUTES } from '@/lib/routes';

export const metadata = { title: 'My cases' };

export default async function QueuePage() {
  const queue = (await data.queue()).filter((q) => q.state === 'CA');
  return (
    <DeckPage eyebrow="Demo · step 2 of 3" title="My cases" prov={queue[0]?.prov ?? 'fixture'}>
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <p className="text-sm opacity-70 lg:col-span-2">California pilot · This queue shows reviewable case bundles. Imported public QC rows need a case builder before they appear here. Each case shows its provenance badge.</p>
        <section className="panel overflow-x-auto" aria-label="Case queue">
          <table className="deck-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>State</th>
                <th>Clock</th>
                <th>Household</th>
                <th>AI pre-triage</th>
                <th>Status</th>
                <th><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody>
              {queue.map((q) => (
                <tr key={q.caseId} data-case={q.caseId}>
                  <td className="num">{q.qcId} <Badge kind={q.prov} /></td>
                  <td>{q.state}</td>
                  <td><ClockChip day={q.dayOfThirty} of={30} /></td>
                  <td>HH {q.householdSize}</td>
                  <td className="text-sm opacity-80">{q.docsReady} docs ready · {q.openFlags} {q.openFlags === 1 ? 'flag' : 'flags'}</td>
                  <td className="text-sm">{q.status.replace('_', ' ')}</td>
                  <td><Link href={ROUTES.case(q.caseId)} className="text-cta" style={{ minHeight: 0 }}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <HudFrame label="Shift summary" right={<Badge kind="fixture" />}>
          <dl className="grid grid-cols-[1fr_auto] gap-y-2 text-sm">
            <dt className="opacity-70">Cases worked</dt><dd className="num m-0">0 of {queue.length}</dd>
            <dt className="opacity-70">Flags resolved</dt><dd className="num m-0">0</dd>
            <dt className="opacity-70">Skipped, then caught</dt><dd className="num m-0">0</dd>
          </dl>
        </HudFrame>
      </div>
    </DeckPage>
  );
}

// Live mode reads the worker at request time, never at build time.
export const dynamic = 'force-dynamic';
