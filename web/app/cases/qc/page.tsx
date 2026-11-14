import Link from 'next/link';
import { QcBrowser } from '@/components/stampy/qc-browser';
import { DataFooter } from '@/components/stampy/common';
import '@/styles/qc.css';

export const metadata = { title: 'Public SNAP QC records' };

export default function QcPage() {
  return <main className="app-dark qc-page">
    <div className="qc-wrap">
      <header className="qc-header">
        <div><Link href="/cases" className="stp-link">← Worker queue</Link><h1>Public SNAP QC records</h1></div>
        <Link href="/cases/sources" className="stp-link">About these sources</Link>
      </header>
      <p className="qc-intro">Anonymized historical public-use records. These are source data for replay, not applicant files: no original forms, paystubs or contact details are included.</p>
      <QcBrowser />
      <DataFooter />
    </div>
  </main>;
}
