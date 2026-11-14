import type { Prov } from '@stampy/contracts';
import type { CaseBundleV2 } from '@stampy/contracts/stampy';

/** Processing mode is separate from the provenance of the input documents. */
export function evidenceProvenance(bundle: CaseBundleV2): Prov {
  if (bundle.facts.some((f) => f.prov === 'fixture')) return 'fixture';
  if (bundle.documents.some((d) => d.synthetic) || bundle.facts.some((f) => f.prov === 'synthetic')) return 'synthetic';
  if (bundle.facts.some((f) => f.prov === 'replay')) return 'replay';
  if (bundle.facts.some((f) => f.prov === 'sandbox')) return 'sandbox';
  return bundle.facts.length ? 'live' : 'sandbox';
}

export function nextStep(b: CaseBundleV2) {
  if (b.decision) return { title: 'Review the recorded decision', detail: 'The worker action and its evidence remain in the audit trail.', target: 'stp-decision' };
  if (b.documents.some((d) => d.readStatus === 'failed' || d.readStatus === 'needs_person'))
    return { title: 'Review an unreadable document', detail: 'Check the source and the reader error. Retry the reader after the issue is resolved.', target: 'stp-documents' };
  if (!b.documents.length || b.documents.some((d) => d.readStatus === 'pending' || d.readStatus === 'reading'))
    return { title: 'Check incoming documents', detail: 'Extracted facts appear as the document reader finishes. Review them against their source.', target: 'stp-documents' };
  if (b.outreach.some((o) => o.kind === 'request' && (o.status === 'draft' || o.status === 'failed')))
    return { title: 'Review the outreach request', detail: 'Check the recipient, questions and draft before approving the send.', target: 'stp-outreach' };
  if (b.questions.some((q) => q.status !== 'closed'))
    return { title: 'Resolve the open questions', detail: 'Compare the conflicting sources and review any caller answers or requested documents.', target: 'stp-questions' };
  if (!b.recompute || b.recompute.after.benefitMonthly === null || b.recompute.before.benefitMonthly === null)
    return { title: 'Check the budget calculation', detail: 'The benefit calculation is not loaded. Review the evidence and rules service before a decision.', target: 'stp-budget' };
  return { title: 'Review the proposed change', detail: 'Compare the budget, source evidence and resolved questions before recording your decision.', target: 'stp-decision' };
}

export function decisionReady(b: CaseBundleV2): boolean {
  return b.case.status === 'ready_for_review' && !b.decision &&
    b.documents.length > 0 && b.documents.every((d) => d.readStatus === 'read') &&
    b.questions.every((q) => q.status === 'closed') &&
    b.recompute !== null && b.recompute.before.benefitMonthly !== null && b.recompute.after.benefitMonthly !== null;
}
