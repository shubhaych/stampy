/** Public annual snapshot import; no provider keys, private applicant records or automatic recurring scrape. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { downloadArchive, ingestArchive, PublicRecord } from '../worker/src/qc/ingest';

const root = resolve(import.meta.dirname, '..');
const source = process.argv[2];
const bytes = source ? readFileSync(resolve(source)) : await downloadArchive();
const raw = resolve(root, 'data/qc/raw');
const manifest = ingestArchive(bytes, raw);
writeFileSync(resolve(root, 'data/qc/manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const rows = readFileSync(resolve(raw, 'public-index.jsonl'), 'utf8').trim().split('\n').map((line) => PublicRecord.parse(JSON.parse(line)));
const examples = ['CA', 'TX', 'NY'].map((state) => rows.find((r) => r.state === state)!);
writeFileSync(resolve(root, 'data/qc/examples.json'), JSON.stringify({ release: manifest, examples }, null, 2) + '\n');
console.log(JSON.stringify({ source: manifest.sourceUrl, rows: manifest.rowCount, states: manifest.states.length, sha256: manifest.archiveSha256, stored: raw }));
