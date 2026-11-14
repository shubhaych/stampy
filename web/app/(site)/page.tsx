import { TextCta } from '@/components/ui';

/** Homepage placeholder (scaffold). The home feature replaces this on branch a/home. */
export default function HomePage() {
  return (
    <main className="wrap py-24">
      <div className="eyebrow mb-4 text-[var(--ink-soft)]">CleanCase · Pre-issuance accuracy for SNAP</div>
      <h1 className="font-display h-hero m-0 max-w-[18ch]">Check the case before the benefit goes out.</h1>
      <p className="mt-4 max-w-[60ch] text-[var(--ink-soft)]">
        CleanCase reads the case file, flags what doesn&apos;t match with the exact source line and the rule behind it, and recomputes the benefit. A merit-staff worker makes every decision.
      </p>
      <div className="mt-6"><TextCta href="/demo">Work a case →</TextCta></div>
    </main>
  );
}
