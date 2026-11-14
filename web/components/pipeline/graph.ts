/**
 * Decision Pipeline graph (master prompt 0.4), generated from the case's real audit_log and ledger rows.
 * A node is lit only if rows back it. Pure: tested in graph.test.ts.
 */
import type { AuditEntry, CaseBundle, Prov } from '@cleancase/contracts';

export type NodeKind = 'source' | 'question' | 'ai' | 'ledger' | 'human';
export type NodeId =
  | 'documents' | 'matches' | 'budget' | 'ledger' | 'question' | 'planner'
  | 'text' | 'employer' | 'interview' | 'writeback' | 'rules' | 'decide';

export interface PipelineNode {
  id: NodeId;
  label: string;
  kind: NodeKind;
  step: 'Rules engine' | 'AI acts' | 'Human decides' | 'Source';
  x: number;
  y: number;
  rows: string[];
  prov: Prov | null;
}

export interface PipelineEdge { from: NodeId; to: NodeId; lit: boolean }

const LAYOUT: Omit<PipelineNode, 'rows' | 'prov'>[] = [
  { id: 'documents', label: 'Documents', kind: 'source', step: 'Source', x: 60, y: 40 },
  { id: 'matches', label: 'Data matches', kind: 'source', step: 'Source', x: 60, y: 110 },
  { id: 'budget', label: 'Case budget', kind: 'source', step: 'Source', x: 60, y: 180 },
  { id: 'ledger', label: 'Evidence ledger', kind: 'ledger', step: 'Rules engine', x: 230, y: 110 },
  { id: 'question', label: 'Open question', kind: 'question', step: 'Rules engine', x: 400, y: 110 },
  { id: 'planner', label: 'Resolution planner', kind: 'ai', step: 'AI acts', x: 570, y: 110 },
  { id: 'text', label: 'Text the household', kind: 'ai', step: 'AI acts', x: 740, y: 40 },
  { id: 'employer', label: 'Contact the employer', kind: 'ai', step: 'AI acts', x: 740, y: 110 },
  { id: 'interview', label: 'Interview copilot', kind: 'ai', step: 'AI acts', x: 740, y: 180 },
  { id: 'writeback', label: 'Answers to ledger', kind: 'ledger', step: 'Rules engine', x: 910, y: 110 },
  { id: 'rules', label: 'Rules engine recomputes', kind: 'ledger', step: 'Rules engine', x: 1080, y: 110 },
  { id: 'decide', label: 'Caseworker decides', kind: 'human', step: 'Human decides', x: 1250, y: 110 },
];

export const EDGES: [NodeId, NodeId][] = [
  ['documents', 'ledger'], ['matches', 'ledger'], ['budget', 'ledger'], ['ledger', 'question'], ['question', 'planner'],
  ['planner', 'text'], ['planner', 'employer'], ['planner', 'interview'],
  ['text', 'writeback'], ['employer', 'writeback'], ['interview', 'writeback'], ['writeback', 'rules'], ['rules', 'decide'],
];

const has = (a: AuditEntry[], pred: (e: AuditEntry) => boolean) => a.filter(pred).map((e) => `audit:${e.id}`);

export function buildPipeline(b: CaseBundle): { nodes: PipelineNode[]; edges: PipelineEdge[] } {
  const a = b.audit;
  const rows: Record<NodeId, string[]> = {
    documents: [...b.facts.filter((f) => f.sourceKind === 'document').map((f) => `fact:${f.id}`)],
    matches: b.facts.filter((f) => f.sourceKind === 'data_match').map((f) => `fact:${f.id}`),
    budget: b.facts.filter((f) => f.sourceKind === 'case_budget').map((f) => `fact:${f.id}`),
    ledger: b.facts.map((f) => `fact:${f.id}`),
    question: b.questions.map((q) => `open_question:${q.id}`),
    planner: b.plans.map((p) => `resolution_plan:${p.id}`),
    text: b.outreach.filter((o) => o.channel === 'text_household').map((o) => `outreach:${o.id}`),
    employer: [...b.outreach.filter((o) => o.channel === 'employer_call' || o.channel === 'employer_email').map((o) => `outreach:${o.id}`), ...b.calls.filter((c) => c.status !== 'briefing').map((c) => `call:${c.id}`)],
    interview: b.outreach.filter((o) => o.channel === 'interview').map((o) => `outreach:${o.id}`),
    writeback: b.facts.filter((f) => f.questionId !== null).map((f) => `fact:${f.id}`),
    rules: has(a, (e) => e.action === 'recompute' || e.action === 'question.close'),
    decide: has(a, (e) => e.kind === 'human' && (e.action === 'change.approve' || e.action === 'change.reject' || e.action === 'case.certify')),
  };
  const provOf = (id: NodeId): Prov | null => {
    if (!rows[id].length) return null;
    return b.case.prov;
  };
  const nodes = LAYOUT.map((n) => ({ ...n, rows: rows[n.id], prov: provOf(n.id) }));
  const lit = new Set(nodes.filter((n) => n.rows.length > 0).map((n) => n.id));
  const edges = EDGES.map(([from, to]) => ({ from, to, lit: lit.has(from) && lit.has(to) }));
  return { nodes, edges };
}
