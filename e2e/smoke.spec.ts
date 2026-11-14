/**
 * G0 smoke: every route returns 200 in fixture mode with no console errors, renders the rule 10 footer,
 * and every money/percent text node sits inside a [data-figure] that carries a [data-prov] badge (rule 8).
 */
import { expect, test } from '@playwright/test';
import { FOOTER_TEXT } from '../packages/contracts/src/routes';
import { SMOKE_ROUTES } from '../web/lib/routes';

for (const route of SMOKE_ROUTES) {
  test(`${route} renders in fixture mode @mobile`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    const res = await page.goto(route);
    expect(res?.status(), `${route} status`).toBe(200);
    await expect(page.getByTestId('footer-line')).toHaveText(FOOTER_TEXT);

    const unbadged = await page.evaluate(() => {
      const out: string[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const re = /\$\s?\d|\d(?:\.\d+)?\s?%/;
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const text = n.textContent ?? '';
        if (!re.test(text)) continue;
        const el = n.parentElement;
        if (!el || el.closest('script,style,[data-badge-exempt]')) continue;
        const fig = el.closest('[data-figure]');
        if (!fig || !fig.querySelector('[data-prov]')) out.push(text.trim().slice(0, 80));
      }
      return out;
    });
    expect(unbadged, `${route} figures without a badge`).toEqual([]);
    expect(errors, `${route} console errors`).toEqual([]);
  });
}
