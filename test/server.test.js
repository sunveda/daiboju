import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.CHANNELS_DRY_RUN = '1';
process.env.ALLOWED_ORIGINS = 'https://sunveda.tech';
const { createServer } = await import('../server.mjs');

let server, base;
before(async () => {
  server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test('serves pages with clean URLs and health', async () => {
  assert.equal((await fetch(`${base}/`)).status, 200);
  const go = await fetch(`${base}/go`);
  assert.equal(go.status, 200);
  assert.match(go.headers.get('content-type'), /text\/html/);
  assert.equal((await fetch(`${base}/sw.js`)).headers.get('cache-control'), 'no-cache');
  assert.deepEqual(await (await fetch(`${base}/healthz`)).json(), { ok: true, listener: 'off' });
});

test('blocks path traversal and unknown API routes', async () => {
  assert.equal((await fetch(`${base}/..%2fserver.mjs`)).status, 404);
  assert.equal((await fetch(`${base}/api/_lib`)).status, 404);
  assert.equal((await fetch(`${base}/api/nope`)).status, 404);
});

test('CORS only for sunveda.tech on browser endpoints', async () => {
  const ok = await fetch(`${base}/api/config`, { headers: { Origin: 'https://sunveda.tech' } });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://sunveda.tech');
  const other = await fetch(`${base}/api/config`, { headers: { Origin: 'https://evil.example' } });
  assert.equal(other.headers.get('access-control-allow-origin'), null);
  const pre = await fetch(`${base}/api/subscribe`, { method: 'OPTIONS', headers: { Origin: 'https://sunveda.tech' } });
  assert.equal(pre.status, 204);
  const ingest = await fetch(`${base}/api/ingest`, { method: 'POST', headers: { Origin: 'https://sunveda.tech' }, body: '{}' });
  assert.equal(ingest.headers.get('access-control-allow-origin'), null, 'server-to-server endpoints get no CORS');
});
