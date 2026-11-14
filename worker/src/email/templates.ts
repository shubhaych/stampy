/**
 * Email wording. Deterministic templates filled from the open questions: the AI never writes free text
 * to the applicant. Minimum disclosure: no benefit amounts, no eligibility statements, no accusations.
 */
import type { Question } from '@stampy/contracts/stampy';
import { env } from '../env';

const spaced = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;
const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;
const prettyPhone = (e164: string | null) => {
  const m = e164?.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
};

export function requestEmail(input: { name: string; refCode: string; phone: string | null; questions: Question[] }) {
  const phoneQs = input.questions.filter((q) => q.channel === 'phone' && q.status === 'open');
  const docQs = input.questions.filter((q) => q.channel === 'document' && q.status === 'open');
  const subject = `Your food assistance application: a few things to confirm (ref ${spaced(input.refCode)})`;
  const lines = [
    `Hi ${first(input.name)},`,
    '',
    `Thanks for applying. Before your application can be finished, ${env.AGENCY_NAME} needs to confirm ${phoneQs.length + docQs.length === 1 ? 'one thing' : 'a few things'}:`,
    '',
    ...phoneQs.map((q, i) => `${i + 1}. ${q.title}: ${q.ask}`),
    ...docQs.map((q, i) => `${phoneQs.length + i + 1}. ${q.title}: ${q.ask}`),
    '',
    input.phone
      ? `The quickest way: call ${prettyPhone(input.phone)} whenever it suits you, any time of day. An automated assistant will answer, ask your reference number, and take your answers. You can ask for a person to call you back at any point.`
      : 'Reply to this email with your answers.',
    '',
    `Your reference number: ${spaced(input.refCode)}`,
    '',
    docQs.length ? 'For documents, you can reply to this email with a clear photo of each page.' : '',
    '',
    `${env.AGENCY_NAME[0]!.toUpperCase()}${env.AGENCY_NAME.slice(1)}`,
    '(Stampy demo. Synthetic case; no real benefits are affected.)',
  ];
  return { subject, text: lines.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n') };
}

export function checklistEmail(input: { name: string; refCode: string; closed: Question[]; stillNeeded: Question[] }) {
  const lines = [
    `Hi ${first(input.name)},`,
    '',
    'Thanks for calling.',
    ...(input.closed.length ? ['', 'What you confirmed on the call:', ...input.closed.map((q) => `- ${q.title}: ${q.closedNote?.replace(/^closed:\s*/, '') ?? q.resolvedValue ?? 'confirmed'}`)] : []),
    '',
    'What we still need from you:',
    ...input.stillNeeded.map((q, i) => `${i + 1}. ${q.ask}`),
    '',
    'Just reply to this email with a photo attached. Make sure the whole page is in the picture and the numbers are readable.',
    '',
    `Reference number: ${spaced(input.refCode)}`,
    '(Stampy demo. Synthetic case; no real benefits are affected.)',
  ];
  return { text: lines.join('\n') };
}
