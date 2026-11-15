import { DataExplorer } from '@/components/stampy/data-explorer';
import { DataFooter } from '@/components/stampy/common';

export const metadata = { title: 'The data' };

/** Real federal QC records, with the fields that show an error circled. */
export default function DataPage() {
  return (
    <main className="app-dark cq-page">
      <div className="cq-wrap dx-wrap">
        <header className="cq-top">
          <div>
            <h1 className="font-display">The data</h1>
            <p>Every year federal reviewers re-check a sample of SNAP cases and publish what they find. First, the sample case used in this demo, with the problem circled. Below it are the federal records; pick one to see where the benefit went wrong.</p>
          </div>
        </header>
        <DataExplorer />
        <DataFooter />
      </div>
    </main>
  );
}
