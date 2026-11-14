export const ROUTES = {
  home: '/',
  demo: '/demo',
  queue: '/demo/queue',
  case: (id: string) => `/case/${encodeURIComponent(id)}`,
  gate: (id: string) => `/case/${encodeURIComponent(id)}/gate`,
  debrief: (id: string) => `/case/${encodeURIComponent(id)}/debrief`,
  dashboard: '/dashboard',
  upload: (token: string) => `/upload/${encodeURIComponent(token)}`,
  voiceAnswer: (callId: string) => `/voice/answer/${encodeURIComponent(callId)}`,
  data: '/data',
  apply: '/apply',
  applyDone: (id: string) => `/apply/${encodeURIComponent(id)}`,
  cases: '/cases',
  caseV2: (id: string) => `/cases/${encodeURIComponent(id)}`,
} as const;

/** Work pages render on the dark command deck. */
export function isDeckPath(path: string): boolean {
  return /^\/(demo|case|cases|data|dashboard|voice)(\/|$)/.test(path);
}

/** Every route, for the smoke test. */
export const SMOKE_ROUTES = [
  '/', '/demo', '/demo/queue', '/case/GC-1', '/case/GC-1/gate', '/case/GC-1/debrief',
  '/dashboard', '/upload/demo-token', '/voice/answer/CALL-GC1-1',
] as const;
