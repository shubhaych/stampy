import { TextCta } from '@/components/ui';
import { CaseQueue } from '@/components/stampy/case-queue';
import { ReplayCases } from '@/components/stampy/replay-cases';
import { DataFooter } from '@/components/stampy/common';
import { ROUTES } from '@/lib/routes';

export const metadata = { title: 'Cases' };

/** Caseworker home: real public QC households to open as cases, then the live queue. */
export default async function CasesPage(props: PageProps<'/cases'>) {
  const sp = await props.searchParams;
  const fixture = sp.fixture === '1';
  return (
    <main className="app-dark cq-page">
      <div className="cq-wrap">
        <header className="cq-top">
          <div>
            <h1 className="font-display">Cases</h1>
            <p>A second check before benefits go out. Stampy reads the file and shows what does not match; you decide.</p>
          </div>
          <TextCta href={ROUTES.apply}>New application</TextCta>
        </header>
        {!fixture && <ReplayCases />}
        <CaseQueue fixture={fixture} />
        <DataFooter />
      </div>
    </main>
  );
}
