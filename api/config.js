// Public config for the browser: which channels are live, languages, prefectures.
import { json } from './_lib/http.js';
import { CHANNELS, configured } from './_lib/channels.js';
import { LANGUAGES, TEMPLATE_LANGS } from './_lib/templates.js';
import { PREFECTURES } from './_lib/areas.js';

export function GET() {
  return json({
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY || null,
    lineAddUrl: process.env.LINE_ADD_URL || null,
    channels: Object.fromEntries(CHANNELS.map((c) => [c, Boolean(configured(c))])),
    dryRun: process.env.CHANNELS_DRY_RUN === '1',
    languages: LANGUAGES,
    templateLanguages: TEMPLATE_LANGS,
    prefectures: PREFECTURES.map(({ code, ja, en }) => ({ code, ja, en })),
  }, 200, { 'Cache-Control': 'public, max-age=300' });
}

// CORS preflight for the pages hosted at sunveda.tech/app/daiboju (headers come from vercel.json).
export function OPTIONS() {
  return new Response(null, { status: 204 });
}
