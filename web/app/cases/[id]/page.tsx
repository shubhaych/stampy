import { CaseScreen } from '@/components/stampy/case-screen';

export async function generateMetadata(props: PageProps<'/cases/[id]'>) {
  const { id } = await props.params;
  return { title: `Case ${id}` };
}

/** The caseworker screen. ?fixture=1 renders the dev fixture (every figure badged Fixture). */
export default async function CaseV2Page(props: PageProps<'/cases/[id]'>) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  return <CaseScreen key={id} id={id} fixture={sp.fixture === '1'} />;
}
