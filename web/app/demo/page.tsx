import { DeckPage } from '@/components/ui';
import { StateSelect } from '@/components/demo/state-select';
import { data } from '@/lib/data';

export const metadata = { title: 'Choose a state' };

export default async function DemoPage() {
  const states = await data.states();
  return (
    <DeckPage eyebrow="Demo · step 1 of 3" title="Pick a state, start a shift" prov="fixture">
      <StateSelect states={states} />
    </DeckPage>
  );
}

// Live mode reads the worker at request time, never at build time.
export const dynamic = 'force-dynamic';
