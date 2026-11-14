import Link from 'next/link';
import { DeckPage, Badge } from '@/components/ui';
import { QcImportStatus } from '@/components/stampy/qc-browser';
import { DataFooter } from '@/components/stampy/common';

export const metadata = { title: 'SNAP data sources' };

export default function SourcesPage() {
  return <DeckPage eyebrow="Caseworker / Sources" title="Where the records come from">
    <Link href="/cases" className="stp-link">← Case queue</Link>
    <div className="grid gap-4 mt-6">
      <section className="panel">
        <h2 className="panel__title">Public QC case records <Badge kind="replay" /></h2>
        <p>USDA publishes anonymized historical quality-control records. These can support case replays; the public release does not contain applicant paystubs, leases or contact details.</p>
        <QcImportStatus />
        <a className="stp-link" href="https://snapqcdata.net/datafiles" target="_blank" rel="noreferrer">Open the public release catalog ↗</a>
      </section>
      <section className="panel">
        <h2 className="panel__title">Sample applications <Badge kind="synthetic" /></h2>
        <p>The application page offers generated test documents. Running Claude on a generated document does not turn it into a real applicant record. Synthetic inputs remain marked throughout the case review.</p>
        <Link className="stp-link" href="/apply">Open application upload →</Link>
      </section>
      <section className="panel">
        <h2 className="panel__title">State policy sources</h2>
        <p>The ERS policy dataset describes historical state policy options. Check coverage dates and the applicable state manual before using a rule in a current case.</p>
        <ul className="grid gap-3">
          <li><a className="stp-link" href="https://ers.usda.gov/data-products/snap-policy-data-sets" target="_blank" rel="noreferrer">USDA ERS policy data and documentation ↗</a></li>
          <li><a className="stp-link" href="https://www.ecfr.gov/current/title-7/subtitle-B/chapter-II/subchapter-C" target="_blank" rel="noreferrer">Federal SNAP regulations ↗</a></li>
          <li><a className="stp-link" href="https://www.cdss.ca.gov/inforesources/letters-regulations/legislation-and-regulations/calworks-calfresh-regulations/calfresh-regulations" target="_blank" rel="noreferrer">California Food Stamp Manual ↗</a></li>
        </ul>
      </section>
    </div>
    <DataFooter />
  </DeckPage>;
}
