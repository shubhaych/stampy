'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ROUTES, isDeckPath } from '@/lib/routes';

const LINKS = [
  { href: ROUTES.demo, label: 'Demo' },
  { href: `${ROUTES.home}#how`, label: 'How it works' },
  { href: `${ROUTES.home}#numbers`, label: 'Numbers' },
  { href: ROUTES.system, label: 'System' },
];

export function Nav() {
  const path = usePathname() ?? '/';
  const deck = isDeckPath(path);
  const [overHero, setOverHero] = useState(path === '/');
  useEffect(() => {
    if (path !== '/') return setOverHero(false);
    const on = () => setOverHero(window.scrollY < 40);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [path]);
  const cls = deck ? 'nav nav--deck' : overHero ? 'nav nav--over-hero' : 'nav';
  if (path.startsWith('/upload/')) return null;
  return (
    <header className={cls}>
      <nav className="wrap nav__inner" aria-label="Main">
        <Link href={ROUTES.home} className="nav__mark">
          <span className="nav__square" aria-hidden />
          Stampy
        </Link>
        <div className="nav__links">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={path === l.href ? 'page' : undefined}>
              {l.label}
            </Link>
          ))}
        </div>
        <Link href={ROUTES.demo} className="text-cta" style={{ minHeight: 0 }}>
          Work a case
        </Link>
      </nav>
    </header>
  );
}
