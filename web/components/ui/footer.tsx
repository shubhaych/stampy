import { FOOTER_TEXT } from '@cleancase/contracts';

/** Hard rule 10: this line, verbatim, on every page. */
export function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <p className="site-footer__line" data-testid="footer-line">{FOOTER_TEXT}</p>
      </div>
    </footer>
  );
}
