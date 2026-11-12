// Drill scenarios for the stage demo and for testing. Earthquake and tsunami drills use the real
// P2P Earthquake Information message shapes, so they exercise exactly the same code path as a real event.
import { fromP2P } from './hazards.js';

const now = () => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Tokyo' }).replace(/-/g, '/');

function quakeMsgs(points, hypocenter, maxScale, domesticTsunami = 'None') {
  const t = now();
  const earthquake = { time: t, hypocenter, maxScale, domesticTsunami };
  return [
    { code: 551, id: 'drill', time: t, issue: { type: 'ScalePrompt', time: t }, earthquake, points },
    { code: 551, id: 'drill', time: t, issue: { type: 'DetailScale', time: t }, earthquake, points },
  ];
}

export const SCENARIOS = {
  'tokyo-quake': {
    label: 'Tokyo Bay earthquake, intensity 6-',
    build: () => quakeMsgs(
      [
        { pref: '東京都', addr: '東京千代田区', isArea: false, scale: 55 },
        { pref: '神奈川県', addr: '横浜中区', isArea: false, scale: 50 },
        { pref: '千葉県', addr: '千葉中央区', isArea: false, scale: 45 },
      ],
      { name: '東京湾', latitude: 35.5, longitude: 139.9, depth: 30, magnitude: 6.8 },
      55,
    ).flatMap((m) => fromP2P(m)),
  },
  'chiba-tsunami': {
    label: 'Boso offshore earthquake with tsunami warning',
    build: () => [
      ...quakeMsgs(
        [{ pref: '千葉県', addr: '銚子市', isArea: false, scale: 50 }],
        { name: '千葉県東方沖', latitude: 35.6, longitude: 141.0, depth: 10, magnitude: 7.4 },
        50,
        'Warning',
      ).flatMap((m) => fromP2P(m)),
      ...fromP2P({
        code: 552, id: 'drill', time: now(), cancelled: false, issue: { source: '気象庁', time: now(), type: 'Focus' },
        areas: [
          { grade: 'Warning', immediate: true, name: '千葉県九十九里・外房', firstHeight: { condition: '津波到達中と推測' }, maxHeight: { description: '３ｍ', value: 3 } },
          { grade: 'Watch', immediate: false, name: '東京湾内湾', firstHeight: { arrivalTime: now() }, maxHeight: { description: '１ｍ', value: 1 } },
        ],
      }),
    ],
  },
  'okinawa-typhoon': {
    label: 'Typhoon over Okinawa, evacuation level 4',
    build: () => {
      const base = { source: 'drill', hazard: 'typhoon', issuedAt: now(), facts: { kind: 'Typhoon', name: 'Typhoon No. 22 (drill)', warning: 'Storm warning (暴風警報), heavy rain warning', evacuationLevel: 4, peak: 'tonight' } };
      return [
        { ...base, id: 'ty-drill', stage: 1, areas: [{ prefCode: '47', level: 3 }] },
        { ...base, id: 'ty-drill', stage: 2, areas: [{ prefCode: '47', level: 4 }] },
      ];
    },
  },
  'kumamoto-rain': {
    label: 'Linear rainband over Kumamoto, level 4',
    build: () => {
      const base = { source: 'drill', hazard: 'rain', issuedAt: now(), facts: { kind: 'Heavy rain', warning: 'Heavy rain warning (大雨警報), landslide alert', evacuationLevel: 4, note: 'Linear rainband (線状降水帯) observed' } };
      return [
        { ...base, id: 'rn-drill', stage: 1, areas: [{ prefCode: '43', level: 3 }] },
        { ...base, id: 'rn-drill', stage: 2, areas: [{ prefCode: '43', level: 4 }] },
      ];
    },
  },
};

/** Replays the most recent real earthquake report from P2P Earthquake Information, as a drill. */
async function latestReal() {
  const res = await fetch('https://api.p2pquake.net/v2/history?codes=551&limit=20', { signal: AbortSignal.timeout(8000) });
  const list = await res.json();
  const msg = list.find((m) => fromP2P(m, { minScale: 10 }).length);
  if (!msg) return [];
  return [
    ...fromP2P({ ...msg, issue: { ...msg.issue, type: 'ScalePrompt' } }, { minScale: 10 }),
    ...fromP2P({ ...msg, issue: { ...msg.issue, type: 'DetailScale' } }, { minScale: 10 }),
  ].map((e) => ({ ...e, areas: e.areas.map((a) => ({ ...a, scale: Math.max(a.scale, 40) })) }));
}

export async function buildDrill(name) {
  const events = name === 'p2p-latest' ? await latestReal() : SCENARIOS[name]?.build();
  if (!events) return null;
  const stamp = Date.now().toString(36);
  return events.map((e) => ({ ...e, id: `${e.id}-drill-${stamp}`, drill: true }));
}
