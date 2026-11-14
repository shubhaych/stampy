/** Same-origin bridge to the worker's source-bound second check. No API secret enters web. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const base = (process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:8787').replace(/\/$/, '');
  try {
    const response = await fetch(`${base}/seats/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ caseId: id, action: 'final_review' }),
      cache: 'no-store',
      signal: AbortSignal.timeout(35_000),
    });
    return new Response(await response.text(), { status: response.status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  } catch {
    return Response.json({ status: 'needs_human', reason: 'AI review service is unavailable. Continue with worker review.' }, { status: 503 });
  }
}
