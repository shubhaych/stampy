export const ROUTES = {
  home: '/',
  demo: '/demo',
  queue: '/demo/queue',
  case: (id: string) => `/case/${encodeURIComponent(id)}`,
  gate: (id: string) => `/case/${encodeURIComponent(id)}/gate`,
  debrief: (id: string) => `/case/${encodeURIComponent(id)}/debrief`,
  dashboard: '/dashboard',
  system: '/system',
  upload: (token: string) => `/upload/${encodeURIComponent(token)}`,
  voiceAnswer: (callId: string) => `/voice/answer/${encodeURIComponent(callId)}`,
} as const;

/** Work pages render on the dark command deck. */
export function isDeckPath(path: string): boolean {
  return /^\/(demo|case|dashboard|system|voice)(\/|$)/.test(path);
}

/** Every route, for the smoke test. */
export const SMOKE_ROUTES = [
  '/', '/demo', '/demo/queue', '/case/GC-1', '/case/GC-1/gate', '/case/GC-1/debrief',
  '/dashboard', '/system', '/upload/demo-token', '/voice/answer/CALL-GC1-1',
] as const;
