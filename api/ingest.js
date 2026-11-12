// POST from a remote listener. Body: one P2P Earthquake Information message, an array of them,
// or { events: [internal events] } from other adapters (e.g. the JMA weather feed).
// Auth: Authorization: Bearer INGEST_SECRET
// (On Cloud Run the listener runs inside server.mjs and calls the same ingest() directly.)
import { bearer, baseUrl, checkSecret, json, readJson } from './_lib/http.js';
import { ingest } from './_lib/ingest.js';

export async function POST(request) {
  if (!checkSecret(bearer(request), 'INGEST_SECRET')) return json({ error: 'Unauthorized' }, 401);
  const body = await readJson(request);
  if (!body) return json({ error: 'Invalid JSON' }, 400);
  return json(await ingest(body, { baseUrl: baseUrl(request) }));
}
