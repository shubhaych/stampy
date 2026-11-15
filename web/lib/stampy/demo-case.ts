/**
 * The demo case: three generated files for one applicant, with one problem a busy caseworker can miss.
 * Two paystubs carry the same pay date and different gross pay. The case record was budgeted from one of
 * them. Stampy opens one question and calls the applicant to confirm which paystub is right.
 * Everything here is synthetic. The Data page shows the files with the problem circled; Apply uploads the
 * same files unmarked, carrying the name typed on the form.
 */
export interface DemoFile { key: 'record' | 'stubA' | 'stubB'; title: string; blurb: string; filename: string; svg: string }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const PAY_A = '$640.00', PAY_B = '$840.00', PAY_DATE = '10/23/2026';
/** Who the demo case belongs to. Set in web/.env.local; a placeholder name otherwise. */
export const DEMO = {
  name: process.env.NEXT_PUBLIC_DEMO_NAME || 'Jane Doe',
  email: process.env.NEXT_PUBLIC_DEMO_EMAIL || '',
  phone: process.env.NEXT_PUBLIC_DEMO_PHONE || '',
};

const ring = (x: number, y: number, w: number, h: number) =>
  `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="none" stroke="#c0392b" stroke-width="3.5" transform="rotate(-1.5 ${x + w / 2} ${y + h / 2})"/>`;

function page(title: string, sub: string, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="850" height="1100" viewBox="0 0 850 1100" font-family="Helvetica, Arial, sans-serif" fill="#1f1a17">
<rect width="850" height="1100" fill="#ffffff"/>
<text x="60" y="84" font-size="25" font-weight="700">${esc(title)}</text>
<text x="60" y="110" font-size="13" fill="#6b5f57">${esc(sub)}</text>
<line x1="60" y1="128" x2="790" y2="128" stroke="#1f1a17" stroke-width="1.5"/>
${body}
<line x1="60" y1="1040" x2="790" y2="1040" stroke="#d9cfc4"/>
<text x="60" y="1062" font-size="11" fill="#6b5f57">Synthetic demo document. No real applicant, employer or agency.</text>
</svg>`;
}
const row = (y: number, label: string, value: string) =>
  `<text x="60" y="${y}" font-size="12" fill="#6b5f57">${esc(label)}</text><text x="60" y="${y + 24}" font-size="18">${esc(value)}</text><line x1="60" y1="${y + 36}" x2="790" y2="${y + 36}" stroke="#e7ded4"/>`;
const box = (x: number, y: number, label: string, on: boolean) =>
  `<rect x="${x}" y="${y - 14}" width="16" height="16" fill="none" stroke="#1f1a17" stroke-width="1.4"/>${on ? `<path d="M${x + 3} ${y - 6} l4 5 l7 -10" fill="none" stroke="#1f1a17" stroke-width="2.4"/>` : ''}<text x="${x + 24}" y="${y}" font-size="16">${label}</text>`;

export function demoFiles(applicant = DEMO.name, marked = false): DemoFile[] {
  const name = applicant.trim() || DEMO.name;
  const address = '418 Alder Street, Fresno, CA 93721';
  const employer = 'Harbor Lane Grocery';

  const record = page('Application for Food Assistance (SNAP)', 'Household information as recorded in the case file', [
    row(170, 'Applicant name', name),
    row(240, 'Home address', address),
    row(310, 'State', 'CA'),
    row(380, 'Number of people in the household', '1'),
    row(450, 'Household members (everyone who buys and prepares food together)', name),
    row(520, 'Employer', employer),
    row(590, 'Gross pay per paycheck (before taxes)', PAY_A),
    `<text x="60" y="660" font-size="12" fill="#6b5f57">How often is the applicant paid?</text>`,
    ...['Weekly', 'Biweekly', 'Twice a month', 'Monthly'].map((f, i) => box(60 + i * 180, 690, f, f === 'Biweekly')),
    `<line x1="60" y1="706" x2="790" y2="706" stroke="#e7ded4"/>`,
    row(740, 'Monthly rent', '$950.00'),
    row(830, 'Applicant signature', name),
    row(900, 'Date signed (application date)', '11/02/2026'),
    marked ? ring(46, 594, 130, 36) : '',
  ].join('\n'));

  const stub = (gross: string, hours: string, check: string) => {
    const g = Number(gross.replace(/[$,]/g, '')), tax = Math.round(g * 7.65) / 100;
    const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return page(employer, `Earnings statement · Check ${check}`, [
      row(170, 'Employee', name),
      row(240, 'Pay frequency', 'Biweekly'),
      row(310, 'Pay period', '10/05/2026 to 10/18/2026'),
      row(380, 'Pay date', PAY_DATE),
      `<rect x="60" y="450" width="730" height="34" fill="#f4eee6"/><text x="72" y="472" font-size="13" font-weight="700">Earnings</text><text x="778" y="472" font-size="13" font-weight="700" text-anchor="end">This period</text>`,
      `<text x="72" y="514" font-size="16">Hours worked</text><text x="778" y="514" font-size="16" text-anchor="end">${hours}</text><line x1="60" y1="528" x2="790" y2="528" stroke="#e7ded4"/>`,
      `<text x="72" y="558" font-size="16" font-weight="700">Gross pay</text><text x="778" y="558" font-size="16" font-weight="700" text-anchor="end">${gross}</text><line x1="60" y1="572" x2="790" y2="572" stroke="#e7ded4"/>`,
      `<text x="72" y="602" font-size="16">Social Security and Medicare</text><text x="778" y="602" font-size="16" text-anchor="end">-${usd(tax)}</text><line x1="60" y1="616" x2="790" y2="616" stroke="#e7ded4"/>`,
      `<text x="72" y="650" font-size="16" font-weight="700">Net pay</text><text x="778" y="650" font-size="16" font-weight="700" text-anchor="end">${usd(g - tax)}</text>`,
      marked ? ring(46, 384, 140, 36) : '',
      marked ? ring(676, 536, 116, 36) : '',
    ].join('\n'));
  };

  return [
    { key: 'record', title: 'Household record', blurb: 'Name, address, employer and the pay the case file budgets', filename: 'household-record.png', svg: record },
    { key: 'stubA', title: `Paystub, ${PAY_DATE}`, blurb: `Gross pay ${PAY_A}`, filename: 'paystub-1.png', svg: stub(PAY_A, '40.00', '004417') },
    { key: 'stubB', title: `Paystub, ${PAY_DATE}`, blurb: `Gross pay ${PAY_B}`, filename: 'paystub-2.png', svg: stub(PAY_B, '52.50', '004418') },
  ];
}

export const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
