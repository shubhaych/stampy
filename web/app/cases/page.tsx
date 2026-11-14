import { DeckPage, TextCta } from '@/components/ui';
import { CaseQueue } from '@/components/stampy/case-queue';
import { DataFooter } from '@/components/stampy/common';
import { ROUTES } from '@/lib/routes';

export const metadata = { title: 'Caseworker queue' };

/** Caseworker queue: every application, newest first, live over SSE. */
export default async function CasesPage(props: PageProps<'/cases'>) {
  const sp = await props.searchParams;
  const fixture = sp.fixture === '1';
  return (
    <DeckPage eyebrow="Caseworker" title="Applications" right={<TextCta href={ROUTES.apply}>New application</TextCta>}>
      <CaseQueue fixture={fixture} />
      <DataFooter />
    </DeckPage>
  );
}
