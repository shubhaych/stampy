/**
 * HTML templates for the four synthetic demo documents. Every person, company, address and phone
 * number here is fictional (phones are 555-01xx). Field values are wrapped in elements carrying
 * `data-field` so the renderer can measure their bounding boxes; `data-line` marks the printed line
 * a field sits on, and `data-value` overrides the measured text where the element also holds a
 * checkbox glyph.
 */

export const WATERMARK = 'SYNTHETIC DEMO DOCUMENT — not a real person or employer';

/** Letter page at 150 dpi. */
export const PAGE_W = 1275;
export const PAGE_H = 1650;

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const SERIF = '"Times New Roman", Times, Georgia, serif';
const MONO = '"Courier New", Courier, monospace';
const HAND = '"Bradley Hand", "Snell Roundhand", "Apple Chancery", cursive';

const BASE_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{margin:0;background:#fff;overflow:hidden}
.page{position:relative;width:${PAGE_W}px;height:${PAGE_H}px;background:#fff;color:#1b1b1b;overflow:hidden;-webkit-font-smoothing:antialiased}
.wm{position:absolute;left:0;right:0;bottom:30px;text-align:center;font:500 14px/1 ${SANS};letter-spacing:.08em;color:#9c9c9c}
.wm::before,.wm::after{content:"";display:inline-block;width:120px;height:1px;background:#cfcfcf;vertical-align:middle;margin:0 18px}
`;

export function doc(css: string, body: string, width = PAGE_W, height = PAGE_H): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}${css}
html,body{width:${width}px;height:${height}px}</style></head><body>${body}</body></html>`;
}

const wm = `<div class="wm">${esc(WATERMARK)}</div>`;

/* ------------------------------------------------------------------ */
/* 1. Application form                                                 */
/* ------------------------------------------------------------------ */

export interface Applicant {
  name: string;
  street: string;
  apt: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  members: { name: string; age: number; relationship: string }[];
}

export interface AppFormData {
  applicant: Applicant;
  employerName: string;
  employerAddress: string;
  grossPay: string;
  payFrequency: 'Weekly' | 'Every two weeks' | 'Twice a month' | 'Monthly';
  rent: string;
  dateSigned: string;
}

const APP_CSS = `
.af{font:19px/1.35 ${SANS};padding:64px 80px 90px}
.af-top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:4px solid #1f3a5f;padding-bottom:18px}
.af-agency{display:flex;gap:18px;align-items:center}
.af-seal{width:78px;height:78px;border:3px solid #1f3a5f;border-radius:50%;display:flex;align-items:center;justify-content:center;font:700 26px/1 ${SERIF};color:#1f3a5f;letter-spacing:.04em}
.af-office{font:700 16px/1.2 ${SANS};letter-spacing:.06em;text-transform:uppercase;color:#1f3a5f}
.af-unit{font-size:15px;color:#555;margin-top:2px}
.af-title{font:700 34px/1.1 ${SANS};margin-top:8px;color:#111}
.af-sub{font-size:17px;color:#444;margin-top:4px}
.af-ouo{border:1.5px solid #555;width:300px;font-size:13px;color:#333}
.af-ouo .h{background:#e6e6e6;font-weight:700;letter-spacing:.08em;padding:5px 10px;border-bottom:1.5px solid #555}
.af-ouo .r{padding:9px 10px 4px;border-bottom:1px solid #bbb;height:36px}
.af-ouo .r:last-child{border-bottom:0}
.af-instr{font-size:15px;color:#333;margin:14px 0 6px}
.sec{display:flex;align-items:center;gap:12px;background:#1f3a5f;color:#fff;font:700 18px/1 ${SANS};padding:8px 12px;margin-top:20px;letter-spacing:.02em}
.sec .n{display:inline-flex;width:26px;height:26px;border-radius:50%;background:#fff;color:#1f3a5f;align-items:center;justify-content:center;font-size:16px}
table.grid{width:100%;border-collapse:collapse;table-layout:fixed}
table.grid td{border:1.5px solid #444;padding:5px 10px 7px;vertical-align:top;height:66px}
.lbl{font-size:13px;color:#444;text-transform:uppercase;letter-spacing:.05em}
.fill{font:700 22px/1.15 ${MONO};color:#1d3270}
.val{margin-top:6px;min-height:26px}
.q{margin-top:12px;display:flex;align-items:baseline;gap:12px}
.q .uline{display:inline-block;min-width:140px;border-bottom:1.5px solid #333;padding:0 8px 2px}
table.hh{width:100%;border-collapse:collapse;margin-top:10px;table-layout:fixed}
table.hh th{background:#ececec;border:1.5px solid #444;font:700 13px/1.2 ${SANS};text-transform:uppercase;letter-spacing:.05em;color:#333;text-align:left;padding:7px 10px}
table.hh td{border:1.5px solid #444;padding:7px 10px;height:44px}
.checks{display:flex;gap:34px;margin-top:10px;align-items:center}
.cb{display:inline-flex;align-items:center;gap:9px;font-size:19px}
.box{display:inline-flex;width:22px;height:22px;border:2px solid #222;align-items:center;justify-content:center;font:700 19px/1 ${SANS};color:#1d3270}
.cert{font-size:16px;color:#222;margin-top:12px;line-height:1.45}
.sig{display:flex;gap:40px;margin-top:22px;align-items:flex-end}
.sig .s{flex:1.6}
.sig .d{flex:1}
.sig .ink{font:700 40px/1 ${HAND};color:#1d2f6e;border-bottom:1.5px solid #222;padding:0 10px 6px;height:56px}
.sig .cap{font-size:13px;color:#444;text-transform:uppercase;letter-spacing:.05em;margin-top:5px}
.sig .dl{border-bottom:1.5px solid #222;padding:0 4px 6px;height:56px;display:flex;align-items:flex-end;gap:12px}
`;

export function applicationForm(d: AppFormData): string {
  const a = d.applicant;
  const opt = (label: AppFormData['payFrequency']) => {
    const on = label === d.payFrequency;
    const inner = `<span class="box">${on ? 'X' : ''}</span>${esc(label)}`;
    return on ? `<span class="cb" data-field="pay_frequency" data-value="${esc(label)}">${inner}</span>` : `<span class="cb">${inner}</span>`;
  };
  const rows = a.members
    .map((m) => `<tr><td><span class="fill" data-field="household_members">${esc(m.name)}</span></td><td><span class="fill">${m.age}</span></td><td><span class="fill">${esc(m.relationship)}</span></td></tr>`)
    .join('');
  const body = `<div class="page af">
  <div class="af-top">
    <div>
      <div class="af-agency">
        <div class="af-seal">SC</div>
        <div><div class="af-office">Stampy County Benefits Office (demo)</div><div class="af-unit">Food Assistance Unit</div></div>
      </div>
      <div class="af-title">Application for Food Assistance</div>
      <div class="af-sub">(CalFresh-style demo form)</div>
    </div>
    <div class="af-ouo"><div class="h">OFFICE USE ONLY</div><div class="r">Date received</div><div class="r">Case worker</div><div class="r">Interview date</div></div>
  </div>
  <div class="af-instr">Please print clearly and answer every question. If a question does not apply to you, write N/A. Keep a copy for your records.</div>

  <div class="sec"><span class="n">1</span>About you</div>
  <table class="grid">
    <tr><td colspan="4"><div class="lbl">Full name (first, last)</div><div class="val"><span class="fill" data-field="applicant_name">${esc(a.name)}</span></div></td>
        <td colspan="2"><div class="lbl">Phone number</div><div class="val"><span class="fill">${esc(a.phone)}</span></div></td></tr>
    <tr><td colspan="5"><div class="lbl">Home address (street)</div><div class="val"><span class="fill">${esc(a.street)}</span></div></td>
        <td colspan="1"><div class="lbl">Apt / unit</div><div class="val"><span class="fill">${esc(a.apt)}</span></div></td></tr>
    <tr><td colspan="3"><div class="lbl">City</div><div class="val"><span class="fill">${esc(a.city)}</span></div></td>
        <td colspan="1"><div class="lbl">State</div><div class="val"><span class="fill" data-field="state">${esc(a.state)}</span></div></td>
        <td colspan="2"><div class="lbl">ZIP code</div><div class="val"><span class="fill">${esc(a.zip)}</span></div></td></tr>
    <tr><td colspan="6"><div class="lbl">Email (optional)</div><div class="val"></div></td></tr>
  </table>

  <div class="sec"><span class="n">2</span>Your household</div>
  <div class="q">How many people live with you and buy and prepare food with you, including you?
    <span class="uline" style="min-width:80px;text-align:center"><span class="fill" data-field="household_size">${a.members.length}</span></span></div>
  <table class="hh">
    <colgroup><col style="width:52%"><col style="width:14%"><col style="width:34%"></colgroup>
    <tr><th>Name (first, last)</th><th>Age</th><th>Relationship to you</th></tr>
    ${rows}
    <tr><td></td><td></td><td></td></tr>
  </table>

  <div class="sec"><span class="n">3</span>Income</div>
  <table class="grid" style="margin-top:10px">
    <tr><td><div class="lbl">Employer name</div><div class="val"><span class="fill" data-field="employer_name">${esc(d.employerName)}</span></div></td>
        <td><div class="lbl">Employer address</div><div class="val"><span class="fill" style="font-size:19px">${esc(d.employerAddress)}</span></div></td></tr>
  </table>
  <div class="q">Gross pay before taxes: <span class="uline"><span class="fill" data-field="gross_pay_amount">${esc(d.grossPay)}</span></span></div>
  <div class="q" style="margin-top:14px">How often are you paid?</div>
  <div class="checks">${opt('Weekly')}${opt('Every two weeks')}${opt('Twice a month')}${opt('Monthly')}</div>

  <div class="sec"><span class="n">4</span>Housing</div>
  <div class="q">Rent or mortgage: <span class="uline"><span class="fill" data-field="monthly_rent">${esc(d.rent)}</span></span> per month</div>

  <div class="sec"><span class="n">5</span>Signature</div>
  <div class="cert">I certify that the answers on this form are true and complete to the best of my knowledge. I understand that a caseworker will review this application, may contact me with questions, and may ask me for proof of what I reported.</div>
  <div class="sig">
    <div class="s"><div class="ink">${esc(a.name)}</div><div class="cap">Signature of applicant</div></div>
    <div class="d"><div class="dl"><span style="font-size:17px">Date signed:</span><span class="fill" data-field="application_date">${esc(d.dateSigned)}</span></div><div class="cap">Month / day / year</div></div>
  </div>
  ${wm}
</div>`;
  return doc(APP_CSS, body);
}

/* ------------------------------------------------------------------ */
/* 2 + 4. Pay stub (earnings statement)                                */
/* ------------------------------------------------------------------ */

export interface StubData {
  employer: { name: string; street: string; cityLine: string; phone: string };
  employee: { name: string; id: string; street: string; cityLine: string };
  periodStart: string;
  periodEnd: string;
  payDate: string;
  frequency: string;
  rate: string;
  hours: string;
  ytdHours: string;
  gross: string;
  ytdGross: string;
  deductions: { label: string; current: string; ytd: string }[];
  totalDeductions: string;
  ytdDeductions: string;
  net: string;
  ytdNet: string;
}

export const STUB_CSS = `
.ps{font:18px/1.35 ${SANS};padding:60px 72px 90px;font-variant-numeric:tabular-nums}
.ps-top{display:flex;justify-content:space-between;align-items:flex-start}
.ps-co .nm{font:800 30px/1.1 ${SANS};color:#14532d;letter-spacing:.01em}
.ps-co .ad{font-size:16px;color:#333;margin-top:6px;line-height:1.4}
.ps-logo{display:inline-flex;width:54px;height:54px;border-radius:10px;background:#14532d;color:#fff;font:800 22px/1 ${SANS};align-items:center;justify-content:center;margin-right:16px;vertical-align:top}
.ps-title{text-align:right}
.ps-title .t{font:800 30px/1 ${SANS};letter-spacing:.06em;color:#222}
.ps-title table{margin-top:14px;margin-left:auto;border-collapse:collapse;font-size:17px}
.ps-title td{padding:4px 0 4px 18px;text-align:right}
.ps-title td.k{color:#555;text-align:left;padding-left:0}
.ps-title td.v{font-weight:700}
.rule{height:3px;background:#14532d;margin:22px 0 18px}
.ps-emp{display:flex;gap:30px}
.ps-emp .card{flex:1;border:1.5px solid #9aa79f;padding:12px 16px;background:#f6f8f6}
.ps-emp .h{font:700 13px/1 ${SANS};letter-spacing:.08em;text-transform:uppercase;color:#14532d;margin-bottom:8px}
.ps-emp .card div{line-height:1.45}
.ps-emp b{font-weight:700}
table.st{width:100%;border-collapse:collapse;margin-top:24px;font-size:17px}
table.st caption{caption-side:top;text-align:left;font:700 15px/1 ${SANS};letter-spacing:.08em;text-transform:uppercase;color:#fff;background:#14532d;padding:8px 12px}
table.st th{font:700 13px/1.2 ${SANS};text-transform:uppercase;letter-spacing:.05em;color:#333;background:#e3e9e5;text-align:right;padding:8px 12px;border-bottom:1.5px solid #8a978f}
table.st th:first-child,table.st td:first-child{text-align:left}
table.st td{padding:9px 12px;text-align:right;border-bottom:1px solid #d3d9d5}
table.st tr.tot td{font-weight:700;border-top:2px solid #333;border-bottom:0;background:#f6f8f6}
.sum{display:flex;margin-top:28px;border:2px solid #14532d}
.sum>div{flex:1;padding:12px 16px;border-right:1.5px solid #9aa79f}
.sum>div:last-child{border-right:0;background:#e8f0ea}
.sum .k{font:700 13px/1 ${SANS};letter-spacing:.07em;text-transform:uppercase;color:#14532d}
.sum .v{font:700 26px/1.2 ${SANS};margin-top:8px}
.sum .y{font-size:15px;color:#444;margin-top:4px}
.msg{margin-top:22px;font-size:15px;color:#333;border-left:4px solid #9aa79f;padding:6px 14px;line-height:1.45}
.perf{margin:34px -72px 0;border-top:2px dashed #888;position:relative}
.perf span{position:absolute;left:50%;top:-11px;transform:translateX(-50%);background:inherit;padding:0 12px;font-size:13px;color:#777;letter-spacing:.1em;background:#fff}
.adv{margin-top:30px;border:1.5px solid #9aa79f;padding:18px 22px;background:repeating-linear-gradient(135deg,#f3f6f4 0 10px,#fbfcfb 10px 20px)}
.adv .hd{display:flex;justify-content:space-between;font:800 18px/1 ${SANS};letter-spacing:.06em;color:#14532d}
.adv .nn{font:800 16px/1 ${SANS};letter-spacing:.14em;color:#8a2d2d;text-align:center;margin:16px 0 12px}
.adv table{width:100%;border-collapse:collapse;font-size:17px}
.adv td{padding:6px 0}
.adv td.k{color:#555;width:220px}
.adv td.v{font-weight:700}
`;

export function stubBody(d: StubData, pageClass = ''): string {
  const ded = d.deductions.map((x) => `<tr><td>${esc(x.label)}</td><td>${esc(x.current)}</td><td>${esc(x.ytd)}</td></tr>`).join('');
  return `<div class="page ps ${pageClass}">
  <div class="ps-top">
    <div class="ps-co"><span class="ps-logo">HL</span><div style="display:inline-block">
      <div class="nm" data-line><span data-field="employer_name">${esc(d.employer.name)}</span></div>
      <div class="ad">${esc(d.employer.street)}<br>${esc(d.employer.cityLine)}<br>Payroll: ${esc(d.employer.phone)}</div></div></div>
    <div class="ps-title"><div class="t">EARNINGS STATEMENT</div>
      <table>
        <tr data-line><td class="k">Pay period:</td><td class="v"><span data-field="pay_period_start">${esc(d.periodStart)}</span> – <span data-field="pay_period_end">${esc(d.periodEnd)}</span></td></tr>
        <tr data-line><td class="k">Pay date:</td><td class="v"><span data-field="pay_date">${esc(d.payDate)}</span></td></tr>
        <tr data-line><td class="k">Pay frequency:</td><td class="v"><span data-field="pay_frequency">${esc(d.frequency)}</span></td></tr>
      </table></div>
  </div>
  <div class="rule"></div>
  <div class="ps-emp">
    <div class="card"><div class="h">Employee</div>
      <div data-line><b><span data-field="applicant_name">${esc(d.employee.name)}</span></b></div>
      <div>${esc(d.employee.street)}</div><div>${esc(d.employee.cityLine)}</div></div>
    <div class="card"><div class="h">Employment</div>
      <div>Employee ID: <b>${esc(d.employee.id)}</b></div>
      <div>Pay type: <b>Hourly</b></div>
      <div>Payment method: <b>Direct deposit</b></div></div>
  </div>

  <table class="st">
    <caption>Earnings</caption>
    <colgroup><col style="width:28%"><col><col><col><col><col></colgroup>
    <tr><th>Description</th><th>Rate</th><th>Hours</th><th>This period</th><th>YTD hours</th><th>YTD amount</th></tr>
    <tr><td>Regular</td><td>$${esc(d.rate)}</td><td>${esc(d.hours)}</td><td>$${esc(d.gross)}</td><td>${esc(d.ytdHours)}</td><td>$${esc(d.ytdGross)}</td></tr>
    <tr class="tot" data-line><td>Gross pay</td><td></td><td>${esc(d.hours)}</td><td><span data-field="gross_pay_amount">$${esc(d.gross)}</span></td><td>${esc(d.ytdHours)}</td><td>$${esc(d.ytdGross)}</td></tr>
  </table>

  <table class="st">
    <caption>Deductions</caption>
    <colgroup><col style="width:52%"><col><col></colgroup>
    <tr><th>Description</th><th>This period</th><th>Year to date</th></tr>
    ${ded}
    <tr class="tot"><td>Total deductions</td><td>${esc(d.totalDeductions)}</td><td>${esc(d.ytdDeductions)}</td></tr>
  </table>

  <div class="sum">
    <div><div class="k">Gross pay</div><div class="v">$${esc(d.gross)}</div><div class="y">YTD gross $${esc(d.ytdGross)}</div></div>
    <div><div class="k">Total deductions</div><div class="v">$${esc(d.totalDeductions)}</div><div class="y">YTD $${esc(d.ytdDeductions)}</div></div>
    <div><div class="k">Net pay</div><div class="v">$${esc(d.net)}</div><div class="y">YTD net $${esc(d.ytdNet)}</div></div>
  </div>

  <div class="msg">Questions about your pay? Contact Harbor Lane Grocery payroll at ${esc(d.employer.phone)}. Keep this statement for your records.</div>

  <div class="perf"><span>DETACH HERE</span></div>
  <div class="adv">
    <div class="hd"><span>${esc(d.employer.name)}</span><span>DIRECT DEPOSIT ADVICE</span></div>
    <div class="nn">NON-NEGOTIABLE — THIS IS NOT A CHECK</div>
    <table>
      <tr><td class="k">Pay date</td><td class="v">${esc(d.payDate)}</td></tr>
      <tr><td class="k">Deposited for</td><td class="v">${esc(d.employee.name)}</td></tr>
      <tr><td class="k">Account</td><td class="v">Checking account on file</td></tr>
      <tr><td class="k">Amount deposited</td><td class="v">$${esc(d.net)}</td></tr>
    </table>
  </div>
  ${wm}
</div>`;
}

export function paystub(d: StubData): string {
  return doc(STUB_CSS, stubBody(d));
}

/** The same stub, photographed on a desk: rotated, shadowed, vignetted. */
export const PHOTO_W = 1200;
export const PHOTO_H = 1600;

const PHOTO_CSS = `
html,body{background:#6f4a2b}
.desk{position:absolute;inset:0;overflow:hidden;background:
  repeating-linear-gradient(178.8deg, rgba(58,30,12,.13) 0 2px, transparent 2px 13px),
  repeating-linear-gradient(180.6deg, rgba(255,225,180,.07) 0 1px, transparent 1px 29px),
  repeating-linear-gradient(179.5deg, rgba(40,18,4,.12) 0 5px, transparent 5px 61px),
  linear-gradient(180deg,#a06f44 0%,#8d5e37 45%,#7a4f2d 100%)}
.desk svg{position:absolute;inset:0;mix-blend-mode:multiply;opacity:.55}
.paper{position:absolute;left:50%;top:50.5%;margin:0;transform:translate(-50%,-50%) rotate(-1.5deg) scale(0.865);
  background:#f6f4ee;box-shadow:0 3px 6px rgba(0,0,0,.35),0 24px 60px rgba(0,0,0,.5);filter:blur(0.35px)}
.paper .adv{background:repeating-linear-gradient(135deg,#eceee9 0 10px,#f4f4ef 10px 20px)}
.paper .perf span{background:#f6f4ee}
.light{position:absolute;inset:0;pointer-events:none;background:
  linear-gradient(118deg, rgba(255,248,230,.13) 0%, rgba(255,248,230,0) 45%, rgba(0,0,0,.08) 100%),
  radial-gradient(ellipse 75% 70% at 50% 46%, rgba(0,0,0,0) 55%, rgba(0,0,0,.42) 100%)}
`;

export function paystubPhoto(d: StubData): string {
  const grain = `<svg width="${PHOTO_W}" height="${PHOTO_H}" xmlns="http://www.w3.org/2000/svg"><filter id="g" x="0" y="0" width="100%" height="100%">
<feTurbulence type="fractalNoise" baseFrequency="0.0025 0.11" numOctaves="3" seed="7"/>
<feColorMatrix type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.2  0 0 0 0 0.08  0 0 0 1.4 -0.35"/></filter>
<rect width="100%" height="100%" filter="url(#g)"/></svg>`;
  return doc(STUB_CSS + PHOTO_CSS, `<div class="desk">${grain}</div>${stubBody(d, 'paper')}<div class="light"></div>`, PHOTO_W, PHOTO_H);
}

/* ------------------------------------------------------------------ */
/* 3. Lease, page 1                                                    */
/* ------------------------------------------------------------------ */

export interface LeaseData {
  landlord: string;
  landlordPhone: string;
  tenant: string;
  occupants: string;
  premises: string;
  termStart: string;
  termEnd: string;
  rent: string;
  landlordPays: string;
  tenantPays: string;
}

const LEASE_CSS = `
.ls{font:20px/1.5 ${SERIF};padding:80px 100px 100px;color:#1a1a1a}
.ls h1{font:700 32px/1.15 ${SERIF};text-align:center;letter-spacing:.08em}
.ls .subt{text-align:center;font-style:italic;font-size:17px;color:#444;margin-top:6px}
.ls .dbl{border-top:1.5px solid #222;border-bottom:1.5px solid #222;height:6px;margin:20px 0 22px}
.ls .cl{margin-top:16px}
.ls .cl h2{font:700 17px/1.2 ${SERIF};letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px}
.ls .cl p{text-align:justify}
.ls .kv{margin:4px 0 4px 28px}
.ls .kv b{font-weight:700}
.ls .cont{margin-top:18px;text-align:right;font-style:italic;font-size:16px;color:#444}
.ls .ini{position:absolute;left:100px;right:100px;bottom:70px;display:flex;justify-content:space-between;font-size:16px;color:#333}
.ls .ini span.b{display:inline-block;width:90px;border-bottom:1.5px solid #333;margin-left:8px}
`;

export function lease(d: LeaseData): string {
  const body = `<div class="page ls">
  <h1>RESIDENTIAL LEASE AGREEMENT</h1>
  <div class="subt">Fixed-term lease of a dwelling unit (fictional demo document)</div>
  <div class="dbl"></div>

  <div class="cl"><h2>1. Parties</h2>
    <p>This Residential Lease Agreement ("Lease") is entered into by the landlord and the tenant named below. The landlord agrees to rent the premises described in Section 3 to the tenant on the terms of this Lease.</p>
    <div class="kv" data-line><b>Landlord:</b> ${esc(d.landlord)}, telephone ${esc(d.landlordPhone)}</div>
    <div class="kv" data-line><b>Tenant:</b> <span data-field="tenant_names">${esc(d.tenant)}</span></div>
  </div>

  <div class="cl"><h2>2. Occupants</h2>
    <p>The premises shall be used as a private residence only, and only by the tenant and the persons listed here. No other person may live at the premises without the landlord's written consent.</p>
    <div class="kv" data-line><b>Occupants:</b> <span data-field="household_members">${esc(d.occupants)}</span></div>
  </div>

  <div class="cl"><h2>3. Premises</h2>
    <div class="kv" data-line><b>Premises:</b> ${esc(d.premises)}</div>
  </div>

  <div class="cl"><h2>4. Term</h2>
    <div class="kv" data-line><b>Term:</b> ${esc(d.termStart)} to ${esc(d.termEnd)}</div>
    <p>At the end of the term this Lease continues month to month unless either party gives written notice as required by law.</p>
  </div>

  <div class="cl"><h2>5. Rent</h2>
    <div class="kv" data-line><b>Monthly rent:</b> <span data-field="monthly_rent">${esc(d.rent)}</span>, due on the 1st</div>
    <p>Rent is payable in advance by check, money order or electronic transfer to the landlord at the address the landlord provides in writing.</p>
  </div>

  <div class="cl"><h2>6. Utilities</h2>
    <div class="kv" data-line><b>Utilities:</b> landlord pays <span data-field="utilities_included">${esc(d.landlordPays)}</span>; tenant pays ${esc(d.tenantPays)}</div>
    <p>The tenant shall place utilities paid by the tenant in the tenant's own name before the start of the term and keep them connected for the whole term.</p>
  </div>

  <div class="cl"><h2>7. Care of the premises</h2>
    <p>The tenant shall keep the premises clean and sanitary, use all fixtures and appliances in a reasonable manner, and promptly tell the landlord in writing about any needed repairs. The landlord shall keep the premises in habitable condition.</p>
  </div>

  <div class="cl"><h2>8. Entry by landlord</h2>
    <p>The landlord may enter the premises to make repairs, show the unit or inspect it after giving the tenant reasonable written notice, except in an emergency.</p>
  </div>

  <div class="cl"><h2>9. Assignment and subletting</h2>
    <p>The tenant may not assign this Lease or sublet any part of the premises without the landlord's prior written consent.</p>
  </div>

  <div class="cl"><h2>10. Pets</h2>
    <p>No animal may be kept on the premises without the landlord's prior written consent, except an assistance animal as allowed by law.</p>
  </div>

  <div class="cl"><h2>11. Smoke and carbon monoxide alarms</h2>
    <p>The premises are equipped with working smoke and carbon monoxide alarms. The tenant shall test them regularly and tell the landlord promptly if any alarm does not work.</p>
  </div>
  <div class="cont">(continued on page 2)</div>

  <div class="ini"><span>Tenant initials<span class="b"></span></span><span>Page 1</span><span>Landlord initials<span class="b"></span></span></div>
  ${wm}
</div>`;
  return doc(LEASE_CSS, body);
}
