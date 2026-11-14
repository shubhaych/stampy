import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

/** Underlined serif text link (Vouch style). No pill. */
export function TextCta({ href, children, className = '' }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={`text-cta ${className}`}>
      {children}
    </Link>
  );
}

type BtnVariant = 'primary' | 'ghost' | 'over' | 'under' | 'proof';

/** Pill button for in-app actions. */
export function Btn({ variant = 'primary', className = '', ...rest }: ComponentProps<'button'> & { variant?: BtnVariant }) {
  return <button type="button" className={`btn btn--${variant} ${className}`} {...rest} />;
}
