// GET ?e=eventId&p=prefCode&l=lang → guidance for the /go page.
// Contains nothing personal, so it can be cached and shared.
import { json } from './_lib/http.js';
import { store } from './_lib/store.js';
import { prefByCode } from './_lib/areas.js';
import { decideAction, shelterLayerFor, ACTION_NEEDS_ROUTE } from './_lib/hazards.js';
import { fallbackGuidance } from './_lib/templates.js';

export async function GET(request) {
  const url = new URL(request.url);
  const e = url.searchParams.get('e') || '';
  const p = prefByCode(url.searchParams.get('p') || '');
  const l = (url.searchParams.get('l') || 'en').slice(0, 5);
  if (!p) return json({ error: 'Unknown prefecture' }, 400);

  const s = store();
  const event = JSON.parse((await s.get(`evt:${e}`)) || 'null');
  const area = event?.areas.find((a) => a.prefCode === p.code) || {};
  const hazard = event?.hazard || url.searchParams.get('h') || 'other';
  const action = decideAction(hazard, area);
  const guidance = JSON.parse((await s.get(`guide:${e}:${p.code}:${l}`)) || 'null') || fallbackGuidance(action, l);

  return json({
    event: event ? { id: event.id, hazard, drill: Boolean(event.drill), issuedAt: event.issuedAt, facts: event.facts } : null,
    pref: { code: p.code, en: p.en, ja: p.ja },
    area,
    action,
    showRoute: ACTION_NEEDS_ROUTE.has(action),
    shelterLayer: shelterLayerFor(hazard, action),
    guidance,
  }, 200, { 'Cache-Control': 'public, max-age=30' });
}
