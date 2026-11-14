/** Small, pure helpers for the Stampy pages. No React, no fetch: safe in tests. */

/** E.164 for the worker. US 10-digit input gets +1; 11 digits starting with 1 gets +; anything with a + keeps it. */
export function normalizePhone(input: string): string {
  const raw = input.trim();
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (raw.startsWith('+')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

/** "482913" → "482 913". Anything that is not all digits is shown as given. */
export function formatRef(ref: string): string {
  const s = ref.replace(/\s+/g, '');
  if (/^\d+$/.test(s) && s.length > 3) return s.replace(/(\d{3})(?=\d)/g, '$1 ');
  return ref;
}

/** Seconds into a call → "m:ss". */
export function mss(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '';
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function clockTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.round((now - t) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return dateTime(iso);
}

/** Splits text so money amounts can each be wrapped in a badged figure. Odd indexes are amounts. */
export function splitMoney(text: string): string[] {
  return text.split(/(\$\s?\d[\d,]*(?:\.\d+)?)/g);
}
