/**
 * Facts ledger (master prompt section 3). The only figures the homepage may show. Each carries its badge and a
 * source id from data/sources.json (labels there; href null until verified). Do not add figures here without a source.
 */
import type { Prov } from '@cleancase/contracts';
import sourcesFile from '../../../data/sources.json';

export interface Source { id: string; label: string; title: string; href: string | null }
const SOURCES = (sourcesFile as { sources: Source[] }).sources;

export function source(id: string): { label: string; href: string | null } {
  const s = SOURCES.find((x) => x.id === id);
  return { label: s?.label ?? '<fill in>', href: s?.href ?? null };
}

export interface Fact { value: string; prov: Prov; src: string; caveat?: string }

export const FACTS = {
  perFy2025: { value: '10.62%', prov: 'replay', src: 'fna-fy2025-per' },
  perFy2025Dollars: { value: '$10.1B', prov: 'replay', src: 'fna-fy2025-per' },
  overFy2025: { value: '9.28%', prov: 'replay', src: 'fna-fy2025-per' },
  underFy2025: { value: '1.33%', prov: 'replay', src: 'fna-fy2025-per' },
  benefitsFy2023: { value: '$90.06B', prov: 'replay', src: 'fns-qc-fy2023' },
  overissuedFy2023: { value: '$9.04B', prov: 'replay', src: 'fns-qc-fy2023' },
  underissuedFy2023: { value: '$1.48B', prov: 'replay', src: 'fns-qc-fy2023' },
  agencyShare: { value: '56.98%', prov: 'replay', src: 'fns-qc-fy2023' },
  agencyShareUnder: { value: '81.99%', prov: 'replay', src: 'fns-qc-fy2023' },
  agencyPoints: { value: '6.65 of 11.68', prov: 'replay', src: 'fns-qc-fy2023' },
  incomeShare: { value: '55.5%', prov: 'replay', src: 'fns-qc-fy2023', caveat: 'Element level only' },
  foundCaseFile: { value: '44.54%', prov: 'replay', src: 'fns-qc-fy2023' },
  foundHousehold: { value: '35.00%', prov: 'replay', src: 'fns-qc-fy2023' },
  foundCollateral: { value: '20.46%', prov: 'replay', src: 'fns-qc-fy2023' },
  tolerance: { value: '$59', prov: 'fixture', src: 'qc-memo-25-04' },
  nyu: { value: 'about 7x', prov: 'replay', src: 'nyu-2026', caveat: 'Public file excludes ineligible households, so projected PER runs a few points below official' },
} satisfies Record<string, Fact>;

export const MARKET: { what: string; figure: string; prov: Prov; src: string }[] = [
  { what: 'Michigan MiCARA pre-certification reviews in 3 months; potential errors identified', figure: '17,500 reviews · $150,000', prov: 'fixture', src: 'proof-news-micara' },
  { what: 'West Virginia emergency purchase of SAS Payment Integrity', figure: '$876,259', prov: 'fixture', src: 'wv-watch-sas' },
  { what: 'Florida appropriation for an ML data analytics solution', figure: '$4M', prov: 'fixture', src: 'newsweek-fl' },
  { what: 'FNA Process and Technology Improvement Grants; Earnings Verification Support', figure: 'up to $2M · $38M', prov: 'fixture', src: 'fna-ptig' },
];
