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
  const phone = prettyPhone(input.phone);
  const subject = phone
    ? `Please call ${phone} about your food assistance application (ref ${spaced(input.refCode)})`
    : `Your food assistance application: a few things to confirm (ref ${spaced(input.refCode)})`;
  const agency = `${env.AGENCY_NAME[0]!.toUpperCase()}${env.AGENCY_NAME.slice(1)}`;
  const lines = [
    `Hi ${first(input.name)},`,
    '',
    `Thanks for applying. We need to confirm ${phoneQs.length + docQs.length === 1 ? 'one thing' : 'a few things'} before we can finish your application.`,
    '',
    ...(phone
      ? [
          `Please give us a call at ${phone}.`,
          'Call when it suits you.',
          `Have your reference number ready: ${spaced(input.refCode)}`,
          '',
          ...(phoneQs.length ? ['On the call we will ask:', ...phoneQs.map((q) => `- ${q.ask}`), ''] : []),
          'An automated assistant answers. You can ask for a person to call you back at any point.',
        ]
      : [...phoneQs.map((q, i) => `${i + 1}. ${q.ask}`), '', 'Reply to this email with your answers.', '', `Your reference number: ${spaced(input.refCode)}`]),
    '',
    ...(docQs.length
      ? ['We also need a document from you:', ...docQs.map((q) => `- ${q.ask}`), 'You can reply to this email with a clear photo of it, or we will remind you after your call.', '']
      : []),
    agency,
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
  ];
  return { text: lines.join('\n') };
}
