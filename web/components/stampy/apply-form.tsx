'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui';
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const defaults = useMemo(() => (samples ?? []).filter((s) => s.uploadByDefault), [samples]);
  const e164 = normalizePhone(phone);
  const phoneOk = /^\+\d{8,15}$/.test(e164);
  const hasDocs = files.length > 0 || (useSamples && defaults.length > 0);
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
        <input
          className="stp-input"
          type="file"
          multiple
          accept="image/*,application/pdf"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          aria-label="Choose documents"
        />
        {files.length ? (
          <ul className="stp-filelist">
            {files.map((f) => (
              <li key={f.name + f.size}>{f.name}</li>
            ))}
          </ul>
        ) : null}

        <div className="stp-samples">
          <button
            type="button"
            className={`btn ${useSamples ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setUseSamples((v) => !v)}
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
