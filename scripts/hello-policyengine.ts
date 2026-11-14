/** npm run hello:policyengine — reachability check for the optional cross-check. Off by default. */
import { envValue } from './lib';

if (envValue('POLICYENGINE_MODE', 'off') !== 'api') {
  console.log('policyengine: off (cross-check not shown in the UI)');
  console.log('UNVERIFIED-LIVE: policyengine: set POLICYENGINE_MODE=api, then npm run hello:policyengine');
  process.exit(0);
}
const base = envValue('POLICYENGINE_API_URL', 'https://api.policyengine.org').replace(/\/$/, '');
const t0 = performance.now();
const res = await fetch(base).catch((e: Error) => ({ ok: false, status: 0, statusText: e.message }) as Response);
console.log(`policyengine ${res.ok ? 'reachable' : 'unreachable'} · ${base} · ${res.status} · ${Math.round(performance.now() - t0)} ms`);
console.log('UNVERIFIED-LIVE: policyengine: household calculation request is built by the seats feature (recompute)');
