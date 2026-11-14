import { CaseBundle, Debrief, QueueItem, ServerEvent, Shift, StateProfile, SystemStatus, WorkerRoutes } from '@cleancase/contracts';
import type { z } from 'zod';
import type { DataSource } from './index';

const BASE = (process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:8787').replace(/\/$/, '');

async function get<S extends z.ZodTypeAny>(path: string, schema: S): Promise<z.infer<S> | null> {
  const res = await fetch(`${BASE}${path}`, { cache: 'no-store' });
  if (res.status === 404 || res.status === 423) return null;
  if (!res.ok) throw new Error(`worker ${path}: ${res.status}`);
  return schema.parse(await res.json());
}

export const liveSource: DataSource = {
  kind: 'live',
  async states() {
    return (await get(WorkerRoutes.states, StateProfile.array())) ?? [];
  },
  async startShift(state, seed) {
    const res = await fetch(`${BASE}${WorkerRoutes.shift}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ state, seed }) });
    return Shift.parse(await res.json());
  },
  async queue() {
    return (await get(WorkerRoutes.cases, QueueItem.array())) ?? [];
  },
  caseBundle: (id) => get(WorkerRoutes.case(id), CaseBundle),
  debrief: (id) => get(WorkerRoutes.debrief(id), Debrief),
  async status() {
    const s = await get(WorkerRoutes.status, SystemStatus);
    if (!s) throw new Error('worker status unavailable');
    return s;
  },
  subscribe(onEvent) {
    if (typeof window === 'undefined') return () => {};
    const es = new EventSource(`${BASE}${WorkerRoutes.events}`);
    const handler = (m: MessageEvent) => {
      const parsed = ServerEvent.safeParse(JSON.parse(m.data));
      if (parsed.success) onEvent(parsed.data);
    };
    for (const t of ServerEvent.options.map((o) => o.shape.type.value)) es.addEventListener(t, handler);
    return () => es.close();
  },
};
