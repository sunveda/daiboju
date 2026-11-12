// Gemini 4 Argon writes the second message: tailored next steps in the user's language.
// Privacy: Argon only ever sees official hazard data + an area + a language. Never a person.
// Safety: the action is decided by rules (hazards.js). Argon must explain it, not change it.
// Any failure (no key, timeout, bad JSON) falls back to the fixed template.
import { LANGUAGES, fallbackGuidance } from './templates.js';

const SYSTEM = `You write emergency guidance for people in Japan who may not speak Japanese and may know nothing about disasters.
Rules:
- The ACTION field is already decided by safety rules. Explain how to carry it out. Never contradict it or suggest a different action.
- Use ONLY the facts in OFFICIAL_DATA. Never invent places, numbers, times, heights or shelter names.
- Write in the requested language only, in short, plain sentences a frightened person can follow. No jargon.
- 3 to 6 steps, most important first. Each step is one sentence starting with a verb.
- "avoid" lists 1 to 3 dangerous things not to do.
- "sms" is at most 280 characters: the single most important instruction plus the key official fact.
- If a tsunami is involved, never tell people to wait, watch the sea or return to the coast.
- Do not mention AI, this app, or that you are a model.`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    summary: { type: 'STRING' },
    steps: { type: 'ARRAY', items: { type: 'STRING' } },
    avoid: { type: 'ARRAY', items: { type: 'STRING' } },
    sms: { type: 'STRING' },
  },
  required: ['title', 'summary', 'steps', 'avoid', 'sms'],
};

export function buildArgonInput({ event, area, pref, action, lang }) {
  return {
    LANGUAGE: `${LANGUAGES[lang] || lang} (${lang})`,
    HAZARD: event.hazard,
    ACTION: action,
    AREA: { prefecture: pref.en, prefectureJa: pref.ja },
    OFFICIAL_DATA: { ...event.facts, area },
    DRILL: Boolean(event.drill),
  };
}

export function validGuidance(g) {
  return (
    g && typeof g.title === 'string' && g.title.length > 0 && g.title.length < 140 &&
    typeof g.summary === 'string' &&
    Array.isArray(g.steps) && g.steps.length >= 2 && g.steps.length <= 8 && g.steps.every((s) => typeof s === 'string' && s.length < 400) &&
    Array.isArray(g.avoid) &&
    typeof g.sms === 'string' && g.sms.length > 0 && g.sms.length <= 400
  );
}

export async function argonGuidance(ctx) {
  const fallback = () => ({ ...fallbackGuidance(ctx.action, ctx.lang), action: ctx.action });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallback();

  const model = process.env.GEMINI_MODEL || 'gemini-4-argon';
  const started = Date.now();
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(Number(process.env.ARGON_TIMEOUT_MS || 25000)),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(buildArgonInput(ctx)) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: SCHEMA,
          maxOutputTokens: 32768,
          thinkingConfig: { thinkingLevel: process.env.GEMINI_THINKING_LEVEL || 'low' },
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
    const text = (data.candidates?.[0]?.content?.parts || [])
      .filter((p) => !p.thought && typeof p.text === 'string')
      .map((p) => p.text)
      .join('');
    const g = JSON.parse(text);
    if (!validGuidance(g)) throw new Error('invalid guidance shape');
    return { ...g, action: ctx.action, by: model, ms: Date.now() - started };
  } catch (err) {
    console.warn(`[argon] fallback for ${ctx.event.id}/${ctx.pref.code}/${ctx.lang}: ${err.message}`);
    return { ...fallback(), argonError: err.message };
  }
}
