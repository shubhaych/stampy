'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/stampy/api';
import { formatRef } from '@/lib/stampy/util';
import { APPLY_SESSION_KEY } from './apply-form';

/** Applicant-facing confirmation. No internal flags, no benefit numbers. */
export function ApplyDone({ id, refCode }: { id: string; refCode: string | null }) {
  const [email, setEmail] = useState<string | null>(null);
  const [ref, setRef] = useState<string | null>(refCode);
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(APPLY_SESSION_KEY(id));
      if (raw) {
        const v = JSON.parse(raw) as { email?: string; refCode?: string };
        if (v.email) setEmail(v.email);
        if (!refCode && v.refCode) setRef(v.refCode);
      }
    } catch {
      /* storage off */
    }
    let live = true;
    api.status().then(
      (s) => live && setPhone(s.phoneNumber),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [id, refCode]);

  return (
    <div className="stp-done">
      <p className="stp-done__label">Your reference code</p>
      <p className="stp-done__ref" aria-label={`Reference code ${ref ?? 'not loaded'}`}>
        {ref ? formatRef(ref) : 'not loaded'}
      </p>
      <p className="stp-done__lead">
        We&apos;re reading your documents. If we need anything, we&apos;ll email you at{' '}
        <strong>{email ?? 'the address you gave us'}</strong> with what to send and a number to call.
      </p>
      {phone ? (
        <div className="stp-done__call">
          <span>Questions? Call us and have your reference code ready.</span>
          <a className="stp-done__phone" href={`tel:${phone}`}>{phone}</a>
        </div>
      ) : null}
      <ul className="stp-done__list">
        <li>A caseworker reviews your application before anything changes.</li>
        <li>If an AI assistant answers the phone, it will say so, and you can ask for a person to call you back.</li>
        <li>You don&apos;t need to do anything else right now.</li>
      </ul>
    </div>
  );
}
