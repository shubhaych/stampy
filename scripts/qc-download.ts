/** Explicit public-use archive download. Run: node --import tsx scripts/qc-download.ts */
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ROOT } from './lib';

const release = JSON.parse(readFileSync(join(ROOT, 'data/qc/fy2024-release.json'), 'utf8')) as {
  fiscalYear: number; revision: string; url: string; catalog: string; documentation: string; documentedRows: number;
};
const destination = join(ROOT, 'data/qc/raw', `qcfy${release.fiscalYear}_${release.revision}.zip`);
const temporary = `${destination}.partial`;
if (existsSync(destination)) {
  console.log(`QC archive already present: ${destination}`);
  process.exit(0);
}
mkdirSync(join(ROOT, 'data/qc/raw'), { recursive: true });
try {
  const response = await fetch(release.url, { signal: AbortSignal.timeout(60_000), redirect: 'follow' });
  if (!response.ok || !response.body) throw new Error(`download returned HTTP ${response.status}; obtain the public archive manually from ${release.catalog} if access is blocked`);
  const finalUrl = new URL(response.url);
  if (finalUrl.protocol !== 'https:' || finalUrl.hostname !== 'snapqcdata.net') throw new Error(`unexpected download host: ${finalUrl.hostname}`);
  const type = response.headers.get('content-type') ?? '';
  if (/text\/html/i.test(type)) throw new Error('download returned HTML instead of an archive');
  await pipeline(Readable.fromWeb(response.body as never), createWriteStream(temporary));
  const bytes = readFileSync(temporary);
  if (bytes.length < 1024 || bytes.length > 50_000_000 || bytes.subarray(0, 4).toString('hex') !== '504b0304') throw new Error('download is not an expected ZIP archive');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  renameSync(temporary, destination);
  writeFileSync(`${destination}.meta.json`, JSON.stringify({ ...release, retrievedAt: new Date().toISOString(), sha256, bytes: bytes.length }, null, 2) + '\n');
  console.log(`Saved public-use FY${release.fiscalYear} archive (${bytes.length} bytes, SHA-256 ${sha256})`);
  console.log(`Source: ${release.catalog}; documentation: ${release.documentation}`);
} catch (error) {
  rmSync(temporary, { force: true });
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
