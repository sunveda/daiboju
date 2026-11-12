// A subscriber is the minimum needed to warn someone:
//   { id, ch, c (encrypted contact), lang, pref, drill, t }
// No name, no address, no location history, no account.
import { store } from './store.js';
import { decrypt, encrypt, keyedHash, randomId } from './crypto.js';

const lookupKey = (ch, contact) => `lookup:${ch}:${keyedHash('lookup', `${ch}:${contact}`)}`;

export async function upsertSubscriber({ ch, contact, lang, pref, drill = false }) {
  const s = store();
  const lk = lookupKey(ch, typeof contact === 'string' ? contact : JSON.stringify(contact));
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

export async function deleteSubscriber(id) {
  const s = store();
  const sub = await getSubscriber(id);
  if (!sub) return false;
  await s.srem(`area:${sub.pref}`, id);
  await s.del(`sub:${id}`);
  if (sub.lk) await s.del(sub.lk);
  return true;
}

export async function subscribersIn(prefCode, { drill = false } = {}) {
  const ids = await store().smembers(`area:${prefCode}`);
  const subs = (await Promise.all(ids.map(getSubscriber))).filter(Boolean);
  // Drills go only to people who signed up for drills, so real users are never spammed.
  return drill ? subs.filter((x) => x.drill) : subs;
}

export const contactOf = (sub) => decrypt(sub.c);

export const unsubToken = (id) => keyedHash('unsub', id);
