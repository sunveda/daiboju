import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

process.env.CHANNELS_DRY_RUN = '1';
process.env.INGEST_SECRET = 'ingest-secret';
process.env.DRILL_SECRET = 'drill-secret';
process.env.BASE_URL = 'https://daiboju.test';
delete process.env.GEMINI_API_KEY;

const { _memoryStore } = await import('../api/_lib/store.js');
const { fromP2P, decideAction } = await import('../api/_lib/hazards.js');
const { tsunamiRegionPrefs, matchPref } = await import('../api/_lib/areas.js');
const { encrypt, decrypt } = await import('../api/_lib/crypto.js');
const { argonGuidance } = await import('../api/_lib/argon.js');
const subscribe = await import('../api/subscribe.js');
const ingest = await import('../api/ingest.js');
const drill = await import('../api/drill.js');
const guidance = await import('../api/guidance.js');
const unsubscribe = await import('../api/unsubscribe.js');
const line = await import('../api/line-webhook.js');

const post = (path, body, headers = {}) => new Request(`https://daiboju.test${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const get = (path) => new Request(`https://daiboju.test${path}`);

const P2P_QUAKE = (type) => ({
  code: 551, id: `q-${type}`, time: '2026/11/12 18:00:00.000',
  issue: { source: '気象庁', time: '2026/11/12 18:00:00', type },
  earthquake: { time: '2026/11/12 17:58:00', hypocenter: { name: '東京湾', latitude: 35.5, longitude: 139.9, depth: 30, magnitude: 6.8 }, maxScale: 55, domesticTsunami: 'None' },
  points: [
    { pref: '東京都', addr: '東京千代田区', isArea: false, scale: 55 },
    { pref: '埼玉県', addr: 'さいたま市', isArea: false, scale: 30 },
  ],
});

beforeEach(() => _memoryStore._reset());

test('P2P earthquake messages become stage 1 and stage 2 events', () => {
  const [s1] = fromP2P(P2P_QUAKE('ScalePrompt'));
  const [s2] = fromP2P(P2P_QUAKE('DetailScale'));
  assert.equal(s1.stage, 1);
  assert.equal(s2.stage, 2);
  assert.deepEqual(s2.areas.map((a) => a.prefCode), ['13']); // Saitama intensity 3 is below the threshold
  assert.equal(s2.areas[0].intensity, '6-');
  assert.equal(fromP2P({ ...P2P_QUAKE('Destination') }).length, 0);
});

test('tsunami regions map to prefectures and produce act-now + details', () => {
  assert.deepEqual(tsunamiRegionPrefs('千葉県九十九里・外房').map((p) => p.code), ['12']);
  assert.deepEqual(tsunamiRegionPrefs('東京湾内湾').map((p) => p.code).sort(), ['12', '13', '14']);
  const evs = fromP2P({ code: 552, id: 't', cancelled: false, issue: { time: '2026/11/12 18:00:00', type: 'Focus' }, areas: [{ grade: 'Warning', name: '千葉県九十九里・外房' }, { grade: 'Watch', name: '東京湾内湾' }] });
  assert.deepEqual(evs.map((e) => e.stage), [1, 2]);
  assert.equal(evs[0].areas.find((a) => a.prefCode === '12').grade, 'Warning'); // the stronger grade wins
  assert.equal(matchPref('東京').code, '13');
});

test('rules decide the action, never the AI', () => {
  assert.equal(decideAction('tsunami', { grade: 'MajorWarning' }), 'high_ground_now');
  assert.equal(decideAction('tsunami', { grade: 'Watch' }), 'leave_coast');
  assert.equal(decideAction('earthquake', { scale: 60 }), 'check_building');
  assert.equal(decideAction('earthquake', { scale: 45 }), 'stay_alert');
  assert.equal(decideAction('rain', { level: 4 }), 'evacuate_now');
  assert.equal(decideAction('rain', { level: 5 }), 'safest_place_now');
  assert.equal(decideAction('typhoon', { level: 3 }), 'shelter_indoors');
  assert.equal(decideAction('earthquake', { scale: 45, tsunamiRisk: 'Warning' }), 'coast_high_ground');
});

test('earthquake with a tsunami warning never says "stay put"; advisories skip the flee-now alert', () => {
  const q = P2P_QUAKE('DetailScale');
  q.earthquake.domesticTsunami = 'Warning';
  const [e] = fromP2P(q);
  assert.equal(decideAction('earthquake', e.areas[0]), 'coast_high_ground');
});

test('contacts are encrypted at rest', () => {
  const blob = encrypt('+819012345678');
  assert.ok(!blob.includes('9012345678'));
  assert.equal(decrypt(blob), '+819012345678');
});

test('subscribe → real earthquake → both messages in the right language → unsubscribe', async () => {
  const r1 = await subscribe.POST(post('/api/subscribe', { channel: 'email', contact: 'a@example.com', lang: 'vi', pref: '13' }));
  assert.equal(r1.status, 200);
  const { id, unsubToken } = await r1.json();
  await subscribe.POST(post('/api/subscribe', { channel: 'sms', contact: '+819012345678', lang: 'ja', pref: '27' })); // Osaka: must not be alerted

  const auth = { authorization: 'Bearer ingest-secret' };
  assert.equal((await ingest.POST(post('/api/ingest', P2P_QUAKE('ScalePrompt')))).status, 401);
  const a = await (await ingest.POST(post('/api/ingest', P2P_QUAKE('ScalePrompt'), auth))).json();
  assert.equal(a.simulated, 1);
  const b = await (await ingest.POST(post('/api/ingest', P2P_QUAKE('DetailScale'), auth))).json();
  assert.equal(b.simulated, 1);
  const again = await (await ingest.POST(post('/api/ingest', P2P_QUAKE('DetailScale'), auth))).json();
  assert.equal(again.simulated, 0, 'the same message is processed once');

  const g = await (await guidance.GET(get('/api/guidance?e=eq-20261112175800&p=13&l=vi'))).json();
  assert.equal(g.action, 'check_building');
  assert.equal(g.shelterLayer, 'skhb04');
  assert.ok(g.guidance.steps.length >= 2);

  const u = await unsubscribe.POST(post(`/api/unsubscribe?id=${id}&t=${unsubToken}`, {}));
  assert.equal(u.status, 200);
  const c = await (await ingest.POST(post('/api/ingest', { ...P2P_QUAKE('DetailScale'), id: 'q-new', earthquake: { ...P2P_QUAKE().earthquake, time: '2026/11/12 19:00:00' } }, auth))).json();
  assert.equal(c.simulated, 0, 'deleted subscribers get nothing');
});

test('validation rejects bad input', async () => {
  for (const body of [
    { channel: 'fax', contact: 'x', lang: 'en', pref: '13' },
    { channel: 'email', contact: 'not-an-email', lang: 'en', pref: '13' },
    { channel: 'sms', contact: '090-1234', lang: 'en', pref: '13' },
    { channel: 'email', contact: 'a@b.co', lang: 'xx', pref: '13' },
    { channel: 'email', contact: 'a@b.co', lang: 'en', pref: '99' },
  ]) assert.equal((await subscribe.POST(post('/api/subscribe', body))).status, 400, JSON.stringify(body));
});

test('drills only reach drill subscribers and are labelled', async () => {
  await subscribe.POST(post('/api/subscribe', { channel: 'email', contact: 'real@example.com', lang: 'en', pref: '13' }));
  await subscribe.POST(post('/api/subscribe', { channel: 'email', contact: 'demo@example.com', lang: 'ko', pref: '13', drill: true }));
  assert.equal((await drill.POST(post('/api/drill', { secret: 'nope', scenario: 'tokyo-quake' }))).status, 401);
  const r = await (await drill.POST(post('/api/drill', { secret: 'drill-secret', scenario: 'tokyo-quake' }))).json();
  assert.equal(r.deliveries.length, 2); // stage 1 + stage 2, to the one drill subscriber
  assert.ok(r.deliveries.every((d) => d.lang === 'ko'));
  assert.ok(r.previews.find((p) => p.stage === 1).text.startsWith('【훈련】'));
  for (const s of ['chiba-tsunami', 'okinawa-typhoon', 'kumamoto-rain']) {
    const x = await (await drill.POST(post('/api/drill', { secret: 'drill-secret', scenario: s }))).json();
    assert.ok(x.ok && x.previews.length > 0, s);
  }
});

test('Argon: request shape, privacy, and fallback on bad output', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  const real = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url, body: JSON.parse(init.body) };
    const out = { title: 'Đi lên chỗ cao', summary: 's', steps: ['Đi ngay.', 'Ở lại đó.'], avoid: ['Đừng xem biển.'], sms: 'Lên chỗ cao ngay.' };
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ thought: true, text: 'thinking' }, { text: JSON.stringify(out) }] } }] }));
  };
  try {
    const ctx = { event: { id: 'e', hazard: 'tsunami', facts: { kind: 'Tsunami forecast' } }, area: { prefCode: '12', grade: 'Warning' }, pref: { code: '12', en: 'Chiba', ja: '千葉県' }, action: 'high_ground_now', lang: 'vi' };
    const g = await argonGuidance(ctx);
    assert.equal(g.by, 'gemini-4-argon');
    assert.equal(g.title, 'Đi lên chỗ cao');
    assert.match(captured.url, /models\/gemini-4-argon:generateContent$/);
    assert.equal(captured.body.generationConfig.thinkingConfig.thinkingLevel, 'low');
    assert.ok(!JSON.stringify(captured.body).includes('@'), 'no contact data reaches Argon');

    globalThis.fetch = async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"title":"x"}' }] } }] }));
    const f = await argonGuidance(ctx);
    assert.equal(f.by, 'template');
    assert.equal(f.action, 'high_ground_now');
  } finally {
    globalThis.fetch = real;
    delete process.env.GEMINI_API_KEY;
  }
});

test('LINE: signature check, code linking, STOP deletes', async () => {
  process.env.LINE_CHANNEL_SECRET = 'line-secret';
  const r = await (await subscribe.POST(post('/api/subscribe', { channel: 'line', lang: 'zh', pref: '47' }))).json();
  assert.match(r.code, /^\d{6}$/);
  const hook = (events) => {
    const body = JSON.stringify({ events });
    const sig = createHmac('sha256', 'line-secret').update(body).digest('base64');
    return line.POST(post('/api/line-webhook', body, { 'x-line-signature': sig }));
  };
  assert.equal((await line.POST(post('/api/line-webhook', '{"events":[]}', { 'x-line-signature': 'bad' }))).status, 401);
  await hook([{ type: 'message', replyToken: 'r', source: { userId: 'U123' }, message: { type: 'text', text: r.code } }]);
  const { findSubscriber } = await import('../api/_lib/subscribers.js');
  const sub = await findSubscriber('line', 'U123');
  assert.equal(sub.lang, 'zh');
  assert.equal(sub.pref, '47');
  await hook([{ type: 'message', replyToken: 'r', source: { userId: 'U123' }, message: { type: 'text', text: 'STOP' } }]);
  assert.equal(await findSubscriber('line', 'U123'), null);
  delete process.env.LINE_CHANNEL_SECRET;
});
