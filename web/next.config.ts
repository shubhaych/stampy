import type { NextConfig } from 'next';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// One .env.local at the repo root serves worker and web. Copy only browser-safe NEXT_PUBLIC_* values
// (never keys), and derive the worker URL from SLOT so parallel worktrees do not collide.
const root = resolve(import.meta.dirname, '..');
for (const f of ['.env.local', '.env']) {
  const p = resolve(root, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*(NEXT_PUBLIC_[A-Z0-9_]+|SLOT)\s*=\s*([^#\n]*?)\s*(?:#.*)?$/);
    if (m && !(m[1]! in process.env)) process.env[m[1]!] = m[2]!;
  }
}
const slot = Number(process.env.SLOT ?? 0) || 0;
process.env.NEXT_PUBLIC_WORKER_URL ||= `http://localhost:${8787 + slot}`;
process.env.NEXT_PUBLIC_DATA ||= 'fixture';

const nextConfig: NextConfig = {
  transpilePackages: ['@stampy/contracts', '@stampy/snap-rules'],
  allowedDevOrigins: ['*.trycloudflare.com', '*.ngrok-free.app', '*.ngrok.app'],
  env: {
    NEXT_PUBLIC_WORKER_URL: process.env.NEXT_PUBLIC_WORKER_URL,
    NEXT_PUBLIC_DATA: process.env.NEXT_PUBLIC_DATA,
  },
  turbopack: { root },
};

export default nextConfig;
