// Shared by POST /api/ingest (remote listener) and the in-process listener in server.mjs.
import { fromP2P, HAZARDS } from './hazards.js';
import { handleEvents } from './pipeline.js';
import { store } from './store.js';

/** body: one P2P message, an array of them, or { events: [internal events] } from other adapters. */
export async function ingest(body, { baseUrl }) {
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
  const report = await handleEvents(events, { baseUrl });
  return {
    ok: true,
    events: report.events,
    sent: report.deliveries.filter((d) => d.status === 'sent').length,
    simulated: report.deliveries.filter((d) => d.status === 'simulated').length,
    failed: report.deliveries.filter((d) => d.status === 'error').length,
  };
}
