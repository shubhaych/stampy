import { notFound } from 'next/navigation';
import { GateSheet } from '@/components/case/gate-sheet';
import { data } from '@/lib/data';

export const metadata = { title: 'Before you certify' };

export default async function GatePage(props: PageProps<'/case/[id]/gate'>) {
  const { id } = await props.params;
  const bundle = await data.caseBundle(id);
  if (!bundle) notFound();
  return <GateSheet bundle={bundle} />;
}
