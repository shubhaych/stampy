/**
 * Replay cases: turn one public QC record into a small synthetic case file a caseworker can review.
 *
 * What comes from the record: state, sample month, certified household size, issued benefit, QC-verified
 * monthly earnings and rent. What is generated: names, employer, landlord, and the pay-frequency box
 * ticked on the application form, which is set so the file disagrees in the same direction as the QC
 * finding. QC values are only ever printed on the generated documents; they are not returned as data.
 * Replay cases demonstrate the pipeline. They are not a measure of how often Stampy finds anything.
 */
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadSnapshot, QC_DIRECTORY } from './store';
import type { PublicRecord } from './ingest';

interface Verified { earnedMonthly: number; rentMonthly: number; direction: 'over' | 'under' }
let cache: { key: string; rows: Map<string, Verified> } | null = null;

/** One pass over the public CSV (no quoted fields in this release), keeping only replay-eligible rows. */
function verifiedRows(directory: string): Map<string, Verified> {
  const path = join(directory, 'qc_pub_fy2024.csv');
  const key = `${path}:${statSync(path).mtimeMs}`;
  if (cache?.key === key) return cache.rows;
  const text = readFileSync(path, 'utf8');
  const end = text.indexOf('\n');
  const header = text.slice(text.charCodeAt(0) === 0xfeff ? 1 : 0, end).trim().split(',');
  const col = (name: string) => { const i = header.indexOf(name); if (i < 0) throw new Error(`QC column ${name} is missing`); return i; };
  const [hh, status, element, earn, rent, size, error] = ['HHLDNO', 'STATUS', 'ELEMENT1', 'FSEARN', 'RENT', 'CERTHHSZ', 'AMTERR'].map(col) as [number, number, number, number, number, number, number];
  const rows = new Map<string, Verified>();
  let start = end + 1;
  while (start < text.length) {
    let stop = text.indexOf('\n', start);
    if (stop < 0) stop = text.length;
    const v = text.slice(start, stop).split(',');
    start = stop + 1;
    if (v.length !== header.length) continue;
    const s = v[status]!.trim();
    // Wage findings only (element 311), with earnings and rent on file and a household small enough to print.
    if ((s !== '2' && s !== '3') || v[element]!.trim() !== '311') continue;
    const earned = Number(v[earn]), rentMonthly = Number(v[rent]), people = Number(v[size]);
    if (!(earned >= 400 && earned <= 6000) || !(rentMonthly >= 200) || !(people >= 1 && people <= 5) || !(Number(v[error]) >= 40)) continue;
    rows.set(`qc-2024-${v[hh]!.trim()}`, { earnedMonthly: earned, rentMonthly, direction: s === '2' ? 'over' : 'under' });
  }
  cache = { key, rows };
  return rows;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface FeaturedRecord extends PublicRecord { outreach: ('email' | 'call')[] }

/** A random handful of replay-eligible records, half from each direction, without saying which is which. */
export function featured(seed: number, limit: number, directory = QC_DIRECTORY): { items: FeaturedRecord[]; pool: number } | null {
  const snapshot = loadSnapshot(directory);
  if (!snapshot) return null;
  const rows = verifiedRows(directory);
  const random = rng(seed);
  const pick = (direction: Verified['direction'], n: number) => {
    const pool = snapshot.records.filter((r) => rows.get(r.id)?.direction === direction && r.benefitMonthly !== null && r.householdSize !== null);
    const out: PublicRecord[] = [];
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(random() * pool.length), 1)[0]!);
    return out;
  };
  const half = Math.ceil(limit / 2);
  const items = [...pick('over', half), ...pick('under', limit - half)]
    .map((r) => ({ r, k: random() })).sort((a, b) => a.k - b.k)
    .map(({ r }): FeaturedRecord => ({ ...r, outreach: ['email', 'call'] }));
  return { items, pool: rows.size };
}

/* ---------------- generated documents ---------------- */

const FIRST = ['Maria', 'James', 'Linh', 'Andre', 'Rosa', 'Samuel', 'Priya', 'Devon', 'Elena', 'Marcus', 'Hana', 'Luis', 'Grace', 'Omar', 'Nadia', 'Caleb'];
const LAST = ['Alvarez', 'Bennett', 'Tran', 'Coleman', 'Dominguez', 'Ellis', 'Farouk', 'Greene', 'Herrera', 'Iverson', 'Jensen', 'Kowalski', 'Lindqvist', 'Moreno', 'Novak', 'Okafor'];
const EMPLOYER = ['Harbor Street Grocery', 'Lakeview Home Care', 'Northside Distribution', 'Cedar Ridge Diner', 'Sunrise Laundry Services', 'Valley Building Supply', 'Maple Court Assisted Living', 'Riverbend Auto Parts'];
const LANDLORD = ['Parkside Property Management', 'Elm Street Rentals', 'Orchard Lane Apartments', 'Granite Realty Group', 'Willow Creek Housing', 'Summit View Properties'];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const mdy = (d: Date) => `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}/${d.getUTCFullYear()}`;
const days = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

function page(title: string, sub: string, body: string, record: PublicRecord): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="850" height="1100" viewBox="0 0 850 1100" font-family="Helvetica, Arial, sans-serif" fill="#1f1a17">
<rect width="850" height="1100" fill="#ffffff"/>
<text x="60" y="84" font-size="26" font-weight="700">${esc(title)}</text>
<text x="60" y="110" font-size="13" fill="#6b5f57">${esc(sub)}</text>
<line x1="60" y1="128" x2="790" y2="128" stroke="#1f1a17" stroke-width="1.5"/>
${body}
<line x1="60" y1="1040" x2="790" y2="1040" stroke="#d9cfc4"/>
<text x="60" y="1062" font-size="11" fill="#6b5f57">Synthetic document generated from USDA SNAP QC FY2024 public record ${esc(record.householdId)} (${esc(record.state)}). No real applicant.</text>
</svg>`;
}

const row = (y: number, label: string, value: string) =>
  `<text x="60" y="${y}" font-size="12" fill="#6b5f57">${esc(label)}</text><text x="60" y="${y + 24}" font-size="18">${esc(value)}</text><line x1="60" y1="${y + 36}" x2="790" y2="${y + 36}" stroke="#e7ded4"/>`;

const box = (x: number, y: number, label: string, on: boolean) =>
  `<rect x="${x}" y="${y - 14}" width="16" height="16" fill="none" stroke="#1f1a17" stroke-width="1.4"/>${on ? `<path d="M${x + 3} ${y - 6} l4 5 l7 -10" fill="none" stroke="#1f1a17" stroke-width="2.4"/>` : ''}<text x="${x + 24}" y="${y}" font-size="16">${label}</text>`;

export interface ReplayDocument { name: string; filename: string; svg: string }
export interface ReplayFile {
  record: PublicRecord; applicantName: string; applicationDate: string;
  documents: ReplayDocument[]; reply: ReplayDocument;
}

export function replayFile(id: string, directory = QC_DIRECTORY): ReplayFile | null {
  const snapshot = loadSnapshot(directory);
  const record = snapshot?.records.find((r) => r.id === id);
  const verified = record ? verifiedRows(directory).get(id) : undefined;
  if (!record || !verified || record.householdSize === null) return null;
  const n = Number(record.householdId);
  const last = LAST[(n * 7) % LAST.length]!;
  const members = Array.from({ length: record.householdSize }, (_, i) => `${FIRST[(n + i * 5) % FIRST.length]!} ${last}`);
  const name = members[0]!;
  const employer = EMPLOYER[n % EMPLOYER.length]!;
  const landlord = LANDLORD[n % LANDLORD.length]!;
  const [year, month] = record.sampleMonth.split('-').map(Number) as [number, number];
  const applied = new Date(Date.UTC(year, month - 1, 4 + (n % 9)));
  // QC earnings are monthly. A biweekly check is the monthly figure times 12 pay months over 26 checks.
  const perCheck = Math.round((verified.earnedMonthly * 12) / 26 * 100) / 100;
  const filedFrequency = verified.direction === 'over' ? 'Monthly' : 'Weekly';
  const address = `${100 + (n % 880)} ${['Alder', 'Birch', 'Cypress', 'Dogwood', 'Juniper', 'Laurel'][n % 6]} Street, Unit ${1 + (n % 24)}, ${record.stateName}`;
  const file = (kind: string) => `${record.id}-${kind}.png`;

  const form = page('Application for Food Assistance (SNAP)', `${record.stateName} · Household section and income section`, [
    row(170, 'Applicant name', name),
    row(240, 'Home address', address),
    row(310, 'State', record.state),
    row(380, 'Number of people in the household', String(record.householdSize)),
    row(450, 'Household members (everyone who buys and prepares food together)', members.join('; ')),
    row(520, 'Employer', employer),
    row(590, 'Gross pay per paycheck (before taxes)', usd(perCheck)),
    `<text x="60" y="660" font-size="12" fill="#6b5f57">How often are you paid?</text>`,
    ...['Weekly', 'Biweekly', 'Twice a month', 'Monthly'].map((f, i) => box(60 + i * 180, 690, f, f === filedFrequency)),
    `<line x1="60" y1="706" x2="790" y2="706" stroke="#e7ded4"/>`,
    row(740, 'Monthly rent', usd(verified.rentMonthly)),
    row(830, 'Applicant signature', name),
    row(900, 'Date signed (application date)', mdy(applied)),
  ].join('\n'), record);

  const stub = (payDate: Date, tag: string): ReplayDocument => {
    const endPeriod = days(payDate, -5), startPeriod = days(endPeriod, -13);
    const tax = Math.round(perCheck * 0.0765 * 100) / 100;
    return {
      name: tag, filename: file(tag),
      svg: page(employer, 'Earnings statement', [
        row(170, 'Employee', name),
        row(240, 'Pay frequency', 'Biweekly'),
        row(310, 'Pay period', `${mdy(startPeriod)} to ${mdy(endPeriod)}`),
        row(380, 'Pay date', mdy(payDate)),
        `<rect x="60" y="450" width="730" height="34" fill="#f4eee6"/><text x="72" y="472" font-size="13" font-weight="700">Earnings</text><text x="778" y="472" font-size="13" font-weight="700" text-anchor="end">This period</text>`,
        `<text x="72" y="514" font-size="16">Gross pay</text><text x="778" y="514" font-size="16" text-anchor="end">${usd(perCheck)}</text><line x1="60" y1="528" x2="790" y2="528" stroke="#e7ded4"/>`,
        `<text x="72" y="558" font-size="16">Social Security and Medicare</text><text x="778" y="558" font-size="16" text-anchor="end">-${usd(tax)}</text><line x1="60" y1="572" x2="790" y2="572" stroke="#e7ded4"/>`,
        `<text x="72" y="606" font-size="16" font-weight="700">Net pay</text><text x="778" y="606" font-size="16" font-weight="700" text-anchor="end">${usd(perCheck - tax)}</text>`,
      ].join('\n'), record),
    };
  };

  const lease = page('Residential Lease Agreement', landlord, [
    row(170, 'Landlord', landlord),
    row(240, 'Tenant (signed)', name),
    row(310, 'Rental unit', address),
    row(380, 'Lease term', `12 months beginning ${mdy(days(applied, -200))}`),
    row(450, 'Monthly rent', usd(verified.rentMonthly)),
    row(520, 'Rent due', 'On the first day of each month'),
    row(590, 'Utilities included in rent', 'None. Tenant pays all utilities.'),
    row(760, 'Tenant signature', name),
    row(830, 'Landlord signature', landlord),
  ].join('\n'), record);

  return {
    record, applicantName: name, applicationDate: applied.toISOString().slice(0, 10),
    documents: [
      { name: 'application', filename: file('application'), svg: form },
      // Dated well before the application so the file also needs a recent paystub from the household.
      stub(days(applied, -47), 'paystub'),
      { name: 'lease', filename: file('lease'), svg: lease },
    ],
    reply: stub(days(applied, -5), 'recent-paystub'),
  };
}
