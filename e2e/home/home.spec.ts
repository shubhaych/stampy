/** G1 homepage acceptance: screenshots at 1440 and 390, reduced-motion static path, keyboard reach, no overflow. */
import { expect, test } from '@playwright/test';

const SHOTS = 'e2e/home/shots';

test.describe('homepage', () => {
  test('1440 desktop: animated scenes, full-page screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Check the case before the benefit goes out.');
    await expect(page.locator('.case-wheel')).toBeVisible();
    await expect(page.locator('.pass-track')).toHaveCount(1);
    await page.screenshot({ path: `${SHOTS}/home-1440-hero.png` });
    await page.screenshot({ path: `${SHOTS}/home-1440-full.png`, fullPage: true });
  });

  test('390 mobile: static stacked versions, no horizontal scroll @mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.locator('.pass-static')).toBeVisible();
    await expect(page.locator('.case-wheel')).toHaveCount(0);
    await expect(page.locator('.stats__track')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.screenshot({ path: `${SHOTS}/home-390-full.png`, fullPage: true });
  });

  test('reduced motion renders the static scenes at desktop width', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(page.locator('.pass-static')).toBeVisible();
    await expect(page.locator('.case-wheel')).toHaveCount(0);
    await ctx.close();
  });

  test('keyboard reaches the primary CTA', async ({ page }) => {
    await page.goto('/');
    const cta = page.locator('.hero').getByRole('link', { name: /Work a case/ });
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      if (await cta.evaluate((el) => el === document.activeElement)) break;
    }
    await expect(cta).toBeFocused();
  });
});
