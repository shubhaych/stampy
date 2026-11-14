'use client';

import { useMemo, useState } from 'react';
import type { CaseBundle } from '@stampy/contracts';
import { Badge } from '@/components/ui';
import { buildPipeline, type NodeKind, type PipelineNode } from './graph';

const FILL: Record<NodeKind, string> = { source: 'var(--src)', question: 'transparent', ai: 'var(--ai)', ledger: 'var(--ledger)', human: 'var(--human)' };
const STROKE: Record<NodeKind, string> = { source: 'var(--src)', question: 'var(--question)', ai: 'var(--ai)', ledger: 'var(--ledger)', human: 'var(--human)' };
const GLYPH: Record<PipelineNode['step'], string> = { Source: '▤', 'Rules engine': '§', 'AI acts': 'AI', 'Human decides': '✋' };
const W = 140;
const H = 46;

/** Scaffold of the Decision Pipeline (0.4). pipeline-ui adds the scrubber and A13 Pipeline Run animation. */
export function DecisionPipeline({ bundle, compact = false }: { bundle: CaseBundle; compact?: boolean }) {
  const { nodes, edges } = useMemo(() => buildPipeline(bundle), [bundle]);
  const [open, setOpen] = useState<PipelineNode | null>(null);
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  return (
    <div data-testid="decision-pipeline">
      <div className="overflow-x-auto">
        <svg viewBox="0 0 1330 230" className="min-w-[760px]" role="img" aria-label="Decision pipeline for this case">
          {edges.map((e) => {
            const a = byId[e.from]!;
            const b = byId[e.to]!;
            return <line key={`${e.from}-${e.to}`} x1={a.x + W / 2} y1={a.y} x2={b.x - W / 2} y2={b.y} stroke={e.lit ? 'var(--glow)' : 'var(--deck-line)'} strokeWidth={e.lit ? 1.6 : 1} />;
          })}
          {nodes.map((n) => {
            const lit = n.rows.length > 0;
            return (
              <g key={n.id} transform={`translate(${n.x - W / 2}, ${n.y - H / 2})`} opacity={lit ? 1 : 0.32} onClick={() => setOpen(n)} style={{ cursor: 'pointer' }} role="button" tabIndex={0} aria-label={`${n.label}: ${lit ? `${n.rows.length} rows` : 'not used'}`} onKeyDown={(ev) => ev.key === 'Enter' && setOpen(n)}>
                <rect width={W} height={H} rx={8} fill={FILL[n.kind]} fillOpacity={0.22} stroke={STROKE[n.kind]} strokeWidth={n.kind === 'question' ? 1.6 : 1} />
                <text x={10} y={19} fontSize={11} fill="var(--deck-ink)" fontFamily="var(--font-sans)">{n.kind === 'question' ? '? ' : ''}{n.label}</text>
                <text x={10} y={36} fontSize={9} fill="var(--deck-ink-soft)" fontFamily="var(--font-mono)">{GLYPH[n.step]} {n.step}</text>
              </g>
            );
          })}
        </svg>
      </div>
      {!compact && open ? (
        <div className="panel mt-3" role="dialog" aria-label={`${open.label} rows`}>
          <h3 className="panel__title">{open.label} · {open.step} {open.prov ? <Badge kind={open.prov} /> : null}</h3>
          {open.rows.length ? <ul className="m-0 pl-4 font-mono text-xs">{open.rows.map((r) => <li key={r}>{r}</li>)}</ul> : <p className="m-0 text-sm opacity-70">No rows: this branch was not used on this case.</p>}
        </div>
      ) : null}
    </div>
  );
}
