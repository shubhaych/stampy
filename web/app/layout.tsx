/**
 * FROZEN after scaffold-v1. Every feature stylesheet is imported here once, so features never edit this file.
 */
import type { Metadata, Viewport } from 'next';
import { DM_Sans, Fraunces } from 'next/font/google';
import './globals.css';
import '../styles/ui.css';
import '../styles/home.css';
import '../styles/demo.css';
import '../styles/case.css';
import '../styles/pipeline.css';
import '../styles/resolve.css';
import '../styles/voice.css';
import '../styles/dashboard.css';
import '../styles/system.css';
import { Nav } from '@/components/ui/nav';
import { Footer } from '@/components/ui/footer';

const fraunces = Fraunces({ variable: '--font-fraunces', subsets: ['latin'], weight: ['400', '600', '700'], display: 'swap' });
const dmSans = DM_Sans({ variable: '--font-dm', subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Stampy', template: '%s · Stampy' },
  description: 'A document-grounded second check before SNAP benefits go out. Stampy flags and cites; a merit-staff worker decides.',
};

export const viewport: Viewport = { themeColor: '#fbf6ee', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${dmSans.variable}`}>
      <body className="min-h-screen">
        <a href="#main" className="sr-only focus:not-sr-only">Skip to content</a>
        <Nav />
        <div id="main">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
