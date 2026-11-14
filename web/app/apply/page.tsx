import { Badge } from '@/components/ui';
import { ApplyForm } from '@/components/stampy/apply-form';

export const metadata = { title: 'Apply for food assistance' };

/** Applicant page: light paper, phone-sized, plain words. */
export default function ApplyPage() {
  return (
    <main className="stp-paper">
      <div className="eyebrow mb-3 flex items-center gap-2 opacity-70">Demo <Badge kind="synthetic" /></div>
      <h1 className="font-display m-0 text-3xl sm:text-4xl">Apply for food assistance</h1>
      <p className="mt-3 mb-6 opacity-80">
        Tell us how to reach you and send your documents. It takes about five minutes. A caseworker reviews every application.
      </p>
      <ApplyForm />
    </main>
  );
}
