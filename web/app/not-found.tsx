import { TextCta } from '@/components/ui';

export default function NotFound() {
  return (
    <main className="wrap py-24">
      <h1 className="font-display h-section m-0">Not found</h1>
      <p className="mt-3 text-[var(--ink-soft)]">That page or case is not loaded.</p>
      <TextCta href="/">Back to the start</TextCta>
    </main>
  );
}
