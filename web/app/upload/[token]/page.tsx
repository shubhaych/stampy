import { Badge } from '@/components/ui';

export const metadata = { title: 'Upload a document' };

/** Household phone page (resolve-ui). A one-time link from "text the household". Light, phone-sized, plain words. */
export default async function UploadPage(props: PageProps<'/upload/[token]'>) {
  const { token } = await props.params;
  return (
    <main className="mx-auto max-w-[420px] px-4 py-8">
      <div className="eyebrow mb-3 flex items-center gap-2 opacity-70">Your benefits office <Badge kind="fixture" /></div>
      <h1 className="font-display m-0 text-3xl">Send a photo of your document</h1>
      <p className="mt-3 opacity-80">Your caseworker asked for one document. Take a clear photo of the whole page. Only your caseworker sees it.</p>
      <form className="mt-6 grid gap-3" aria-label="Upload">
        <label className="grid gap-1 text-sm">
          Photo
          <input type="file" accept="image/*" capture="environment" className="rounded-lg border p-3" style={{ borderColor: 'var(--line)' }} />
        </label>
        <button type="button" className="btn btn--primary" disabled>Send to my caseworker</button>
        <p className="m-0 text-xs opacity-60">Demo link {token}. In fixture mode nothing is uploaded.</p>
      </form>
    </main>
  );
}
