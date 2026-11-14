import { GC1_WORKED_BUNDLE } from '@cleancase/contracts/fixtures';
import { Badge, CaseVsDoc } from '@/components/ui';
import { DecisionPipeline } from '@/components/pipeline/decision-pipeline';

const STEPS = ['Read the documents', 'Compare to the case file', 'Cite the rule', 'Recompute both ways', 'Worker decides'];

/** Section 5: how one case works. The Decision Pipeline replay of GC-1 (built from its audit and ledger rows) plus CaseVsDoc. */
export function HowItWorks() {
  return (
    <section id="how" className="how wrap" aria-labelledby="how-title">
      <div className="eyebrow">How one case works</div>
      <h2 id="how-title" className="font-display h-section">From a paystub to a decision, with every step on the record.</h2>
      <ol className="how__steps">
        {STEPS.map((s, i) => (
          <li key={s}><span className="num how__n">{String(i + 1).padStart(2, '0')}</span>{s}</li>
        ))}
      </ol>
      <div className="how__pipeline app-dark-panel">
        <div className="how__pipeline-head">
          <span className="eyebrow">Decision pipeline · golden case GC-1</span>
          <Badge kind="fixture" />
        </div>
        <DecisionPipeline bundle={GC1_WORKED_BUNDLE} compact />
        <p className="how__legend">Gray: sources · amber: open question · indigo: AI acts · green: ledger and rules · terracotta: a person decides.</p>
      </div>
      <CaseVsDoc
        caseLabel="Budgeted in case file"
        caseValue="$1,240 / month"
        docLabel="Read from paystub"
        docValue="$1,240 biweekly = $2,666 / month"
        prov="fixture"
        crop={<span data-figure>Gross $1,240.00 · Pay frequency: Biweekly <Badge kind="synthetic" /></span>}
      />
      <p className="how__note">A flag alone never changes a case.</p>
    </section>
  );
}
