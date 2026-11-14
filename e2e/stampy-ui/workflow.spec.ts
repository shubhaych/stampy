import { test, expect } from '@playwright/test';
import { FIXTURE_BUNDLE, FIXTURE_CASE_ID, FIXTURE_SUMMARIES } from '../../web/lib/stampy/fixture';

const worker = 'http://localhost:8787';
test('loaded case queue filters state and stage @mobile', async ({ page }) => {
  await page.route(`${worker}/events`, (r) => r.abort());
  await page.route(`${worker}/cases`, (r) => r.fulfill({ json: FIXTURE_SUMMARIES }));
  await page.goto('/cases');
  await expect(page.getByRole('link', { name: 'Lena Torres' })).toBeVisible();
  await page.getByLabel('State', { exact: true }).selectOption('CA');
  await page.getByLabel('Work stage').selectOption('needs_person');
  await expect(page.getByText('No cases match these filters.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByRole('searchbox').fill('482913');
  await expect(page.getByRole('link', { name: 'Lena Torres' })).toBeVisible();
});

test('older backend produces a clear recoverable error', async ({ page }) => {
  await page.route(`${worker}/events`, (r) => r.abort());
  await page.route(`${worker}/cases`, (r) => r.fulfill({ json: [{ caseId: 'GC-1' }] }));
  await page.goto('/cases');
  await expect(page.getByRole('alert').filter({ hasText: 'incompatible API' })).toContainText('incompatible API');
  await expect(page.getByRole('button', { name: 'Refresh queue' })).toBeVisible();
});

test('worker approves outreach and reviews the returned proposal', async ({ page }) => {
  const b = structuredClone(FIXTURE_BUNDLE);
  b.case.status = 'questions_open';
  b.questions[0]!.status = 'open';
  b.outreach = [b.outreach[0]!]; b.outreach[0]!.status = 'draft';
  b.recompute = null; b.calls = []; b.inbound = [];
  await page.route(`${worker}/events`, (r) => r.abort());
  await page.route(`${worker}/cases/${b.case.id}`, (r) => r.fulfill({ json: b }));
  let sent = false;
  await page.route(`${worker}/cases/${b.case.id}/outreach/request/send`, async (r) => {
    expect(r.request().postDataJSON().worker).toEqual({ name: 'Test worker', code: 'test-code' });
    sent = true; b.outreach[0]!.status = 'simulated';
    await r.fulfill({ json: { outreach: { id: b.outreach[0]!.id, status: 'simulated', error: null } } });
  });
  await page.route(`${worker}/cases/${b.case.id}/decision`, async (r) => {
    expect(r.request().postDataJSON().action).toBe('approve');
    b.decision = { id: 'test-decision', caseId: b.case.id, action: 'approve', recomputeId: b.recompute!.id, decidedBy: 'worker:Test worker', note: null, at: b.case.updatedAt };
    b.case.status = 'approved';
    await r.fulfill({ json: { decision: b.decision } });
  });
  await page.route(`${worker}/docs/**`, (r) => r.fulfill({ status: 404 }));
  await page.goto(`/cases/${b.case.id}`);
  await expect(page.getByRole('heading', { name: 'Review the outreach request' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve and send' })).toBeDisabled();
  await page.getByRole('button', { name: 'Caseworker sign-in' }).click();
  await page.getByLabel('Caseworker name').fill('Test worker');
  await page.getByLabel('Access code').fill('test-code');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Approve and send' }).click();
  await expect(page.getByRole('heading', { name: 'Resolve the open questions' })).toBeVisible();
  expect(sent).toBe(true);
  await expect(page.getByRole('button', { name: 'Approve change' })).toBeDisabled();
  b.questions = structuredClone(FIXTURE_BUNDLE.questions); b.recompute = structuredClone(FIXTURE_BUNDLE.recompute); b.case.status = 'ready_for_review';
  await page.getByRole('button', { name: 'Refresh case' }).click();
  await expect(page.getByRole('heading', { name: 'Review the proposed change' })).toBeVisible();
  await page.getByRole('button', { name: 'Approve change' }).click();
  await expect(page.getByText('Approved · Merit staff')).toBeVisible();
});

test('fixture review has no live provenance and fits the viewport @mobile', async ({ page }, info) => {
  await page.goto(`/cases/${FIXTURE_CASE_ID}?fixture=1`);
  await expect(page.getByRole('heading', { name: 'Lena Torres' })).toBeVisible();
  await expect(page.locator('[data-prov="live"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `e2e/stampy-ui/${info.project.name}-case.png`, fullPage: true });
});
