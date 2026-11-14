import { z } from 'zod';
import { IsoDate, Prov } from './common';

export const CallOutcome = z.enum(['verified', 'contradicts', 'refused', 'no_answer', 'voicemail']);
export type CallOutcome = z.infer<typeof CallOutcome>;

export const Call = z.object({
  id: z.string(),
  caseId: z.string(),
  questionId: z.string().nullable(),
  counterpart: z.enum(['employer', 'landlord']),
  contactAlias: z.string(),
  mode: z.enum(['fixture', 'sim', 'human', 'pstn']),
  status: z.enum(['briefing', 'live', 'taken_over', 'ended']),
  outcome: CallOutcome.nullable(),
  consentBy: z.string().nullable(),
  startedAt: IsoDate.nullable(),
  durationS: z.number().nullable(),
  brief: z.object({
    who: z.string(),
    why: z.string(),
    questions: z.array(z.string()).min(1).max(7),
    doNotDisclose: z.array(z.string()),
  }),
  prov: Prov,
});
export type Call = z.infer<typeof Call>;

export const CallTurn = z.object({
  id: z.string(),
  callId: z.string(),
  speaker: z.enum(['agent', 'counterpart', 'worker']),
  text: z.string(),
  tStart: z.number(),
  tEnd: z.number(),
});
export type CallTurn = z.infer<typeof CallTurn>;

export const CallFact = z.object({
  id: z.string(),
  callId: z.string(),
  field: z.string(),
  value: z.string(),
  quote: z.string(),
  turnIds: z.array(z.string()),
  tStart: z.number(),
  tEnd: z.number(),
  confidence: z.number().min(0).max(1),
  status: z.enum(['pending', 'accepted', 'rejected']),
});
export type CallFact = z.infer<typeof CallFact>;
