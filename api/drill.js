// POST { secret, scenario } → runs a drill through the real pipeline.
// Only subscribers who signed up with "drill" checked receive it, and every message is marked DRILL.
// Returns the previews (what each language receives) for the stage demo screen.
import { baseUrl, checkSecret, json, readJson } from './_lib/http.js';
import { buildDrill, SCENARIOS } from './_lib/drills.js';
import { handleEvents } from './_lib/pipeline.js';

export function GET() {
  return json({ scenarios: { ...Object.fromEntries(Object.entries(SCENARIOS).map(([k, v]) => [k, v.label])), 'p2p-latest': 'Replay the latest real earthquake report' } });
}

export async function POST(request) {
  const body = await readJson(request);
  if (!checkSecret(body?.secret, 'DRILL_SECRET')) return json({ error: 'Wrong drill secret' }, 401);
  const events = await buildDrill(body.scenario).catch((e) => ({ error: e.message }));
  if (!events || events.error) return json({ error: events?.error || 'Unknown scenario' }, 400);

  const t0 = Date.now();
  const report = await handleEvents(events, { baseUrl: baseUrl(request) });
  return json({ ok: true, ms: Date.now() - t0, ...report, deliveries: report.deliveries.map(({ error, ...d }) => d) });
}
