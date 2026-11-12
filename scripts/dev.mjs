// Local development: the production server with safe defaults (in-memory store, dry-run channels).
// Reads .env.local if present.  npm run dev  →  http://localhost:3000
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const envFile = join(root, '.env.local');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
process.env.CHANNELS_DRY_RUN ??= '1';
process.env.DRILL_SECRET ||= 'drill';
process.env.INGEST_SECRET ||= 'ingest';
process.env.PORT ||= '3000';
process.env.ALLOWED_ORIGINS ||= `https://sunveda.tech,http://localhost:${process.env.PORT}`;

const { createServer } = await import('../server.mjs');
createServer().listen(Number(process.env.PORT), () =>
  console.log(`Daiboju dev server → http://localhost:${process.env.PORT}  (drill secret: ${process.env.DRILL_SECRET})`));
