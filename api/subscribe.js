// POST { channel, contact, lang, pref, drill? }
//   channel: webpush (contact = PushSubscription JSON) | email | sms | whatsapp (contact = +E.164) | line (no contact)
// For LINE the user is not known yet, so we return a 6-digit code to send to the official account.
import { json, readJson, clientIp } from './_lib/http.js';
import { store } from './_lib/store.js';
import { prefByCode } from './_lib/areas.js';
import { LANGUAGES } from './_lib/templates.js';
import { CHANNELS, validContact } from './_lib/channels.js';
import { upsertSubscriber, unsubToken } from './_lib/subscribers.js';
import { randomCode } from './_lib/crypto.js';

export async function POST(request) {
  const s = store();
  if ((await s.incr(`rl:sub:${clientIp(request)}`, 3600)) > 30) return json({ error: 'Too many requests' }, 429);

  const body = await readJson(request);
  if (!body) return json({ error: 'Invalid JSON' }, 400);
  const { channel, contact, lang, pref, drill } = body;

  if (!CHANNELS.includes(channel)) return json({ error: 'Unknown channel' }, 400);
  if (!LANGUAGES[lang]) return json({ error: 'Unsupported language' }, 400);
  if (!prefByCode(pref)) return json({ error: 'Unknown prefecture' }, 400);

  if (channel === 'line') {
    const code = randomCode();
    await s.set(`pending:${code}`, JSON.stringify({ lang, pref: prefByCode(pref).code, drill: Boolean(drill) }), { ex: 900 });
    return json({ ok: true, channel, code, lineAddUrl: process.env.LINE_ADD_URL || null, expiresInSec: 900 });
  }

  const value = typeof contact === 'string' ? contact.trim() : contact;
  if (!validContact(channel, value)) return json({ error: 'Invalid contact for this channel' }, 400);

  const sub = await upsertSubscriber({ ch: channel, contact: value, lang, pref: prefByCode(pref).code, drill });
  return json({ ok: true, channel, id: sub.id, unsubToken: unsubToken(sub.id) });
}
