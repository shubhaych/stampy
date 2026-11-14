import type { AgentRun, CaseFile, Flag, GateItem, OpenQuestion, StepState } from '@cleancase/contracts';
import { STATIONS } from './steps';

export interface GateInput {
  caseFile: CaseFile;
  steps: StepState[];
  flags: Flag[];
  questions: OpenQuestion[];
  runs: AgentRun[];
  /** Day of the 30-day clock, for breach items. */
  dayOfThirty?: number;
}

/**
 * Pre-issuance gate (pure). Union of station rules for skipped stations, open flags at review
 * severity or higher, open questions, and clock breaches. The gate never blocks: the worker resolves
 * an item or overrides it with a typed reason. STUB: the rules feature refines each PG rule.
 */
export function evaluate(input: GateInput): GateItem[] {
  const items: GateItem[] = [];
  const cid = input.caseFile.id;
  for (const st of STATIONS) {
    if (st.id === 10 || st.id === 3) continue;
    const skipped = input.steps.find((s) => s.station === st.id)?.status === 'skipped';
    if (skipped) {
      items.push({ id: `G-${cid}-${st.gate.rule}`, rule: st.gate.rule, station: st.id, label: st.gate.label, severity: 'review', flagId: null, resolved: false, override: null });
    }
  }
  if (!input.caseFile.interviewRecorded) {
    items.push({ id: `G-${cid}-PG3`, rule: 'PG3', station: 3, label: 'Interview not recorded', severity: 'review', flagId: null, resolved: false, override: null });
  }
  for (const f of input.flags) {
    if (f.status !== 'open' || f.severity === 'info') continue;
    const st = STATIONS.find((s) => s.id === f.station)!;
    items.push({ id: `G-${f.id}`, rule: st.gate.rule, station: f.station, label: f.title, severity: f.severity === 'warn' ? 'warn' : 'review', flagId: f.id, resolved: false, override: null });
  }
  for (const q of input.questions) {
    if (q.status === 'open' || q.status === 'answered') {
      items.push({ id: `G-${q.id}`, rule: 'PG8', station: 8, label: `Open question: ${q.text}`, severity: 'warn', flagId: null, resolved: false, override: null });
    }
  }
  if ((input.dayOfThirty ?? 0) > 30) {
    items.push({ id: `G-${cid}-CLOCK`, rule: 'PG9', station: 9, label: '30-day processing clock breached', severity: 'warn', flagId: null, resolved: false, override: null });
  }
  return items;
}

/** An override needs a typed reason (PG10). */
export function validOverride(reason: string | undefined | null): boolean {
  return typeof reason === 'string' && reason.trim().length >= 5;
}
