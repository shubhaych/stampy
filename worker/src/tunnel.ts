/**
 * Public URL for webhooks (Vapi must reach this worker). PUBLIC_BASE_URL wins; otherwise ask the local
 * ngrok agent (started by `npm run dev` when NGROK_AUTHTOKEN is set) which https tunnel points at us.
 */
import { env } from './env';

let current: string | null = env.PUBLIC_BASE_URL || null;

export function publicBaseUrl(): string | null {
  return current;
}

export async function discoverTunnel(): Promise<string | null> {
  if (env.PUBLIC_BASE_URL) return (current = env.PUBLIC_BASE_URL.replace(/\/$/, ''));
  try {
    const r = await fetch(`${env.NGROK_API}/api/tunnels`, { signal: AbortSignal.timeout(1500) });
    const j = (await r.json()) as { tunnels: { public_url: string; proto: string; config?: { addr?: string } }[] };
    const t = j.tunnels.find((x) => x.public_url.startsWith('https://') && (x.config?.addr ?? '').endsWith(`:${env.WORKER_PORT}`)) ?? j.tunnels.find((x) => x.public_url.startsWith('https://'));
    current = t?.public_url ?? null;
  } catch {
    current = null;
  }
  return current;
}
