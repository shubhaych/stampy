import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { FIXTURE_BUNDLE } from './fixture';

afterEach(() => vi.unstubAllGlobals());
describe('worker API boundary', () => {
  it('rejects legacy queue responses instead of rendering invented empty cases', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json([{ caseId: 'GC-1', prov: 'fixture' }])));
    await expect(api.cases()).rejects.toThrow('incompatible API');
  });
  it('validates the full case bundle', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(FIXTURE_BUNDLE)));
    await expect(api.caseBundle(FIXTURE_BUNDLE.case.id)).resolves.toEqual(FIXTURE_BUNDLE);
  });
  it('reports an unreadable success response rather than indicating saved', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>error</html>')));
    await expect(api.recompute('test')).rejects.toThrow('unreadable');
  });
  it('preserves authorization and service error messages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'Sign in first' }, { status: 401 })));
    await expect(api.decide('test', 'approve', { name: 'Test', code: 'bad' })).rejects.toThrow('Sign in first');
  });
});
