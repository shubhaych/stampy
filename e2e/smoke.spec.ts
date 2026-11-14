/**
 * G0 smoke: every route returns 200 in fixture mode with no console errors,
 * and every money/percent text node sits inside a [data-figure] that carries a [data-prov] badge, or inside a
 * [data-prov-scope] whose visible [data-prov-note] names the source and provenance (rule 8).
 */
import { expect, test } from '@playwright/test';
import { SMOKE_ROUTES } from '../web/lib/routes';

for (const route of SMOKE_ROUTES) {
  test(`${route} renders in fixture mode @mobile`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    const res = await page.goto(route);
    expect(res?.status(), `${route} status`).toBe(200);

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
        if (fig && fig.querySelector('[data-prov]')) continue;
        // Pitch pages may use one visible source note per section instead of inline badges.
        const scope = el.closest('[data-prov-scope]');
        const note = scope ? document.getElementById(scope.getAttribute('data-prov-scope') ?? '') : null;
        if (note && note.hasAttribute('data-prov-note') && note.getClientRects().length > 0) continue;
        out.push(text.trim().slice(0, 80));
      }
      return out;
    });
    expect(unbadged, `${route} figures without a badge`).toEqual([]);
    expect(errors, `${route} console errors`).toEqual([]);
  });
}
