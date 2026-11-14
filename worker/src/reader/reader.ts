/**
 * Document reader (Claude vision). Reads one document into ledger facts, each cited to a page and the
 * exact printed line. It never compares values or decides anything: the conflict detector does that.
 * Unreadable or unsupported files go to a person (needs_person), never to a guess.
 */
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { FACT_FIELDS, type BBox } from '@stampy/contracts/stampy';
import type { Q } from '../db';
import { env } from '../env';
import { audit } from '../core/audit';
import { AI, SYSTEM } from '../core/authz';
import { consume } from '../core/limits';
import { appendFact } from '../ledger/facts';
import { normalizeField } from '../ledger/normalize';
import { sampleBySha, type SampleField } from './samples';

const Extraction = z.object({
  kind: z.enum(['application_form', 'paystub', 'lease', 'other']),
  summary: z.string().describe('One plain sentence describing the document.'),
  readable: z.boolean(),
  unreadable_reason: z.string().nullable(),
  fields: z.array(
    z.object({
      field: z.enum(FACT_FIELDS),
      value: z.string().describe('The value exactly as printed, e.g. "$1,240.00", "Biweekly", "09/25/2026".'),
      line: z.string().describe('The full printed line or table row containing the value, verbatim.'),
      page: z.number().int(),
      bbox: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).nullable()
        .describe('Box around the value, as fractions (0..1) of the page width/height from the top-left; null if unsure.'),
      confidence: z.number().describe('0..1'),
    }),
  ),
});
type Extraction = z.infer<typeof Extraction>;

const SYSTEM_PROMPT = `You read documents for a SNAP (food assistance) caseworker's second check before benefits are issued.
Extract only what is printed on the document. Never infer, compute, or correct a value. If a field is not on the document, leave it out.
Field guide:
- applicant_name: the applicant's or employee's name.
- application_date: the date the application was signed or filed.
- state: two-letter state of the applicant's address.
- household_size: number of people listed in the household.
- household_members: everyone listed as living in the household or occupying the home, separated by "; ".
- employer_name, gross_pay_amount (gross pay for this pay period, before deductions; on an application, the gross pay the applicant reported), pay_frequency (as printed or as checked, e.g. "Biweekly", "Monthly"), pay_date, pay_period_start, pay_period_end.
- monthly_rent, tenant_names (tenants who signed), utilities_included (which utilities the landlord pays).
For a checkbox question like "How often are you paid?", the value is the option that is checked.
"line" must be copied verbatim from the document so a person can find it. Pages are numbered from 1.
If the image is not a document or cannot be read, set readable=false and explain in unreadable_reason.`;

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }));

async function extractWithClaude(bytes: Buffer, contentType: string): Promise<Extraction> {
  const data = bytes.toString('base64');
  const source =
    contentType === 'application/pdf'
      ? ({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } } as const)
      : ({ type: 'image', source: { type: 'base64', media_type: contentType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp', data } } as const);
  const response = await anthropic().messages.parse({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    output_config: { effort: 'medium', format: zodOutputFormat(Extraction) },
    messages: [{ role: 'user', content: [source, { type: 'text', text: 'Read this document and return the fields.' }] }],
  });
  if (response.stop_reason === 'refusal') throw new Error('the model declined to read this document');
  if (!response.parsed_output) throw new Error(`unparseable reader output (stop_reason ${response.stop_reason})`);
  return response.parsed_output;
}

function fromSample(fields: SampleField[], kind: string, summary: string): Extraction {
  return {
    kind: (['application_form', 'paystub', 'lease'].includes(kind) ? kind : 'other') as Extraction['kind'],
    summary, readable: true, unreadable_reason: null,
    fields: fields.map((f) => ({ field: f.field as Extraction['fields'][number]['field'], value: f.value, line: f.line, page: f.page, bbox: f.bbox, confidence: f.confidence })),
  };
}

const clampBox = (b: BBox | null): BBox | null => {
  if (!b) return null;
  const c = (v: number) => Math.max(0, Math.min(1, v));
  const box = { x: c(b.x), y: c(b.y), w: c(b.w), h: c(b.h) };
  return box.w > 0 && box.h > 0 ? box : null;
};

function sourceLabel(kind: string, fields: Extraction['fields'], source: 'upload' | 'email'): string {
  const get = (f: string) => fields.find((x) => x.field === f)?.value;
  const via = source === 'email' ? ' (emailed)' : '';
  if (kind === 'application_form') return `Application form${get('application_date') ? `, signed ${get('application_date')}` : ''}`;
  if (kind === 'paystub') return `Paystub${get('pay_date') ? `, pay date ${get('pay_date')}` : ''}${via}`;
  if (kind === 'lease') return `Lease${via}`;
  return `Document${via}`;
}

export interface ReadResult { ok: boolean; facts: number; kind: string; error?: string }

/** Read one stored document into the ledger. Idempotent per document: a document already read is skipped. */
export async function readDocument(db: Q, docId: string): Promise<ReadResult> {
  const r = await db.query(`UPDATE document SET read_status='reading' WHERE id=$1 AND read_status IN ('pending','failed') RETURNING id, case_id, filename, content_type, bytes, sha256, synthetic, source`, [docId]);
  const doc = r.rows[0] as { id: string; case_id: string; filename: string; content_type: string; bytes: Buffer; sha256: string; synthetic: boolean; source: 'upload' | 'email' } | undefined;
  if (!doc) return { ok: false, facts: 0, kind: 'unknown', error: 'already read or missing' };

  const fail = async (status: 'failed' | 'needs_person', error: string): Promise<ReadResult> => {
    await db.query(`UPDATE document SET read_status=$2, read_error=$3 WHERE id=$1`, [doc.id, status, error]);
    await audit(db, { caseId: doc.case_id, who: AI, kind: 'ai', action: 'document.read_failed', entity: 'document', entityId: doc.id, data: { docId: doc.id, error, source: doc.source } });
    return { ok: false, facts: 0, kind: 'unknown', error };
  };

  if (doc.content_type !== 'application/pdf' && !IMAGE_TYPES.has(doc.content_type)) {
    return fail('needs_person', `Unsupported file type ${doc.content_type}; a person needs to look at it.`);
  }

  const sample = sampleBySha(doc.sha256);
  let ex: Extraction;
  let mode: 'live' | 'fixture';
  const t = Date.now();
  try {
    if (env.AI_MODE === 'live') {
      await consume(db, 'ai_run', env.AI_DAILY_RUN_LIMIT);
      ex = await extractWithClaude(doc.bytes, doc.content_type);
      mode = 'live';
    } else if (sample) {
      ex = fromSample(sample.fields, sample.kind, sample.summary);
      mode = 'fixture';
    } else {
      return fail('needs_person', 'AI document review is offline (fixture mode) and this is not a sample document.');
    }
  } catch (e) {
    return fail('failed', (e as Error).message.slice(0, 300));
  }
  if (!ex.readable) return fail('needs_person', ex.unreadable_reason ?? 'The reader could not read this document.');

  // On the generated demo documents the layout is known exactly: when Claude's value matches the
  // printed value, use the generator's box for the overlay (the value itself is still Claude's read).
  const exactBox = (field: string, value: string): BBox | null => {
    const s = sample?.fields.find((f) => f.field === field);
    return s && normalizeField(field, s.value) === normalizeField(field, value) ? s.bbox : null;
  };

  const label = sourceLabel(ex.kind, ex.fields, doc.source);
  const sourceKind = ex.kind === 'application_form' ? 'application_form' : 'document';
  let n = 0;
  for (const f of ex.fields) {
    if (!f.value.trim()) continue;
    await appendFact(db, {
      caseId: doc.case_id, field: f.field, value: f.value.trim(), sourceKind, sourceRef: doc.id, sourceLabel: label,
      page: f.page || 1, line: f.line, bbox: exactBox(f.field, f.value) ?? clampBox(f.bbox), confidence: f.confidence,
      prov: doc.synthetic ? 'synthetic' : mode === 'live' ? 'live' : 'fixture', createdBy: mode === 'live' ? `ai:${env.ANTHROPIC_MODEL}` : 'ai:fixture',
    }, mode === 'live' ? AI : SYSTEM);
    n++;
  }
  await db.query(`UPDATE document SET read_status='read', kind=$2, summary=$3, read_error=NULL WHERE id=$1`, [doc.id, ex.kind, ex.summary]);
  await audit(db, { caseId: doc.case_id, who: AI, kind: 'ai', action: 'document.read', entity: 'document', entityId: doc.id, data: { docId: doc.id, kind: ex.kind, source: doc.source, facts: n, mode, ms: Date.now() - t, model: mode === 'live' ? env.ANTHROPIC_MODEL : null } });
  return { ok: true, facts: n, kind: ex.kind };
}
