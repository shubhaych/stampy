/**
 * Same-origin bridge to the Stampy worker. The browser never talks to the worker host directly, so a
 * tunnelled worker (ngrok) needs no CORS and its interstitial page cannot break the event stream or
 * document images. Bodies are streamed through unchanged, which keeps SSE live.
 */
const BASE = (process.env.WORKER_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787').replace(/\/$/, '');
const ALLOWED = /^(status|events|samples|cases|docs)(\/|$)/;

export const dynamic = 'force-dynamic';

async function forward(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const joined = path.map(encodeURIComponent).join('/');
  if (!ALLOWED.test(joined)) return Response.json({ error: 'Unknown worker resource.' }, { status: 404 });
  const headers = new Headers({ 'ngrok-skip-browser-warning': '1' });
  for (const name of ['content-type', 'accept']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  try {
    const upstream = await fetch(`${BASE}/${joined}${new URL(request.url).search}`, {
      method: request.method, headers, cache: 'no-store', signal: request.signal,
      body: hasBody ? await request.arrayBuffer() : undefined,
    });
    const out = new Headers({ 'cache-control': upstream.headers.get('cache-control') ?? 'no-store' });
    for (const name of ['content-type', 'content-disposition']) {
      const value = upstream.headers.get(name);
      if (value) out.set(name, value);
    }
    // A tunnel that is down answers with its own HTML page. Report that plainly instead of passing it on.
    if (!upstream.ok && (upstream.headers.get('content-type') ?? '').includes('text/html')) {
      return Response.json({ error: 'The Stampy worker is offline. Start it (and its tunnel), then retry.' }, { status: 503 });
    }
    if (out.get('content-type')?.includes('text/event-stream')) out.set('x-accel-buffering', 'no');
    return new Response(upstream.body, { status: upstream.status, headers: out });
  } catch {
    return Response.json({ error: 'The Stampy worker is not reachable. Start it, or check WORKER_URL.' }, { status: 503 });
  }
}

export { forward as GET, forward as POST };
