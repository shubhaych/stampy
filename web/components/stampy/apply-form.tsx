'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui';
import { demoFiles } from '@/lib/stampy/demo-case';
import { toPng } from '@/lib/stampy/replay';
import { api, type SampleDoc } from '@/lib/stampy/api';
import { normalizePhone } from '@/lib/stampy/util';
import { ROUTES } from '@/lib/routes';

const STATES: [string, string][] = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'], ['CO', 'Colorado'],
  ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'], ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'],
  ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'],
  ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'],
  ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'],
  ['NM', 'New Mexico'], ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'],
  ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'],
  ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'],
  ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
];

const ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,application/pdf';
const ACCEPTED = new Set(ACCEPT.split(','));
const fileKey = (f: File) => `${f.name}:${f.size}:${f.lastModified}`;
const fileSize = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** Remembered for the confirmation page so the email never goes in a URL. */
export const APPLY_SESSION_KEY = (id: string) => `stampy.apply.${id}`;

export function ApplyForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [state, setState] = useState('CA');
  const [files, setFiles] = useState<File[]>([]);
  const [samples, setSamples] = useState<SampleDoc[] | null>(null);
  const [samplesError, setSamplesError] = useState<string | null>(null);
  const [useSamples, setUseSamples] = useState(false);
  const [useDemo, setUseDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [skipped, setSkipped] = useState<string | null>(null);

  /** Add picked or dropped files to the list (no duplicates); skip types the reader can't open. */
  function addFiles(list: FileList | null) {
    const picked = Array.from(list ?? []);
    const ok = picked.filter((f) => ACCEPTED.has(f.type));
    const bad = picked.filter((f) => !ACCEPTED.has(f.type));
    setSkipped(bad.length ? `Skipped ${bad.map((f) => f.name).join(', ')}: use a photo (JPG, PNG) or a PDF.` : null);
    setFiles((xs) => {
      const seen = new Set(xs.map(fileKey));
      return [...xs, ...ok.filter((f) => !seen.has(fileKey(f)))];
    });
  }

  useEffect(() => {
    let live = true;
    api.samples().then(
      (s) => live && setSamples(s),
      (e: Error) => live && setSamplesError(e.message),
    );
    return () => {
      live = false;
    };
  }, []);

  // The demo file includes the recent paystub, so the only thing left to settle is the pay-frequency
  // conflict between the form and the paystubs: one phone call closes the case.
  const defaults = useMemo(() => (samples ?? []).filter((s) => s.uploadByDefault || s.name === 'paystub-2026-10-photo'), [samples]);
  const e164 = normalizePhone(phone);
  const phoneOk = /^\+\d{8,15}$/.test(e164);
  const hasDocs = files.length > 0 || useDemo || (useSamples && defaults.length > 0);
  const canSubmit = !busy && name.trim() && /.+@.+\..+/.test(email.trim()) && phoneOk && hasDocs;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set('applicantName', name.trim());
    form.set('applicantEmail', email.trim());
    form.set('applicantPhone', e164);
    form.set('state', state);
    for (const f of files) form.append('files', f, f.name);
    if (useSamples && defaults.length) form.set('samples', defaults.map((s) => s.name).join(','));
    try {
      // The demo case files carry the name typed above, so the case reads as this applicant's own file.
      if (useDemo) for (const d of demoFiles(name)) form.append('files', new File([await toPng(d.svg)], d.filename, { type: 'image/png' }));
      const res = await api.createCase(form);
      try {
        window.sessionStorage.setItem(APPLY_SESSION_KEY(res.id), JSON.stringify({ email: email.trim(), refCode: res.refCode }));
      } catch {
        /* storage off: the confirmation page falls back to generic words */
      }
      router.push(`${ROUTES.applyDone(res.id)}?ref=${encodeURIComponent(res.refCode)}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="stp-apply" onSubmit={submit} noValidate>
      <label className="stp-field">
        <span>Full name</span>
        <input className="stp-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
      </label>
      <label className="stp-field">
        <span>Email</span>
        <input className="stp-input" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        <small>We email you if we need anything else.</small>
      </label>
      <label className="stp-field">
        <span>Mobile phone</span>
        <input className="stp-input" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="(415) 555-0123" required />
        <small>{phone && !phoneOk ? 'Enter a 10-digit US number, or include the country code.' : 'We use it to recognize you when you call.'}</small>
      </label>
      <label className="stp-field">
        <span>State</span>
        <select className="stp-input" value={state} onChange={(e) => setState(e.target.value)}>
          {STATES.map(([code, label]) => (
            <option key={code} value={code}>{label}</option>
          ))}
        </select>
      </label>

      <fieldset className="stp-field stp-docs">
        <legend>Your documents</legend>
        <small>Your application form, recent paystubs, and your lease. Photos or PDFs.</small>
        <div
          className={`stp-drop ${dragging ? 'is-over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
        >
          <input
            id="stp-files"
            className="sr-only"
            type="file"
            multiple
            accept={ACCEPT}
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <label htmlFor="stp-files" className="btn btn--ghost stp-drop__btn">Choose files</label>
          <span className="stp-drop__hint">or drag them here</span>
        </div>
        {skipped ? <small className="stp-hint">{skipped}</small> : null}
        {files.length ? (
          <ul className="stp-files" aria-label="Files to send">
            {files.map((f) => (
              <li key={fileKey(f)} className="stp-files__row">
                <span className="stp-files__name">{f.name}</span>
                <span className="stp-files__size">{fileSize(f.size)}</span>
                <button type="button" className="stp-files__remove" onClick={() => setFiles((xs) => xs.filter((x) => fileKey(x) !== fileKey(f)))} aria-label={`Remove ${f.name}`}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="stp-samples">
          <button type="button" className={`btn ${useDemo ? 'btn--primary' : 'btn--ghost'}`} onClick={() => { setUseDemo((v) => !v); setUseSamples(false); }} aria-pressed={useDemo}>
            {useDemo ? 'Using the demo case files' : 'Use the demo case files'}
          </button>
          <Badge kind="synthetic" />
          <small className="stp-hint">{useDemo ? 'Household record, tax record and payment history, in your name.' : 'The three files shown on the Data page.'}</small>
        </div>
        <div className="stp-samples">
          <button
            type="button"
            className={`btn ${useSamples ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => { setUseSamples((v) => !v); setUseDemo(false); }}
            disabled={!defaults.length}
            aria-pressed={useSamples}
          >
            {useSamples ? 'Using the sample documents' : 'Use the sample documents'}
          </button>
          <Badge kind="synthetic" />
          {samplesError ? <small className="stp-hint">Samples not loaded: {samplesError}</small> : null}
          {samples && !defaults.length ? <small className="stp-hint">No sample documents are set up.</small> : null}
        </div>
        {useSamples && defaults.length ? (
          <ul className="stp-thumbs" aria-label="Sample documents to send">
            {defaults.map((s) => (
              <li key={s.name} className="stp-thumb">
                {s.contentType.startsWith('image/') ? (
                  <img src={api.sampleUrl(s.name)} alt={s.label} loading="lazy" />
                ) : (
                  <span className="stp-thumb__pdf">PDF</span>
                )}
                <span className="stp-thumb__label">{s.label}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </fieldset>

      {error ? (
        <p className="stp-error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn btn--primary stp-submit" disabled={!canSubmit}>
        {busy ? 'Sending…' : 'Send my application'}
      </button>
    </form>
  );
}
