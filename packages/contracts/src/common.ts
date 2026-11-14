import { z } from 'zod';

/** Direction of a payment-accuracy risk. Over and under always get equal weight. */
export const Direction = z.enum(['over', 'under', 'none']);
export type Direction = z.infer<typeof Direction>;

/** Provenance of every figure. Rendered as a Badge next to the number. */
export const Prov = z.enum(['live', 'replay', 'synthetic', 'fixture', 'sandbox']);
export type Prov = z.infer<typeof Prov>;

/** Page-relative box, all values 0..1. */
export const BBox = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});
export type BBox = z.infer<typeof BBox>;

export const StationId = z.union([
  z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5),
  z.literal(6), z.literal(7), z.literal(8), z.literal(9), z.literal(10),
]);
export type StationId = z.infer<typeof StationId>;

export const Mode = z.enum(['fixture', 'live']);
export type Mode = z.infer<typeof Mode>;

export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'ISO date');

export const PayFrequency = z.enum(['weekly', 'biweekly', 'semimonthly', 'monthly']);
export type PayFrequency = z.infer<typeof PayFrequency>;

/** Identities. `ai` is the server-side identity for every Claude role; it can never act as a human. */
export const ActorRole = z.enum(['worker', 'supervisor', 'ai', 'system', 'household', 'counterpart']);
export type ActorRole = z.infer<typeof ActorRole>;

/** Fail-closed result: anything unreadable becomes needs_human, never a decision. */
export const NeedsHuman = z.object({ status: z.literal('needs_human'), reason: z.string() });
export type NeedsHuman = z.infer<typeof NeedsHuman>;

/** Placeholder text for anything not yet sourced (hard rule 7). */
export const FILL_IN = '<fill in>' as const;
