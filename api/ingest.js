// POST from the listener worker. Body: one P2P Earthquake Information message, an array of them,
// or { events: [internal events] } from other adapters (e.g. the JMA weather feed).
// Auth: Authorization: Bearer INGEST_SECRET
import { bearer, baseUrl, checkSecret, json, readJson } from './_lib/http.js';
import { fromP2P, HAZARDS } from './_lib/hazards.js';
import { handleEvents } from './_lib/pipeline.js';
import { store } from './_lib/store.js';

export async function POST(request) {
  if (!checkSecret(bearer(request), 'INGEST_SECRET')) return json({ error: 'Unauthorized' }, 401);
  const body = await readJson(request);
  if (!body) return json({ error: 'Invalid JSON' }, 400);

  let events;
  if (Array.isArray(body?.events)) {
    events = body.events.filter((e) => e && HAZARDS.includes(e.hazard) && Array.isArray(e.areas) && e.id).map((e) => ({ ...e, drill: false }));
  } else {
    const msgs = Array.isArray(body) ? body : [body];
    const s = store();
    events = [];
    for (const m of msgs) {
      // The P2P feed can repeat a message; process each id once.
      if (m?.id && !(await s.set(`seen:${m.id}`, '1', { ex: 86400, nx: true }))) continue;
      events.push(...fromP2P(m));
    }
  }

  const report = await handleEvents(events, { baseUrl: baseUrl(request) });
  return json({
    ok: true,
    events: report.events,
    sent: report.deliveries.filter((d) => d.status === 'sent').length,
    simulated: report.deliveries.filter((d) => d.status === 'simulated').length,
    failed: report.deliveries.filter((d) => d.status === 'error').length,
  });
}
