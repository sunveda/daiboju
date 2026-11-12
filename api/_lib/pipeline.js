// The two-message flow.
//   Stage 1 (seconds): fixed, pre-translated "protect yourself now" text. No AI, no waiting.
//   Stage 2 (once severity is known): rules decide the action, Argon explains it in each
//            language, and the message links to /go for the route to the nearest safe place.
// Guidance is generated once per (event, prefecture, language), never per person.
import { store } from './store.js';
import { prefByCode } from './areas.js';
import { decideAction, isAlertable, scaleLabel } from './hazards.js';
import { argonGuidance } from './argon.js';
import { stage1Text, ui } from './templates.js';
import { send } from './channels.js';
import { contactOf, deleteSubscriber, subscribersIn, unsubToken } from './subscribers.js';

const DAY = 86400;

export async function handleEvents(events, { baseUrl = '', publicUrl = process.env.PUBLIC_URL || baseUrl } = {}) {
  publicUrl = publicUrl.replace(/\/$/, '');
  const report = { events: [], deliveries: [], previews: [] };
  for (const event of events) {
    const r = event.stage === 1 ? await stage1(event, baseUrl, report) : await stage2(event, baseUrl, publicUrl, report);
    report.events.push({ id: event.id, hazard: event.hazard, stage: event.stage, drill: Boolean(event.drill), ...r });
  }
  return report;
}

async function stage1(event, baseUrl, report) {
  const s = store();
  let areas = 0;
  const gate = event.hazard === 'tsunami' ? 'tsunami:stage1' : event.hazard;
  for (const area of event.areas.filter((a) => isAlertable(gate, a))) {
    // One first alert per hazard and prefecture per 10 minutes: an EEW and the
    // intensity report that follows it are the same earthquake for a person on the ground.
    const key = event.drill ? `s1:drill:${event.id}:${area.prefCode}` : `s1:${event.hazard}:${area.prefCode}`;
    const fresh = await s.set(key, event.id, { ex: 600, nx: true });
    if (!fresh) continue;
    areas++;
    const subs = await subscribersIn(area.prefCode, { drill: event.drill });
    await deliver(subs, (lang) => ({
      title: `${event.drill ? ui('drill', lang) : ''}Daiboju`,
      text: `${event.drill ? ui('drill', lang) : ''}${stage1Text(event.hazard, lang)}`,
    }), { event, area, stage: 1, baseUrl, report });
  }
  return { areas };
}

async function stage2(event, baseUrl, publicUrl, report) {
  const s = store();
  await s.set(`evt:${event.id}`, JSON.stringify(event), { ex: 3 * DAY });
  let areas = 0;
  for (const area of event.areas.filter((a) => isAlertable(event.hazard, a))) {
    const fresh = await s.set(`s2:${event.id}:${area.prefCode}`, '1', { ex: DAY, nx: true });
    if (!fresh) continue;
    areas++;
    const pref = prefByCode(area.prefCode);
    const action = decideAction(event.hazard, area);
    const subs = await subscribersIn(area.prefCode, { drill: event.drill });
    const langs = [...new Set(subs.map((x) => x.lang))];
    if (event.drill && !langs.length) langs.push('en', 'ja'); // so the stage demo always has something to show

    // One Argon call per language, in parallel.
    const guidance = Object.fromEntries(await Promise.all(langs.map(async (lang) => {
      const g = await argonGuidance({ event, area, pref, action, lang });
      await s.set(`guide:${event.id}:${area.prefCode}:${lang}`, JSON.stringify(g), { ex: 3 * DAY });
      return [lang, g];
    })));

    const link = (lang) => `${publicUrl}/go?e=${encodeURIComponent(event.id)}&p=${area.prefCode}&l=${lang}`;
    const build = (lang) => {
      const g = guidance[lang];
      return {
        title: `${event.drill ? ui('drill', lang) : ''}${g.title}`,
        text: `${event.drill ? ui('drill', lang) : ''}${g.sms}`,
        // Every stage-2 message links to /go: full steps, emergency numbers and, when the
        // action involves moving, the walking route to the nearest designated site.
        url: link(lang),
      };
    };
    for (const lang of langs) {
      report.previews.push({ stage: 2, pref: pref.en, lang, action, intensity: area.scale ? scaleLabel(area.scale) : undefined, by: guidance[lang].by, ms: guidance[lang].ms, guidance: guidance[lang], link: link(lang) });
    }
    await deliver(subs, build, { event, area, stage: 2, baseUrl, report });
  }
  return { areas };
}

async function deliver(subs, build, { event, area, stage, baseUrl, report }) {
  const cache = new Map();
  const results = await Promise.allSettled(subs.map(async (sub) => {
    if (!cache.has(sub.lang)) cache.set(sub.lang, build(sub.lang));
    const msg = {
      ...cache.get(sub.lang),
      unsubUrl: `${baseUrl}/api/unsubscribe?id=${sub.id}&t=${unsubToken(sub.id)}`,
      unsubLabel: ui('stop', sub.lang),
    };
    const r = await send(sub.ch, contactOf(sub), msg);
    if (r.status === 'gone') await deleteSubscriber(sub.id);
    return { ch: sub.ch, lang: sub.lang, pref: area.prefCode, stage, status: r.status, error: r.error };
  }));
  for (const r of results) report.deliveries.push(r.status === 'fulfilled' ? r.value : { status: 'error', error: String(r.reason) });
  if (stage === 1) {
    const langs = [...new Set(subs.map((x) => x.lang))];
    if (!langs.length && event.drill) langs.push('en', 'ja');
    for (const lang of langs) report.previews.push({ stage: 1, pref: prefByCode(area.prefCode)?.en, lang, text: build(lang).text });
  }
}
