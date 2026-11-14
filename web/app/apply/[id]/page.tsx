import { ApplyDone } from '@/components/stampy/apply-done';

export const metadata = { title: 'Application received' };

/** Applicant confirmation. No internal flags and no benefit numbers here. */
export default async function ApplyDonePage(props: PageProps<'/apply/[id]'>) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const ref = typeof sp.ref === 'string' ? sp.ref : null;
  return (
    <main className="stp-paper">
      <div className="eyebrow mb-3 opacity-70">Application received</div>
      <h1 className="font-display m-0 text-3xl sm:text-4xl">Thanks. We have your application.</h1>
      <ApplyDone id={id} refCode={ref} />
    </main>
  );
}
