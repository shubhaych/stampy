'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Mail, Phone, Shuffle } from 'lucide-react';
import { Badge, Fig } from '@/components/ui';
import { money } from '@/lib/format';
import { ROUTES } from '@/lib/routes';
import { featuredRecords, openReplay, openedCases, readContact, saveContact, type Contact, type FeaturedPage, type ReplayRecord } from '@/lib/stampy/replay';
import { normalizePhone } from '@/lib/stampy/util';
import { ErrorLine } from './common';

const monthLabel = (ym: string) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const newSeed = () => Math.floor(Math.random() * 1_000_000);

/** Real households from the public QC file, ready to open as cases. */
export function ReplayCases() {
  const router = useRouter();
  const [seed, setSeed] = useState<number | null>(null);
  const [page, setPage] = useState<FeaturedPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<Record<string, string>>({});
  const [contact, setContact] = useState<Contact | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ id: string; step: string } | null>(null);

  useEffect(() => { setSeed(newSeed()); setOpened(openedCases()); setContact(readContact()); }, []);
  useEffect(() => {
    if (seed === null) return;
    let live = true;
    setError(null);
    featuredRecords(seed).then((p) => { if (live) setPage(p); }).catch((e: Error) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [seed]);

  const open = useCallback(async (record: ReplayRecord, to: Contact) => {
    setError(null);
    setBusy({ id: record.id, step: 'Building the case file' });
    try {
      const id = await openReplay(record.id, to, (step) => setBusy({ id: record.id, step }));
      router.push(ROUTES.caseV2(id));
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }, [router]);

  const choose = (record: ReplayRecord) => {
    if (opened[record.id]) router.push(ROUTES.caseV2(opened[record.id]!));
    else if (contact) void open(record, contact);
    else setAsking(record.id);
  };

  const release = page?.release;
  return (
    <section className="cq-section" aria-labelledby="cq-replay-title">
      <div className="cq-head">
        <div>
          <h2 id="cq-replay-title">From the public QC file <Badge kind="replay" /></h2>
          <p>
            {page
              ? <>Six households picked at random from <Fig prov="replay">{page.pool.toLocaleString()}</Fig> federal quality-control records with a wage finding. Each one needs an email and a phone call to settle.</>
              : 'Households from the federal quality-control sample.'}
          </p>
        </div>
        <button type="button" className="cq-quiet" disabled={!page || !!busy} onClick={() => { setPage(null); setAsking(null); setSeed(newSeed()); }}>
          <Shuffle size={15} aria-hidden /> Show six others
        </button>
      </div>
      <ErrorLine error={error} />
      {!page && !error && <ul className="cq-list" aria-hidden>{Array.from({ length: 6 }, (_, i) => <li key={i} className="cq-row cq-row--loading" />)}</ul>}
      {page && (
        <ul className="cq-list">
          {page.items.map((r) => {
            const working = busy?.id === r.id;
            return (
              <li key={r.id} className={`cq-row ${working ? 'cq-row--busy' : ''}`}>
                <button type="button" className="cq-row__main" disabled={!!busy} onClick={() => choose(r)}>
                  <span className="cq-row__who">
                    <strong>{r.stateName}</strong>
                    <span>Household {r.householdId} · {monthLabel(r.sampleMonth)} · {r.householdSize} {r.householdSize === 1 ? 'person' : 'people'}</span>
                  </span>
                  <span className="cq-row__benefit">
                    <Fig prov="replay">{money(r.benefitMonthly ?? 0)}</Fig>
                    <span>issued per month</span>
                  </span>
                  <span className="cq-row__needs">
                    <span><Mail size={14} aria-hidden /> Email</span>
                    <span><Phone size={14} aria-hidden /> Call</span>
                  </span>
                  <span className="cq-row__go">{working ? busy.step : opened[r.id] ? <>Continue <ArrowRight size={15} aria-hidden /></> : <>Open case <ArrowRight size={15} aria-hidden /></>}</span>
                </button>
                <p className="cq-row__proof">
                  Row <Fig prov="replay">{r.sourceRecord.toLocaleString()}</Fig> of <Fig prov="replay">{page.release.rowCount.toLocaleString()}</Fig> in {page.release.archiveMember}
                  {' · '}<Link href={`/cases/qc?record=${r.id}`}>See the published row</Link>
                </p>
                {asking === r.id && <ContactForm onCancel={() => setAsking(null)} onSave={(c) => { saveContact(c); setContact(c); setAsking(null); void open(r, c); }} />}
              </li>
            );
          })}
        </ul>
      )}
      {release && (
        <p className="cq-source">
          USDA SNAP Quality Control public-use file, fiscal year {release.fiscalYear}. Archive SHA-256 <code title={release.archiveSha256}>{release.archiveSha256.slice(0, 12)}…{release.archiveSha256.slice(-6)}</code>
          {' · '}<a href={release.sourceUrl} target="_blank" rel="noreferrer">Download the archive ↗</a>
          {' · '}<a href={release.dictionaryUrl} target="_blank" rel="noreferrer">Data dictionary ↗</a>
          {' · '}<Link href="/cases/qc">Browse every record</Link>
          {contact && <>{' · '}Outreach goes to {contact.email} <button type="button" className="cq-inline" onClick={() => { localStorage.removeItem('stampy.replay.contact'); setContact(null); }}>change</button></>}
        </p>
      )}
    </section>
  );
}

function ContactForm({ onSave, onCancel }: { onSave: (c: Contact) => void; onCancel: () => void }) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="cq-contact"
      onSubmit={(e) => {
        e.preventDefault();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError('Enter an email address you can check.');
        let normalized: string;
        try { normalized = normalizePhone(phone); } catch { return setError('Enter a phone number with area code.'); }
        if (!normalized) return setError('Enter a phone number with area code.');
        onSave({ email: email.trim(), phone: normalized });
      }}
    >
      <p>Public records carry no contact details. Where should this household&apos;s email and call go? Use your own inbox and phone.</p>
      <div className="cq-contact__fields">
        <input className="stp-input" type="email" required autoFocus placeholder="you@example.com" aria-label="Test email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="stp-input" type="tel" required placeholder="(555) 555-0123" aria-label="Test phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <button className="btn btn--primary" type="submit">Open case</button>
        <button className="cq-quiet" type="button" onClick={onCancel}>Cancel</button>
      </div>
      <ErrorLine error={error} />
    </form>
  );
}
