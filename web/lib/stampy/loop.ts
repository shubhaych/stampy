/**
 * The 14-step demo loop, computed from the case's audit trail. A node is lit only when at least one audit row
 * backs it; nothing here is hard-coded to "done". Pure: tested in loop.test.ts.
 */
import type { AuditRow, CaseBundleV2 } from '@stampy/contracts/stampy';

/** Legend kind, mapped to the pipeline tokens (--src, --question, --ai, --ledger, --human). */
export type LoopKind = 'src' | 'question' | 'ai' | 'ledger' | 'human';

export const LOOP_KIND_LABEL: Record<LoopKind, string> = {
  src: 'Source',
  question: 'Open question',
  ai: 'AI acts',
  ledger: 'Rules engine',
  human: 'Human decides',
};

export type LoopState = 'lit' | 'waiting' | 'dim';

export interface LoopNode {
  key: string;
  n: number;
  title: string;
  kind: LoopKind;
  state: LoopState;
  /** Audit rows that light this node (empty unless state is 'lit'). */
  backing: AuditRow[];
  /** Earliest backing row time, or the waiting row's time. */
  at: string | null;
  /** Short status line, e.g. "2 documents", "draft waiting for a caseworker". */
  note: string | null;
  /** First node after the last lit one: where the loop goes next. */
  next: boolean;
}

interface StepDef {
  key: string;
  title: string;
  kind: LoopKind;
  /** Rows that light the node. */
  match: (rows: AuditRow[], ctx: Ctx) => AuditRow[];
  /** Rows that put the node in a waiting state when it is not lit. */
  waiting?: (rows: AuditRow[], ctx: Ctx) => AuditRow[];
  note?: (backing: AuditRow[], waiting: AuditRow[], ctx: Ctx) => string | null;
}

interface Ctx {
  /** Time the applicant's emailed reply first landed; separates the first and second read/ledger passes. */
  replyAt: number | null;
}

const ts = (r: AuditRow) => new Date(r.at).getTime();
const str = (r: AuditRow, k: string) => (r.data && typeof r.data[k] === 'string' ? (r.data[k] as string) : null);
const num = (r: AuditRow, k: string) => (r.data && typeof r.data[k] === 'number' ? (r.data[k] as number) : null);
const is = (...actions: string[]) => (r: AuditRow) => actions.includes(r.action);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A read belongs to the applicant's emailed reply when its data says so. */
const fromEmail = (r: AuditRow) => str(r, 'source') === 'email';

function sumFacts(rows: AuditRow[]): number | null {
  const ns = rows.map((r) => num(r, 'facts')).filter((n): n is number => n !== null);
  return ns.length ? ns.reduce((a, b) => a + b, 0) : null;
}

const STEPS: StepDef[] = [
  {
    key: 'upload', title: 'Applicant uploads', kind: 'src',
    match: (rows) => rows.filter((r) => r.action === 'case.created' || (r.action === 'document.received' && !fromEmail(r))),
    note: (b) => {
      const docs = b.filter((r) => r.action === 'document.received').length;
      return docs ? plural(docs, 'document') : null;
    },
  },
  {
    key: 'read', title: 'Read the documents (Claude vision)', kind: 'ai',
    match: (rows) => rows.filter((r) => is('document.read', 'document.read_failed')(r) && !fromEmail(r)),
    note: (b) => {
      const failed = b.filter(is('document.read_failed')).length;
      const ok = b.length - failed;
      return [ok ? `${ok} read` : null, failed ? `${failed} failed` : null].filter(Boolean).join(' · ') || null;
    },
  },
  {
    key: 'ledger-1', title: 'Evidence ledger', kind: 'ledger',
    match: (rows) => rows.filter((r) => r.action === 'document.read' && !fromEmail(r)),
    note: (b) => {
      const n = sumFacts(b);
      return n === null ? null : plural(n, 'fact');
    },
  },
  {
    key: 'questions', title: 'Open questions', kind: 'question',
    match: (rows) => rows.filter(is('question.opened')),
    note: (b) => plural(b.length, 'question'),
  },
  {
    key: 'email-request', title: 'Email the request (AgentMail)', kind: 'ai',
    match: (rows) => rows.filter((r) => r.action === 'email.sent' && str(r, 'kind') === 'request'),
    waiting: (rows) => rows.filter((r) => r.action === 'email.drafted' && str(r, 'kind') === 'request'),
    note: (b, w) => (b.length ? (b.some((r) => r.data?.simulated === true) ? 'simulated send' : 'sent') : w.length ? 'draft waiting for a caseworker' : null),
  },
  {
    key: 'call-in', title: 'Applicant calls in', kind: 'src',
    match: (rows) => rows.filter(is('call.started')),
    note: (b) => (b.length > 1 ? plural(b.length, 'call') : null),
  },
  {
    key: 'call', title: 'Inbound call (Vapi: Deepgram → Claude → ElevenLabs)', kind: 'ai',
    match: (rows) => rows.filter(is('call.verified', 'call.ended')),
    note: (b) => (b.some(is('call.verified')) ? 'caller verified' : b.length ? 'call ended' : null),
  },
  {
    key: 'ledger-2', title: 'Evidence ledger', kind: 'ledger',
    match: (rows) => rows.filter(is('call.answer_recorded')),
    note: (b) => plural(b.length, 'answer'),
  },
  {
    key: 'email-checklist', title: 'Email the checklist (AgentMail)', kind: 'ai',
    match: (rows) => rows.filter((r) => r.action === 'email.sent' && str(r, 'kind') === 'checklist'),
    waiting: (rows) => rows.filter((r) => r.action === 'email.drafted' && str(r, 'kind') === 'checklist'),
    note: (b, w) => (b.length ? (b.some((r) => r.data?.simulated === true) ? 'simulated send' : 'sent') : w.length ? 'drafted' : null),
  },
  {
    key: 'reply', title: 'Applicant replies', kind: 'src',
    match: (rows) => rows.filter((r) => r.action === 'email.received' || (r.action === 'document.received' && fromEmail(r))),
    note: (b) => {
      const n = b.filter(is('email.received')).map((r) => num(r, 'attachments') ?? 0).reduce((a, x) => a + x, 0);
      return n ? plural(n, 'attachment') : null;
    },
  },
  {
    key: 'read-attachment', title: 'Read the attachment (Claude vision)', kind: 'ai',
    match: (rows) => rows.filter((r) => is('document.read', 'document.read_failed')(r) && fromEmail(r)),
    note: (b) => (b.some(is('document.read_failed')) ? 'read failed, needs a person' : null),
  },
  {
    key: 'ledger-3', title: 'Evidence ledger', kind: 'ledger',
    match: (rows, ctx) =>
      rows.filter((r) =>
        (r.action === 'document.read' && fromEmail(r)) ||
        (ctx.replyAt !== null && is('question.answered', 'question.closed')(r) && ts(r) >= ctx.replyAt)),
    note: (b) => {
      const closed = b.filter(is('question.closed')).length;
      return closed ? `${plural(closed, 'question')} closed` : null;
    },
  },
  {
    key: 'rules', title: 'Rules engine (PolicyEngine)', kind: 'ledger',
    match: (rows) => rows.filter(is('recompute.done')),
    note: (b) => (b.length > 1 ? `${b.length} runs` : null),
  },
  {
    key: 'decide', title: 'Caseworker decides', kind: 'human',
    match: (rows) => rows.filter(is('decision.approve', 'decision.reject')),
    waiting: (rows) => rows.filter(is('recompute.done')).slice(-1),
    note: (b, w) => {
      const last = b[b.length - 1];
      if (last) return last.action === 'decision.approve' ? 'approved' : 'rejected';
      return w.length ? 'waiting for a caseworker' : null;
    },
  },
];

export const LOOP_STEP_COUNT = STEPS.length;

export function buildLoop(audit: CaseBundleV2['audit']): LoopNode[] {
  const rows = [...audit].sort((a, b) => ts(a) - ts(b) || a.id - b.id);
  const firstAt = (pred: (r: AuditRow) => boolean) => {
    const r = rows.find(pred);
    return r ? ts(r) : null;
  };
  const ctx: Ctx = {
    replyAt: firstAt((r) => r.action === 'email.received' || (r.action === 'document.received' && fromEmail(r))),
  };

  const nodes: LoopNode[] = STEPS.map((s, i) => {
    const backing = s.match(rows, ctx);
    const waitingRows = backing.length ? [] : (s.waiting?.(rows, ctx) ?? []);
    const state: LoopState = backing.length ? 'lit' : waitingRows.length ? 'waiting' : 'dim';
    const atRow = backing[0] ?? waitingRows[waitingRows.length - 1] ?? null;
    return {
      key: s.key,
      n: i + 1,
      title: s.title,
      kind: s.kind,
      state,
      backing,
      at: atRow ? atRow.at : null,
      note: s.note ? s.note(backing, waitingRows, ctx) : null,
      next: false,
    };
  });

  let lastLit = -1;
  nodes.forEach((n, i) => {
    if (n.state === 'lit') lastLit = i;
  });
  const nxt = nodes[lastLit + 1];
  if (nxt) nxt.next = true;
  return nodes;
}
