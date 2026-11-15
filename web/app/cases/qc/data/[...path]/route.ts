/** Read-only same-origin bridge to the worker's public QC index. Web never opens source files or a database. */
export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const record = path[0] === 'cases' && /^qc-\d{4}-[A-Za-z0-9-]+$/.test(path[1] ?? '');
  if (!(path.length === 1 && (path[0] === 'status' || path[0] === 'cases' || path[0] === 'featured' || path[0] === 'findings')) &&
      !(path.length === 2 && record) && !(path.length === 3 && record && path[2] === 'documents')) {
    return Response.json({ error: 'Unknown QC resource.' }, { status: 404 });
  }
  // The main worker serves /qc too; QC_WORKER_URL points at a separate read-only QC worker if one is used.
  const base = (process.env.QC_WORKER_URL || process.env.WORKER_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787').replace(/\/$/, '');
  const upstream = new URL(`${base}/qc/${path.map(encodeURIComponent).join('/')}`);
  const query = new URL(request.url).searchParams;
  for (const key of ['state', 'offset', 'limit', 'seed']) if (query.has(key)) upstream.searchParams.set(key, query.get(key)!);
  try {
    const response = await fetch(upstream, { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
    const body = await response.json().catch(() => null);
    if (body === null) return Response.json({ error: 'QC worker returned an unreadable response.' }, { status: 502 });
    return Response.json(body, { status: response.status, headers: { 'cache-control': 'no-store' } });
  } catch {
    return Response.json({ error: 'The Stampy worker is not reachable for QC records. Start it (npm run dev).' }, { status: 503 });
  }
}
