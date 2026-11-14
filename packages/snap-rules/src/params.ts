import params from '../params/fy2027.json';

export interface Param<T = number | null> { value: T; source: string; verified: boolean }
export type Fy2027Params = typeof params;
/** FY2027 parameters. Every value carries a source; null means not yet loaded (rules feature fills these). */
export const FY2027 = params;
