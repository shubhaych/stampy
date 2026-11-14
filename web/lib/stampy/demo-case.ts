/**
 * The demo case: three generated files for one household, with one error a busy caseworker can miss.
 * The case record budgets one $1,240 paycheck a month. The payment history shows the same paycheck landing
 * every two weeks (two in August), and the tax record agrees with 26 paychecks a year.
 * Everything here is synthetic. The Data page shows the files with the problem circled; Apply uploads the
 * same files unmarked, carrying the name typed on the form.
 */
export interface DemoFile { key: 'record' | 'tax' | 'payments'; title: string; blurb: string; filename: string; svg: string }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const PAY = '$1,240.00';
export const DEMO_NAME = 'Lena Torres';

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

export function demoFiles(applicant = DEMO_NAME, marked = false): DemoFile[] {
  const name = applicant.trim() || DEMO_NAME;
  const last = name.split(/\s+/).slice(-1)[0]!;
  const members = [name, `Maya ${last}`, `Leo ${last}`];
  const address = '418 Alder Street, Fresno, CA 93721';
  const employer = 'Harbor Lane Grocery';

  const record = page('Application for Food Assistance (SNAP)', 'Household information as recorded in the case file', [
    row(170, 'Applicant name', name),
    row(240, 'Home address', address),
    row(310, 'State', 'CA'),
    row(380, 'Number of people in the household', '3'),
    row(450, 'Household members (everyone who buys and prepares food together)', members.join('; ')),
    row(520, 'Employer', employer),
    row(590, 'Gross pay per paycheck (before taxes)', PAY),
    `<text x="60" y="660" font-size="12" fill="#6b5f57">How often is the applicant paid?</text>`,
    ...['Weekly', 'Biweekly', 'Twice a month', 'Monthly'].map((f, i) => box(60 + i * 180, 690, f, f === 'Monthly')),
    `<line x1="60" y1="706" x2="790" y2="706" stroke="#e7ded4"/>`,
    row(740, 'Monthly rent', '$950.00'),
    row(830, 'Applicant signature', name),
    row(900, 'Date signed (application date)', '11/02/2026'),
    marked ? ring(585, 664, 130, 40) : '',
  ].join('\n'));

  const tax = page('Form W-2 Wage and Tax Statement', 'Tax year 2025 · Copy C for employee records', [
    row(170, 'Employee', name),
    row(240, 'Employee address', address),
    row(310, 'Employer', employer),
    row(380, 'Employer address', '2200 Fulton Street, Fresno, CA 93721'),
    row(450, 'Box 1 · Wages, tips, other compensation for the year 2025', '$32,240.00'),
    row(520, 'Box 2 · Federal income tax withheld for the year 2025', '$1,934.40'),
    row(590, 'Box 16 · State wages for the year 2025', '$32,240.00'),
    row(660, 'Paychecks issued in 2025', '26'),
    marked ? ring(46, 662, 84, 34) : '',
  ].join('\n'));

  const dates = ['07/17/2026', '07/31/2026', '08/14/2026', '08/28/2026', '09/11/2026', '09/25/2026', '10/09/2026', '10/23/2026'];
  const payments = page(`${employer} · Payment history`, 'Payroll record for the employee, most recent pay dates last', [
    row(170, 'Employee', name),
    row(240, 'Pay frequency', 'Biweekly'),
    `<rect x="60" y="310" width="730" height="34" fill="#f4eee6"/><text x="72" y="332" font-size="13" font-weight="700">Pay date</text><text x="330" y="332" font-size="13" font-weight="700">Pay period</text><text x="778" y="332" font-size="13" font-weight="700" text-anchor="end">Gross pay</text>`,
    ...dates.map((d, i) => {
      const y = 374 + i * 44;
      const [m, day, yr] = d.split('/').map(Number) as [number, number, number];
      const end = new Date(Date.UTC(yr, m - 1, day - 5)), start = new Date(end.getTime() - 13 * 86_400_000);
      const f = (x: Date) => `${String(x.getUTCMonth() + 1).padStart(2, '0')}/${String(x.getUTCDate()).padStart(2, '0')}/${x.getUTCFullYear()}`;
      return `<text x="72" y="${y}" font-size="16">${d}</text><text x="330" y="${y}" font-size="16">${f(start)} to ${f(end)}</text><text x="778" y="${y}" font-size="16" text-anchor="end">${PAY}</text><line x1="60" y1="${y + 14}" x2="790" y2="${y + 14}" stroke="#e7ded4"/>`;
    }),
    marked ? ring(54, 432, 150, 84) : '',
    marked ? ring(46, 242, 130, 34) : '',
  ].join('\n'));

  return [
    { key: 'record', title: 'Household record', blurb: 'Name, address, household and the income the case file budgets', filename: 'household-record.png', svg: record },
    { key: 'tax', title: 'Tax record', blurb: 'Last year’s W-2 from the employer', filename: 'tax-record-w2.png', svg: tax },
    { key: 'payments', title: 'Payment history', blurb: 'The employer’s payroll record, paycheck by paycheck', filename: 'payment-history.png', svg: payments },
  ];
}

export const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
