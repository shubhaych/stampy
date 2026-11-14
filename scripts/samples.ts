/**
 * npm run samples — renders the four synthetic demo documents for the Lena Torres case into
 * data/samples/: an image per document plus a sidecar JSON with each field's exact printed text and
 * its bounding box (normalized 0..1 to the final image). Deterministic: no clock, no randomness,
 * fixed viewport, system fonts only, no network. All people, companies and phone numbers are fictional.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { launchChromium } from './samples/browser';
import {
  PAGE_H, PAGE_W, PHOTO_H, PHOTO_W,
  applicationForm, lease, paystub, paystubPhoto,
  type Applicant, type StubData,
} from './samples/templates';
import { ROOT } from './lib';

const OUT = join(ROOT, 'data/samples');

type FieldName =
  | 'applicant_name' | 'application_date' | 'state' | 'household_size' | 'household_members'
  | 'employer_name' | 'gross_pay_amount' | 'pay_frequency' | 'pay_date' | 'pay_period_start'
  | 'pay_period_end' | 'monthly_rent' | 'tenant_names' | 'utilities_included';

type Kind = 'application_form' | 'paystub' | 'lease';

/** `line` overrides the printed line read from the nearest `[data-line]` ancestor. */
interface FieldSpec { field: FieldName; value: string; line?: string }

interface SampleSpec {
  name: string;
  label: string;
  kind: Kind;
  format: 'png' | 'jpeg';
  width: number;
  height: number;
  description: string;
  summary: string;
  uploadByDefault: boolean;
  html: string;
  fields: FieldSpec[];
}

/* ---------------- case facts (all fictional) ---------------- */

const applicant: Applicant = {
  name: 'Lena Torres',
  street: '418 Alder Street',
  apt: '3',
  city: 'Fresno',
  state: 'CA',
  zip: '93721',
  phone: '(559) 555-0142',
  members: [
    { name: 'Lena Torres', age: 34, relationship: 'Self' },
    { name: 'Maya Torres', age: 9, relationship: 'Daughter' },
    { name: 'Leo Torres', age: 6, relationship: 'Son' },
  ],
};
const EMPLOYER = { name: 'Harbor Lane Grocery', street: '2200 Fulton Street', cityLine: 'Fresno, CA 93721', phone: '(559) 555-0168' };
const MEMBERS = applicant.members.map((m) => m.name);

/** Money from integer cents, "1,240.00". */
const money = (cents: number) => (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const RATE = 1550; // cents per hour
const HOURS = 80;
const GROSS = RATE * HOURS; // 124000
const DEDUCTIONS = [
  { label: 'Federal income tax', cents: 4200 },
  { label: 'Social Security', cents: 7688 },
  { label: 'Medicare', cents: 1798 },
  { label: 'CA SDI', cents: 1488 },
];
const DED_TOTAL = DEDUCTIONS.reduce((s, d) => s + d.cents, 0);
const NET = GROSS - DED_TOTAL;
if (NET !== 108826) throw new Error(`net pay arithmetic is off: ${NET}`);

/** A biweekly stub that is the `n`th pay of the year (YTD = n periods). */
function stub(n: number, periodStart: string, periodEnd: string, payDate: string): StubData {
  return {
    employer: EMPLOYER,
    employee: { name: applicant.name, id: '40417', street: `${applicant.street}, Apt ${applicant.apt}`, cityLine: `${applicant.city}, ${applicant.state} ${applicant.zip}` },
    periodStart, periodEnd, payDate,
    frequency: 'Biweekly',
    rate: money(RATE),
    hours: HOURS.toFixed(2),
    ytdHours: (HOURS * n).toLocaleString('en-US', { minimumFractionDigits: 2 }),
    gross: money(GROSS),
    ytdGross: money(GROSS * n),
    deductions: DEDUCTIONS.map((d) => ({ label: d.label, current: money(d.cents), ytd: money(d.cents * n) })),
    totalDeductions: money(DED_TOTAL),
    ytdDeductions: money(DED_TOTAL * n),
    net: money(NET),
    ytdNet: money(NET * n),
  };
}
const SEPT = stub(20, '09/06/2026', '09/19/2026', '09/25/2026');
const OCT = stub(22, '10/04/2026', '10/17/2026', '10/23/2026');
if (SEPT.ytdGross !== '24,800.00' || OCT.ytdGross !== '27,280.00') throw new Error('YTD gross arithmetic is off');

function stubFields(s: StubData): FieldSpec[] {
  return [
    { field: 'applicant_name', value: s.employee.name, line: `Employee: ${s.employee.name}` },
    { field: 'employer_name', value: s.employer.name },
    { field: 'gross_pay_amount', value: `$${s.gross}` },
    { field: 'pay_frequency', value: s.frequency },
    { field: 'pay_date', value: s.payDate },
    { field: 'pay_period_start', value: s.periodStart },
    { field: 'pay_period_end', value: s.periodEnd },
  ];
}

const SAMPLES: SampleSpec[] = [
  {
    name: 'application-form',
    label: 'Application for Food Assistance',
    kind: 'application_form',
    format: 'png',
    width: PAGE_W,
    height: PAGE_H,
    description: 'The signed food-assistance application Lena Torres filed on 11/02/2026.',
    summary: 'Application for a household of 3 in Fresno, CA, reporting $1,240.00 gross pay from Harbor Lane Grocery with "Monthly" ticked as the pay frequency and $950.00 monthly rent.',
    uploadByDefault: true,
    html: applicationForm({
      applicant,
      employerName: EMPLOYER.name,
      employerAddress: `${EMPLOYER.street}, ${EMPLOYER.cityLine}`,
      grossPay: '$1,240.00',
      payFrequency: 'Monthly',
      rent: '$950.00',
      dateSigned: '11/02/2026',
    }),
    fields: [
      { field: 'applicant_name', value: 'Lena Torres', line: 'Full name (first, last): Lena Torres' },
      { field: 'application_date', value: '11/02/2026', line: 'Date signed: 11/02/2026' },
      { field: 'state', value: 'CA', line: 'City: Fresno State: CA ZIP code: 93721' },
      { field: 'household_size', value: '3', line: 'How many people live with you and buy and prepare food with you, including you? 3' },
      { field: 'household_members', value: MEMBERS.join('; '), line: applicant.members.map((m) => `${m.name} ${m.age} ${m.relationship}`).join('; ') },
      { field: 'employer_name', value: 'Harbor Lane Grocery', line: 'Employer name: Harbor Lane Grocery' },
      { field: 'gross_pay_amount', value: '$1,240.00', line: 'Gross pay before taxes: $1,240.00' },
      { field: 'pay_frequency', value: 'Monthly', line: 'How often are you paid? ☐ Weekly ☐ Every two weeks ☐ Twice a month ☒ Monthly' },
      { field: 'monthly_rent', value: '$950.00', line: 'Rent or mortgage: $950.00 per month' },
    ],
  },
  {
    name: 'paystub-2026-09',
    label: 'Pay stub, September 2026',
    kind: 'paystub',
    format: 'png',
    width: PAGE_W,
    height: PAGE_H,
    description: 'Harbor Lane Grocery earnings statement for the 09/06/2026 – 09/19/2026 pay period.',
    summary: 'Biweekly earnings statement for Lena Torres: 80.00 hours at $15.50 for $1,240.00 gross and $1,088.26 net, paid 09/25/2026, YTD gross $24,800.00.',
    uploadByDefault: true,
    html: paystub(SEPT),
    fields: stubFields(SEPT),
  },
  {
    name: 'lease',
    label: 'Residential lease, page 1',
    kind: 'lease',
    format: 'png',
    width: PAGE_W,
    height: PAGE_H,
    description: 'Page 1 of the lease for 418 Alder Street, Apt 3, Fresno, CA 93721.',
    summary: 'Lease from Alder Street Properties LLC (fictional) to Lena Torres for 03/01/2026 to 02/28/2027 at $950.00 per month, with three occupants; landlord pays water and trash, tenant pays electricity and gas.',
    uploadByDefault: true,
    html: lease({
      landlord: 'Alder Street Properties LLC (fictional)',
      landlordPhone: '(559) 555-0187',
      tenant: applicant.name,
      occupants: MEMBERS.join(', '),
      premises: `${applicant.street}, Apt ${applicant.apt}, ${applicant.city}, ${applicant.state} ${applicant.zip}`,
      termStart: '03/01/2026',
      termEnd: '02/28/2027',
      rent: '$950.00',
      landlordPays: 'water and trash',
      tenantPays: 'electricity and gas',
    }),
    fields: [
      { field: 'tenant_names', value: 'Lena Torres' },
      { field: 'household_members', value: MEMBERS.join(', ') },
      { field: 'monthly_rent', value: '$950.00' },
      { field: 'utilities_included', value: 'water and trash' },
    ],
  },
  {
    name: 'paystub-2026-10-photo',
    label: 'Pay stub photo, October 2026',
    kind: 'paystub',
    format: 'jpeg',
    width: PHOTO_W,
    height: PHOTO_H,
    description: 'Phone photo of the Harbor Lane Grocery stub for 10/04/2026 – 10/17/2026, emailed in later by the applicant.',
    summary: 'Photo of a biweekly earnings statement for Lena Torres: 80.00 hours at $15.50 for $1,240.00 gross and $1,088.26 net, paid 10/23/2026, YTD gross $27,280.00.',
    uploadByDefault: false,
    html: paystubPhoto(OCT),
    fields: stubFields(OCT),
  },
];

/* ---------------- rendering ---------------- */

interface Measured { field: string; text: string; line: string; rects: { x: number; y: number; w: number; h: number }[] }

/**
 * Runs in the page. Kept as a string: tsx's esbuild transform wraps named functions in a `__name`
 * helper that does not exist inside the browser. getBoundingClientRect of a rotated element is its
 * axis-aligned box in the viewport, which is what the photo sidecar needs.
 */
const MEASURE_JS = `(() => {
  const norm = (s) => s.replace(/\\s+/g, ' ').trim();
  const by = new Map();
  for (const el of document.querySelectorAll('[data-field]')) {
    const f = el.getAttribute('data-field');
    if (!by.has(f)) by.set(f, []);
    by.get(f).push(el);
  }
  return Array.from(by, ([field, els]) => ({
    field,
    text: els.map((el) => el.getAttribute('data-value') ?? norm(el.innerText)).join('; '),
    line: norm(els[0].closest('[data-line]')?.innerText ?? ''),
    rects: els.map((el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }),
  }));
})()`;

async function measure(page: Page): Promise<Measured[]> {
  return (await page.evaluate(MEASURE_JS)) as Measured[];
}

const r4 = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 10000) / 10000;

function unionBox(rects: Measured['rects'], W: number, H: number) {
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.w));
  const y1 = Math.max(...rects.map((r) => r.y + r.h));
  const x = r4(x0 / W);
  const y = r4(y0 / H);
  return { x, y, w: r4(x1 / W - x), h: r4(y1 / H - y) };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const { browser, via } = await launchChromium();
  console.log(`chromium: ${via}`);
  const index: object[] = [];
  try {
    for (const s of SAMPLES) {
      const ctx = await browser.newContext({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: 1, colorScheme: 'light', locale: 'en-US', timezoneId: 'UTC', javaScriptEnabled: true });
      const page = await ctx.newPage();
      await page.setContent(s.html, { waitUntil: 'load' });
      await page.evaluate('document.fonts.ready.then(() => undefined)');

      const measured = await measure(page);
      const fields = s.fields.map((f) => {
        const m = measured.find((x) => x.field === f.field);
        if (!m) throw new Error(`${s.name}: no [data-field="${f.field}"] in template`);
        if (m.text !== f.value) throw new Error(`${s.name}: ${f.field} prints "${m.text}", expected "${f.value}"`);
        const line = f.line ?? m.line;
        if (!line) throw new Error(`${s.name}: ${f.field} has no printed line`);
        if (!f.line && !line.includes(f.value)) throw new Error(`${s.name}: line "${line}" does not contain "${f.value}"`);
        return { field: f.field, value: f.value, page: 1, line, bbox: unionBox(m.rects, s.width, s.height), confidence: 1 };
      });
      const extra = measured.filter((m) => !s.fields.some((f) => f.field === m.field));
      if (extra.length) throw new Error(`${s.name}: template marks fields not in the spec: ${extra.map((e) => e.field).join(', ')}`);

      const ext = s.format === 'png' ? 'png' : 'jpg';
      const filename = `${s.name}.${ext}`;
      const contentType = s.format === 'png' ? 'image/png' : 'image/jpeg';
      const img = await page.screenshot({
        type: s.format,
        ...(s.format === 'jpeg' ? { quality: 82 } : {}),
        clip: { x: 0, y: 0, width: s.width, height: s.height },
        animations: 'disabled',
        caret: 'hide',
        scale: 'css',
      });
      await ctx.close();

      writeFileSync(join(OUT, filename), img);
      const sidecar = {
        name: s.name, label: s.label, filename, contentType, kind: s.kind,
        description: s.description, uploadByDefault: s.uploadByDefault, synthetic: true, summary: s.summary,
        width: s.width, height: s.height,
        fields,
      };
      writeFileSync(join(OUT, `${s.name}.json`), JSON.stringify(sidecar, null, 2) + '\n');
      index.push({ name: s.name, label: s.label, filename, contentType, kind: s.kind, description: s.description, uploadByDefault: s.uploadByDefault });
      const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
      console.log(`  ${filename.padEnd(28)} ${kb(img.length).padStart(9)}  ${s.width}x${s.height}  ${fields.length} fields`);
      console.log(`  ${(s.name + '.json').padEnd(28)} ${kb(readFileSync(join(OUT, `${s.name}.json`)).length).padStart(9)}`);
    }
  } finally {
    await browser.close();
  }
  writeFileSync(join(OUT, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  console.log(`  index.json                   ${index.length} documents -> ${OUT}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
