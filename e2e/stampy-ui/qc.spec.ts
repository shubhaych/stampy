import { test, expect } from '@playwright/test';

/** Uses the imported public archive through the real read-only QC worker; no network mocks. */
test('public QC records retain release proof and paginate by state @mobile', async ({ page, request }, info) => {
  const status = await request.get('/cases/qc/data/status');
  expect(status.ok()).toBe(true);
  const imported = await status.json() as { available: boolean; rowCount: number; release: { archiveSha256: string } };
  expect(imported.available).toBe(true);
  expect(imported.rowCount).toBe(44891);
  const response = await request.get('/cases/qc/data/cases?state=CA&offset=0&limit=25');
  expect(response.ok()).toBe(true);
  const data = await response.json() as { items: { id: string; householdId: string; state: string; sourceRecord: number }[]; total: number };
  expect(data.items.length).toBe(25);
  expect(data.items.every((row) => row.state === 'CA')).toBe(true);
  await page.goto('/cases/qc');
  await expect(page.getByLabel('QC state').getByRole('option', { name: 'California (CA)', exact: true })).toBeAttached();
  const filtered = page.waitForResponse((r) => r.url().includes('/cases/qc/data/cases?') && new URL(r.url()).searchParams.get('state') === 'CA');
  await page.getByLabel('QC state').selectOption('CA');
  await filtered;
  await page.getByRole('button', { name: `${data.items[0]!.householdId} Replay`, exact: true }).click();
  const detail = page.getByRole('complementary', { name: 'Source record detail' });
  await expect(detail.getByText('HHLDNO', { exact: false })).toBeVisible();
  await expect(detail.getByText(imported.release.archiveSha256, { exact: true })).toBeVisible();
  await expect(detail.getByText(String(data.items[0]!.sourceRecord), { exact: true })).toBeVisible();
  await expect(page.locator('[data-prov="live"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `e2e/stampy-ui/${info.project.name}-qc.png`, fullPage: true });
  const next = page.waitForResponse((r) => r.url().includes('/cases/qc/data/cases?') && new URL(r.url()).searchParams.get('offset') === '25');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await next;
  await expect(page.getByRole('button', { name: `${data.items[0]!.householdId} Replay`, exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeEnabled();
});

test('QC proxy rejects unknown resources', async ({ request }) => {
  const response = await request.get('/cases/qc/data/secrets');
  expect(response.status()).toBe(404);
});
