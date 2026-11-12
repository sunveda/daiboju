// A subscriber is the minimum needed to warn someone:
//   { id, ch, c (encrypted contact), lang, pref, drill, t }
// No name, no address, no location history, no account.
import { store } from './store.js';
import { decrypt, encrypt, keyedHash, randomId } from './crypto.js';

// Web Push subscriptions are identified by their endpoint (the keys and expiry can be re-serialised).
const contactKey = (ch, contact) => {
  if (ch !== 'webpush') return String(contact);
  try { return (typeof contact === 'string' ? JSON.parse(contact) : contact).endpoint || String(contact); } catch { return String(contact); }
};
const lookupKey = (ch, contact) => `lookup:${ch}:${keyedHash('lookup', `${ch}:${contactKey(ch, contact)}`)}`;

export async function upsertSubscriber({ ch, contact, lang, pref, drill = false }) {
  const s = store();
  const lk = lookupKey(ch, contact);
  const existingId = await s.get(lk);
  if (existingId) await deleteSubscriber(existingId);

  const sub = {
    id: randomId(),
    ch,
    c: encrypt(typeof contact === 'string' ? contact : JSON.stringify(contact)),
    lk,
    lang,
    pref,
    drill: Boolean(drill),
    t: Date.now(),
  };
  await s.set(`sub:${sub.id}`, JSON.stringify(sub));
  await s.set(lk, sub.id);
  await s.sadd(`area:${pref}`, sub.id);
  return sub;
}

export async function getSubscriber(id) {
  const raw = await store().get(`sub:${id}`);
  return raw ? JSON.parse(raw) : null;
}

export async function findSubscriber(ch, contact) {
  const id = await store().get(lookupKey(ch, contact));
  return id ? getSubscriber(id) : null;
}

// renewable: the address expired (not an unsubscribe). Keep only language, area and drill choice
// under the hashed lookup key for 30 days, so a browser's push renewal can restore the record.
export async function deleteSubscriber(id, { renewable = false } = {}) {
  const s = store();
  const sub = await getSubscriber(id);
  if (!sub) return false;
  await s.srem(`area:${sub.pref}`, id);
  await s.del(`sub:${id}`);
  if (sub.lk) {
    await s.del(sub.lk);
    if (renewable) await s.set(`renew:${sub.lk}`, JSON.stringify({ lang: sub.lang, pref: sub.pref, drill: sub.drill }), { ex: 30 * 24 * 3600 });
    else await s.del(`renew:${sub.lk}`);
  }
  return true;
}

// For a push renewal: the live record for this old subscription, or the note left when it expired.
export async function takeRenewable(ch, contact) {
  const s = store();
  const lk = lookupKey(ch, contact);
  const id = await s.get(lk);
  if (id) {
    const sub = await getSubscriber(id);
    if (sub) return { lang: sub.lang, pref: sub.pref, drill: sub.drill, id };
  }
  const note = await s.get(`renew:${lk}`);
  if (!note) return null;
  await s.del(`renew:${lk}`);
  return JSON.parse(note);
}

export async function subscribersIn(prefCode, { drill = false } = {}) {
  const ids = await store().smembers(`area:${prefCode}`);
  const subs = (await Promise.all(ids.map(getSubscriber))).filter(Boolean);
  // Drills go only to people who signed up for drills, so real users are never spammed.
  return drill ? subs.filter((x) => x.drill) : subs;
}

export const contactOf = (sub) => decrypt(sub.c);

export const unsubToken = (id) => keyedHash('unsub', id);
