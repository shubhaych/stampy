/** G1 homepage acceptance: screenshots at 1440 and 390, reduced-motion static path, keyboard reach, no overflow. */
import { expect, test } from '@playwright/test';

const SHOTS = 'e2e/home/shots';

test.describe('homepage', () => {
  test('1440 desktop: card-wheel hero, issue scroll, walkthrough', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Check the case before the benefit goes out.');
    await expect(page.locator('.case-wheel')).toBeVisible();
    await expect(page.locator('#issue-sources')).toBeVisible();
    await expect(page.locator('.problem__track')).toHaveCount(1);
    await expect(page.locator('[data-scroll-hold]')).toHaveCount(6);
    await page.screenshot({ path: `${SHOTS}/home-1440-hero.png` });
    await page.locator('#walkthrough').scrollIntoViewIfNeeded();
    await expect(page.locator('.wt-cursor')).toBeVisible({ timeout: 5000 });
    await page.getByRole('tab', { name: /Resolve conflicts/ }).click();
    await expect(page.locator('.wt-question')).toBeVisible();
    await page.waitForTimeout(8500);
    await expect(page.locator('.wt-recompute')).toContainText('$2,666');
    await page.locator('#walkthrough').screenshot({ path: `${SHOTS}/home-1440-walkthrough.png` });
    await page.screenshot({ path: `${SHOTS}/home-1440-full.png`, fullPage: true });
  });

  test('390 mobile: static stacked versions, no horizontal scroll @mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.locator('.problem__static')).toBeVisible();
    await expect(page.locator('.problem__track')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.screenshot({ path: `${SHOTS}/home-390-full.png`, fullPage: true });
  });

  test('reduced motion: static hero and beats, no cursor travel', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(page.locator('.case-wheel')).toHaveCount(0);
    await expect(page.locator('.problem__static')).toBeVisible();
    await page.locator('#walkthrough').scrollIntoViewIfNeeded();
    await page.getByRole('tab', { name: /Certify/ }).click();
    await expect(page.locator('.wt-gate')).toBeVisible();
    await expect(page.locator('.wt-cursor')).toHaveCount(0);
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
