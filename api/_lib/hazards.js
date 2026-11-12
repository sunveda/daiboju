// Turns official feeds into one internal event shape, and decides the safe action
// with fixed rules. Argon never decides WHAT to do; it only explains it in the user's language.
import { matchPref, tsunamiRegionPrefs } from './areas.js';

export const HAZARDS = ['earthquake', 'tsunami', 'rain', 'typhoon', 'landslide', 'volcano', 'other'];

const SCALE_LABEL = { 10: '1', 20: '2', 30: '3', 40: '4', 45: '5-', 46: '5-?', 50: '5+', 55: '6-', 60: '6+', 70: '7' };
export const scaleLabel = (s) => SCALE_LABEL[s] || '?';

const GRADE_RANK = { MajorWarning: 3, Warning: 2, Watch: 1, Unknown: 0 };

/**
 * Internal event:
 * { id, source, hazard, stage (1 = act now, 2 = details known), drill, issuedAt,
 *   areas: [{ prefCode, scale?, grade?, level?, region?, arrival?, height? }], facts: {...} }
 */
export function fromP2P(msg, { minScale = Number(process.env.MIN_QUAKE_SCALE || 40) } = {}) {
  if (!msg || typeof msg !== 'object') return [];
  switch (msg.code) {
    case 556: return eew(msg);
    case 551: return quake(msg, minScale);
    case 552: return tsunami(msg);
    default: return [];
  }
}

function eew(msg) {
  if (msg.test || msg.cancelled) return [];
  const byPref = new Map();
  for (const a of msg.areas || []) {
    const p = matchPref(a.pref);
    if (!p) continue;
    const s = Math.trunc(a.scaleFrom ?? -1);
    byPref.set(p.code, Math.max(byPref.get(p.code) ?? -1, s));
  }
  const h = msg.earthquake?.hypocenter || {};
  return [{
    id: `eew-${msg.issue?.eventId || msg.id}`,
    source: 'p2p:556',
    hazard: 'earthquake',
    stage: 1,
    issuedAt: msg.issue?.time || msg.time,
    areas: [...byPref].map(([prefCode, scale]) => ({ prefCode, scale })),
    facts: { kind: 'Earthquake Early Warning', epicenter: h.name, magnitude: positive(h.magnitude) },
  }];
}

function quake(msg, minScale) {
  const type = String(msg.issue?.type || '').split('(')[0];
  if (!['ScalePrompt', 'ScaleAndDestination', 'DetailScale'].includes(type)) return [];
  const byPref = new Map();
  for (const pt of msg.points || []) {
    const p = matchPref(pt.pref);
    if (!p || pt.scale < minScale) continue;
    byPref.set(p.code, Math.max(byPref.get(p.code) ?? 0, pt.scale));
  }
  if (!byPref.size) return [];
  const eq = msg.earthquake || {};
  const h = eq.hypocenter || {};
  const tsunami = String(eq.domesticTsunami || '').split('(')[0];
  const tsunamiRisk = ['Warning', 'Watch', 'Checking'].includes(tsunami);
  return [{
    id: `eq-${(eq.time || msg.id).replace(/\D/g, '')}`,
    source: 'p2p:551',
    hazard: 'earthquake',
    stage: type === 'ScalePrompt' ? 1 : 2,
    issuedAt: msg.issue?.time || msg.time,
    areas: [...byPref].map(([prefCode, scale]) => ({ prefCode, scale, intensity: scaleLabel(scale), ...(tsunamiRisk && { tsunamiRisk: tsunami }) })),
    facts: {
      kind: 'Earthquake',
      time: eq.time,
      epicenter: h.name || undefined,
      magnitude: positive(h.magnitude),
      depthKm: h.depth >= 0 ? h.depth : undefined,
      maxIntensity: scaleLabel(eq.maxScale),
      tsunami: tsunami || undefined,
      comment: msg.comments?.freeFormComment || undefined,
    },
  }];
}

function tsunami(msg) {
  if (msg.cancelled) return [];
  const byPref = new Map();
  for (const a of msg.areas || []) {
    const grade = String(a.grade || '').split(/[\s(]/)[0];
    for (const p of tsunamiRegionPrefs(a.name)) {
      if (!p) continue;
      const prev = byPref.get(p.code);
      if (prev && GRADE_RANK[prev.grade] >= GRADE_RANK[grade]) continue;
      byPref.set(p.code, {
        prefCode: p.code,
        grade,
        region: a.name,
        immediate: Boolean(a.immediate),
        arrival: a.firstHeight?.arrivalTime || a.firstHeight?.condition,
        height: a.maxHeight?.description,
      });
    }
  }
  if (!byPref.size) return [];
  const base = {
    source: 'p2p:552',
    hazard: 'tsunami',
    issuedAt: msg.issue?.time || msg.time,
    areas: [...byPref.values()],
    facts: { kind: 'Tsunami forecast' },
  };
  const id = `ts-${(msg.issue?.time || msg.id).replace(/\D/g, '')}`;
  // Tsunami: act first (fixed text, no AI), then details.
  return [{ ...base, id, stage: 1 }, { ...base, id, stage: 2 }];
}

const positive = (n) => (typeof n === 'number' && n > 0 ? n : undefined);

/** Should this area get an alert at all? */
export function isAlertable(hazard, area) {
  if (hazard === 'earthquake') return (area.scale ?? 0) >= Number(process.env.MIN_QUAKE_SCALE || 40);
  if (hazard === 'tsunami') return GRADE_RANK[area.grade] >= 1;
  if (hazard === 'tsunami:stage1') return GRADE_RANK[area.grade] >= 2; // advisories skip the "flee now" alert
  return (area.level ?? 3) >= 3;
}

/**
 * The single source of truth for what people are told to do.
 * Changing these rules is a safety decision: get them reviewed.
 */
export function decideAction(hazard, area = {}) {
  switch (hazard) {
    case 'tsunami':
      return GRADE_RANK[area.grade] >= 2 ? 'high_ground_now' : 'leave_coast';
    case 'earthquake':
      // A tsunami may follow: coast first, then the building. Never "stay put" near the sea.
      if (area.tsunamiRisk) return 'coast_high_ground';
      return (area.scale ?? 0) >= 55 ? 'check_building' : 'stay_alert';
    case 'rain':
    case 'landslide':
      if ((area.level ?? 0) >= 5) return 'safest_place_now';
      if ((area.level ?? 0) >= 4) return 'evacuate_now';
      return 'prepare';
    case 'typhoon':
      if ((area.level ?? 0) >= 5) return 'safest_place_now';
      if ((area.level ?? 0) >= 4) return 'evacuate_now';
      return 'shelter_indoors';
    case 'volcano':
      return (area.level ?? 0) >= 4 ? 'evacuate_now' : 'prepare';
    default:
      return 'follow_officials';
  }
}

/** Does the action involve going somewhere? Then the message links to the route page. */
export const ACTION_NEEDS_ROUTE = new Set(['high_ground_now', 'leave_coast', 'coast_high_ground', 'check_building', 'evacuate_now', 'prepare']);

/** Which shelter layer to search: tsunami-designated sites whenever the action is about the sea. */
export function shelterLayerFor(hazard, action) {
  if (['high_ground_now', 'leave_coast', 'coast_high_ground'].includes(action)) return SHELTER_LAYER.tsunami;
  return SHELTER_LAYER[hazard] || SHELTER_LAYER.other;
}

// GSI designated emergency evacuation sites (指定緊急避難場所), one tile layer per hazard type.
export const SHELTER_LAYER = {
  earthquake: 'skhb04',
  tsunami: 'skhb05',
  rain: 'skhb01',
  typhoon: 'skhb01',
  landslide: 'skhb02',
  volcano: 'skhb08',
  other: 'skhb04',
};
