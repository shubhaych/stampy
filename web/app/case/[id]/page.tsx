import { notFound } from 'next/navigation';
import { Workspace } from '@/components/case/workspace';
import { data } from '@/lib/data';

export async function generateMetadata(props: PageProps<'/case/[id]'>) {
  const { id } = await props.params;
  return { title: `Case ${id}` };
}

export default async function CasePage(props: PageProps<'/case/[id]'>) {
  const { id } = await props.params;
  const bundle = await data.caseBundle(id);
  if (!bundle) notFound();
  return <Workspace bundle={bundle} />;
}
