/**
 * npm run hello:moss — owned by ops until the policy feature picks the Moss package.
 * Package names conflict across sources (@inferedge/moss vs @moss-dev/moss); the policy feature checks
 * docs.moss.dev, records the choice in docs/ARCHITECTURE.md, and replaces this body with createIndex → loadIndex → query.
 */
import { envValue } from './lib';

if (envValue('MOSS_MODE', 'local') !== 'live' || !envValue('MOSS_PROJECT_KEY')) {
  console.log('moss: local BM25 fallback mode (labelled on screen)');
  console.log('UNVERIFIED-LIVE: moss: set MOSS_MODE=live, MOSS_PROJECT_ID, MOSS_PROJECT_KEY, then npm run hello:moss');
  process.exit(0);
}
console.log('UNVERIFIED-LIVE: moss: client package not chosen yet (policy feature). See docs/ARCHITECTURE.md.');
