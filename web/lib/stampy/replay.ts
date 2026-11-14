/**
 * Replay cases in the browser: list real public QC records, and open one as a case by rendering its
 * generated documents to images and uploading them to the worker like any other application.
 * Public records carry no contact details, so outreach goes to the presenter's own test contact.
 */
import { z } from 'zod';
import type { CaseBundleV2 } from '@stampy/contracts/stampy';
import { api, ApiError } from './api';

const Release = z.object({
  fiscalYear: z.number(), sourceUrl: z.string(), dictionaryUrl: z.string(), catalogUrl: z.string(),
  archiveSha256: z.string(), archiveMember: z.string(), retrievedAt: z.string(), rowCount: z.number(),
});
const Record = z.object({
  id: z.string(), householdId: z.string(), state: z.string(), stateName: z.string(), sampleMonth: z.string(),
  householdSize: z.number().nullable(), benefitMonthly: z.number().nullable(), sourceRecord: z.number(),
});
const Featured = z.object({ items: Record.extend({ outreach: z.array(z.enum(['email', 'call'])) }).array(), pool: z.number(), release: Release });
const Doc = z.object({ name: z.string(), filename: z.string(), svg: z.string() });
const ReplayFile = z.object({ record: Record, applicantName: z.string(), applicationDate: z.string(), documents: Doc.array(), reply: Doc });

export type ReplayRecord = z.infer<typeof Featured>['items'][number];
export type ReplayRelease = z.infer<typeof Release>;
export type FeaturedPage = z.infer<typeof Featured>;

async function qc<S extends z.ZodType>(path: string, schema: S): Promise<z.infer<S>> {
  let response: Response;
  try { response = await fetch(`/cases/qc/data/${path}`, { cache: 'no-store' }); }
  catch { throw new ApiError('The public-records service is not running.', 0); }
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(typeof body?.error === 'string' ? body.error : 'Public records could not be loaded.', response.status);
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiError('The public-records service returned an unexpected response.', 502);
  return parsed.data;
}

export const featuredRecords = (seed: number) => qc(`featured?seed=${seed}&limit=6`, Featured);

/* ---------- test contact (browser only) ---------- */

export interface Contact { email: string; phone: string }
const CONTACT_KEY = 'stampy.replay.contact';
const OPENED_KEY = 'stampy.replay.opened';

export function readContact(): Contact | null {
  try {
    const c = JSON.parse(localStorage.getItem(CONTACT_KEY) ?? 'null') as Contact | null;
    return c && c.email && c.phone ? c : null;
  } catch { return null; }
}
export const saveContact = (c: Contact) => localStorage.setItem(CONTACT_KEY, JSON.stringify(c));

export function openedCases(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(OPENED_KEY) ?? '{}') as Record<string, string>; } catch { return {}; }
}

/* ---------- documents ---------- */

async function toPng(svg: string): Promise<Blob> {
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = 1275; canvas.height = 1650;
  canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not render the document.'))), 'image/png'));
}

/** Create a worker case from a public record. Returns the new case id. */
export async function openReplay(recordId: string, contact: Contact, onStep: (step: string) => void): Promise<string> {
  onStep('Building the case file');
  const file = await qc(`cases/${encodeURIComponent(recordId)}/documents`, ReplayFile);
  const form = new FormData();
  form.set('applicantName', file.applicantName);
  form.set('applicantEmail', contact.email);
  form.set('applicantPhone', contact.phone);
  form.set('state', file.record.state);
  for (const d of file.documents) form.append('files', new File([await toPng(d.svg)], d.filename, { type: 'image/png' }));
  onStep('Sending documents to the reader');
  const created = await api.createCase(form);
  localStorage.setItem(OPENED_KEY, JSON.stringify({ ...openedCases(), [recordId]: created.id }));
  return created.id;
}

/** The paystub the household would send back, for attaching to a reply email during a demo. */
export async function replyPaystub(recordId: string): Promise<{ filename: string; blob: Blob }> {
  const file = await qc(`cases/${encodeURIComponent(recordId)}/documents`, ReplayFile);
  return { filename: file.reply.filename, blob: await toPng(file.reply.svg) };
}

/* ---------- recognising a replay case ---------- */

const REPLAY_FILE = /^(qc-\d{4}-\d+)-[a-z-]+\.png$/;

/** The public record a case was built from, read off its document filenames. */
export function replayRecordId(bundle: CaseBundleV2): string | null {
  for (const d of bundle.documents) {
    const m = REPLAY_FILE.exec(d.filename);
    if (m) return m[1]!;
  }
  return null;
}

/** Generated replay documents are synthetic, whatever service read them. Mark them and their facts. */
export function markSynthetic(bundle: CaseBundleV2): CaseBundleV2 {
  const ids = new Set(bundle.documents.filter((d) => REPLAY_FILE.test(d.filename)).map((d) => d.id));
  if (!ids.size) return bundle;
  return {
    ...bundle,
    documents: bundle.documents.map((d) => (ids.has(d.id) ? { ...d, synthetic: true } : d)),
    facts: bundle.facts.map((f) => (f.sourceRef && ids.has(f.sourceRef) ? { ...f, prov: 'synthetic' as const } : f)),
  };
}
