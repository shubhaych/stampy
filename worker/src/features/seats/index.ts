/** Source-bound final review. AI supplies questions; the worker decides. */
import { z } from 'zod';
import { GOLDEN_BUNDLES } from '@cleancase/contracts/fixtures';
import type { CaseBundle } from '@cleancase/contracts';
import type { Feature } from '../types';
import { stubStatus } from '../types';
import { AI } from '../../core/authz';
import { appendAudit } from '../../core/audit';
import { consume, getControl, LimitError } from '../../core/control';

const Finding = z.object({
  title: z.string().min(1),
  explanation: z.string().min(1),
  sourceIds: z.array(z.string()).min(1),
  direction: z.enum(['over', 'under', 'none']),
});
const Review = z.object({ findings: z.array(Finding), summary: z.string() });

function safeSources(bundle: CaseBundle) {
  return {
    case: { id: bundle.case.id, state: bundle.case.state, budget: bundle.case.budget, prov: bundle.case.prov },
    docs: bundle.docs.map((d) => ({ id: d.id, kind: d.kind, title: d.title, prov: d.prov })),
    extractions: bundle.extractions.map((e) => ({ id: e.id, docId: e.docId, field: e.field, text: e.text, page: e.page, prov: e.prov })),
    facts: bundle.facts.map((f) => ({ id: f.id, field: f.field, value: f.value, sourceRef: f.sourceRef, status: f.status, prov: f.prov })),
    questions: bundle.questions.map((q) => ({ id: q.id, text: q.text, status: q.status, factIds: q.factIds })),
    flags: bundle.flags.map((f) => ({ id: f.id, title: f.title, direction: f.direction, status: f.status, extractionIds: f.extractionIds,
      citations: f.citations.map((c) => ({ id: c.id, section: c.section, text: c.verified ? c.text : null, verified: c.verified })) })),
  };
}

function fixtureReview(bundle: CaseBundle): z.infer<typeof Review> {
  const findings = [
    ...bundle.questions.filter((q) => q.status === 'open' || q.status === 'answered').map((q) => ({
      title: 'Open question', explanation: q.text, sourceIds: [q.id, ...q.factIds], direction: q.direction,
    })),
    ...bundle.flags.filter((f) => f.status === 'open').map((f) => ({
      title: f.title, explanation: 'Review the recorded finding and its source before worker action.',
      sourceIds: [f.id, ...f.extractionIds], direction: f.direction,
    })),
  ];
  return { findings, summary: findings.length ? 'Recorded items need worker review.' : 'No open item is recorded in this fixture. The worker still reviews the file.' };
}

export const feature: Feature = {
  name: 'seats',
  register(app, ctx) {
    app.post('/seats/run', async (c) => {
      const input = z.object({ caseId: z.string().min(1), action: z.literal('final_review') }).safeParse(await c.req.json().catch(() => null));
      if (!input.success) return c.json({ error: 'caseId and final_review action are required' }, 400);
      const bundle = GOLDEN_BUNDLES.find((b) => b.case.id === input.data.caseId);
      if (!bundle) return c.json({ error: 'case not available for review' }, 404);
      if (!getControl(ctx.db).aiEnabled) return c.json({ status: 'needs_human', reason: 'AI review is offline' });
      try { consume(ctx.db, 'ai', ctx.env.AI_DAILY_RUN_LIMIT); }
      catch (error) { if (error instanceof LimitError) return c.json({ status: 'needs_human', reason: 'AI daily run limit reached' }, 429); throw error; }
      const mode = ctx.env.AI_MODE === 'live' && ctx.env.ANTHROPIC_API_KEY ? 'live' : 'fixture';
      const started = Date.now();
      let result: z.infer<typeof Review>;
      if (mode === 'fixture') result = fixtureReview(bundle);
      else {
        try {
          const sources = safeSources(bundle);
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST', signal: AbortSignal.timeout(30_000),
            headers: { 'content-type': 'application/json', 'x-api-key': ctx.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model: ctx.env.ANTHROPIC_MODEL_REASONING, max_tokens: 900,
              system: 'You are a second-check reviewer. Return JSON only: {"findings":[{"title":"...","explanation":"...","sourceIds":["existing ID"],"direction":"over|under|none"}],"summary":"..."}. Use only supplied source IDs. Report uncertainty as a question. Never decide, certify, accept a fact, or invent policy text. Give both payment directions equal attention.',
              messages: [{ role: 'user', content: JSON.stringify(sources) }],
            }),
          });
          if (!response.ok) throw new Error(`Anthropic HTTP ${response.status}`);
          const message = await response.json() as { content?: Array<{ type: string; text?: string }> };
          const raw = message.content?.find((part) => part.type === 'text')?.text ?? '';
          result = Review.parse(JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, '')));
          const validIds = new Set([...sources.docs.map((s) => s.id), ...sources.extractions.map((s) => s.id), ...sources.facts.map((s) => s.id), ...sources.questions.map((s) => s.id), ...sources.flags.map((s) => s.id)]);
          if (result.findings.some((f) => f.sourceIds.some((id) => !validIds.has(id)))) throw new Error('AI returned an unknown source ID');
        } catch (error) {
          return c.json({ status: 'needs_human', reason: error instanceof Error ? error.message : 'AI result could not be verified' });
        }
      }
      const id = crypto.randomUUID();
      ctx.db.prepare('INSERT INTO agent_run (id, case_id, seat, mode, status, model, tokens_in, tokens_out, ms) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?)')
        .run(id, bundle.case.id, 'verification_analyst', mode, 'ok', mode === 'live' ? ctx.env.ANTHROPIC_MODEL_REASONING : null, Date.now() - started);
      appendAudit(ctx.db, { caseId: bundle.case.id, who: AI, kind: 'ai', action: 'final_review.run', entity: 'agent_run', entityId: id, data: { mode, findingCount: result.findings.length } });
      return c.json({ status: 'ok', mode, prov: mode === 'live' ? 'live' : 'fixture', runId: id, ...result });
    });
  },
  status(ctx) {
    return stubStatus('anthropic', ctx.env.AI_MODE === 'live' && ctx.env.ANTHROPIC_API_KEY ? 'live' : 'fixture', 'Claude roles', ctx.env.AI_DAILY_RUN_LIMIT);
  },
};
