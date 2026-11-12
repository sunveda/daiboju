# Daiboju: product and technical spec

> Handover document. Written so that a coding agent (Gemini 4 Argon in Google AI Studio / Antigravity, or any other) or a human can continue the build without the original conversation. Read `AGENTS.md` for the working rules, then this file.

**Status (v0.1):** working end to end in drill mode. Backend, three pages, listener worker and 10 tests are in place. What remains is listed in [§12 Work remaining](#12-work-remaining), in priority order.

---

## 1. What Daiboju is

When a disaster hits Japan (earthquake, tsunami, typhoon, heavy rain, landslide, volcano), Daiboju messages people **in the language they chose**, through the channel they chose, in two steps:

1. **First alert, within seconds.** A fixed, human-written, pre-translated "protect yourself now" message. No AI, no waiting.
2. **Next steps, once the official severity is known.** Fixed safety rules decide the action (stay, check building, go to high ground, evacuate…). Gemini 4 Argon writes that action as clear, tailored steps in the user's language. The message links to a page that finds the **nearest designated evacuation site on the user's own phone** and opens a **Google Maps walking route**.

The name: daijōbu (大丈夫, "it's okay"), the way a two-year-old says it.

### Who it is for
Foreign residents, tourists, students and workers in Japan who cannot read Japanese alerts, and anyone who doesn't know what to do in a disaster ("zero knowledge"). Existing apps (e.g. the Japan Tourism Agency's *Safety tips*) already push multilingual warnings; Daiboju's difference is **telling people what to do next**, with **no app to install** and **no account**.

### Principles (do not break these)
| Principle | What it means in code |
|---|---|
| **Minimal data** | A subscriber is `{channel, encrypted contact, language, prefecture, drill flag}`. No name, no account, no stored location. |
| **Location never leaves the phone** | `/go` computes the nearest site in the browser. The server never receives coordinates. |
| **AI never sees a person** | Argon is called once per *(event, prefecture, language)*, with official data only. |
| **Rules decide, AI explains** | `decideAction()` in `api/_lib/hazards.js` is the only place that decides what people should do. Argon is told the action and may not change it. |
| **Never block on AI** | First alert = templates. Second alert falls back to templates if Argon is missing, slow (25 s timeout) or returns invalid JSON. |
| **Easy delete** | Every message carries an unsubscribe link that opens a confirmation page (a GET never deletes, so link scanners cannot unsubscribe people); one button press deletes everything. LINE users can send `STOP` or block the account. |
| **Drills never reach real users** | Drills go only to subscribers who opted into drills, and every drill message is labelled. |

"Zero knowledge" in the pitch should be phrased as **"no account, no tracking, minimal data"**. A phone number or email is personal data, and "zero-knowledge" has a specific cryptographic meaning that a technical audience may challenge.

---

## 2. Architecture

```
 JMA (Japan Meteorological Agency)
   │  official earthquake / tsunami / EEW data
   ▼
 P2P地震情報 (api.p2pquake.net)  ──WebSocket──►  worker/listener.mjs   (Google Cloud Run, always on)
                                 ◄─poll /history while socket is down      │
                                                                           │ POST /api/ingest  (Bearer INGEST_SECRET)
 JMA XML weather feed (TODO §12.1) ──► adapter ──────────────────────────► │
                                                                           ▼
 ┌──────────────────────────── Vercel (this repo) ───────────────────────────────┐
 │ /api/ingest → fromP2P() → events → pipeline.handleEvents()                     │
 │      stage 1: templates.stage1Text()            ──► channels.send() ─┐         │
 │      stage 2: decideAction() → argon.argonGuidance() (per pref×lang) │         │
 │               → store guidance → link /go?e&p&l ──► channels.send() ─┤         │
 │                                                                      ▼         │
 │                     Web Push · Email (Resend) · LINE · SMS / WhatsApp (Twilio) │
 │ /api/subscribe  /api/unsubscribe  /api/line-webhook  /api/guidance             │
 │ /api/drill  /api/config                                                        │
 │ public/: index.html (sign up) · go.html (next steps + route) · demo.html       │
 └────────────────────────────────────────────────────────────────────────────────┘
        │ Upstash Redis (REST)                       ▲
        ▼                                            │ browser only:
   sub:*, area:*, lookup:*, evt:*, guide:*…    GSI evacuation-site tiles + Google Maps directions link
```

Why a separate listener: Vercel functions can't hold a WebSocket open, and Vercel Hobby cron runs only once a day. A tiny always-on process on **Cloud Run** (min-instances 1, CPU always allocated) holds the socket and forwards each message.

---

## 3. Repository layout

```
api/
  config.js         GET  public config (channels live, languages, prefectures, VAPID key)
  subscribe.js      POST create subscriber (or a LINE linking code)
  unsubscribe.js    GET confirmation page, POST delete subscriber (id + HMAC token)
  ingest.js         POST official messages from the listener / adapters
  drill.js          GET scenarios, POST run a drill (DRILL_SECRET)
  guidance.js       GET guidance for /go (no personal data, cacheable)
  line-webhook.js   POST LINE Messaging API webhook (signature-verified)
  _lib/             not exposed as functions (underscore prefix)
    store.js        Upstash REST client + in-memory fallback
    crypto.js       AES-256-GCM contact encryption, keyed hashes, tokens
    areas.js        47 prefectures, JMA name matching, tsunami region → prefecture map
    hazards.js      P2P → internal events, isAlertable(), decideAction(), shelter layers
    templates.js    languages, stage-1 texts, stage-2 fallbacks, UI strings
    argon.js        Gemini 4 Argon call, prompt, schema, validation, fallback
    channels.js     webpush / email / line / sms / whatsapp senders, contact validation
    subscribers.js  create / find / delete / list by prefecture
    pipeline.js     the two-stage flow, dedupe, fan-out, report
    drills.js       drill scenarios built from real P2P message shapes
public/
  index.html        sign-up
  go.html           next steps + nearest evacuation sites + Google Maps route
  demo.html         stage drill console
  sw.js, app.css, icon.svg, manifest.webmanifest
worker/
  listener.mjs      P2P WebSocket → /api/ingest, with polling fallback and /healthz
  Dockerfile        for Cloud Run
scripts/
  dev.mjs           local server that mimics Vercel (no dependencies)
  keys.mjs          generates DATA_KEY, secrets and a VAPID key pair
test/
  pipeline.test.js  node:test suite (no network)
```

Runtime: Node 22, ES modules, **one dependency** (`web-push`, loaded lazily only when sending push). Everything else uses built-in `fetch` and `node:crypto`. Keep it that way unless there is a strong reason.

---

## 4. Data model (Upstash Redis keys)

| Key | Value | TTL | Purpose |
|---|---|---|---|
| `sub:{id}` | JSON `{id, ch, c, lk, lang, pref, drill, t}` | none | Subscriber. `c` = AES-GCM encrypted contact. |
| `area:{prefCode}` | set of subscriber ids | none | Fan-out index. |
| `lookup:{ch}:{hmac}` | subscriber id | none | Find by contact without storing it in clear (re-subscribe replaces, LINE STOP). |
| `pending:{6-digit code}` | JSON `{lang, pref, drill}` | 15 min | LINE linking. |
| `evt:{eventId}` | internal event JSON | 3 days | For `/go`. |
| `guide:{eventId}:{pref}:{lang}` | guidance JSON | 3 days | What Argon (or the fallback) wrote. |
| `s1:{hazard}:{pref}` | event id | 10 min | One first alert per hazard per prefecture (EEW + intensity report = one quake). |
| `s1:drill:{eventId}:{pref}` | event id | 10 min | Same, for drills. |
| `s2:{eventId}:{pref}` | `1` | 1 day | One next-steps message per event per prefecture. |
| `seen:{p2pId}` | `1` | 1 day | P2P messages can repeat. |
| `rl:sub:{ip}` | counter | 1 h | 30 sign-ups per IP per hour. |

Contact formats: email address; `+E.164` for SMS/WhatsApp; LINE `userId` (opaque, LINE never gives the phone number); Web Push `PushSubscription` JSON.

---

## 5. Internal event shape

Every source (P2P now, JMA weather later) is converted to:

```js
{
  id: 'eq-20261112175800',          // stable per real-world event
  source: 'p2p:551',
  hazard: 'earthquake' | 'tsunami' | 'rain' | 'typhoon' | 'landslide' | 'volcano' | 'other',
  stage: 1 | 2,                     // 1 = act now, 2 = details known
  drill: false,
  issuedAt: '2026/11/12 18:00:00',
  areas: [{ prefCode: '13', scale: 55, intensity: '6-', tsunamiRisk?: 'Warning' }  // earthquake
          { prefCode: '12', grade: 'Warning', region, arrival, height }            // tsunami
          { prefCode: '47', level: 4 }],                                           // weather: 警戒レベル 1–5
  facts: { epicenter, magnitude, depthKm, maxIntensity, tsunami, comment, … }      // passed to Argon verbatim
}
```

### P2P地震情報 mapping (`fromP2P`)
| P2P code | Meaning | Daiboju |
|---|---|---|
| 556 | 緊急地震速報（警報） EEW | stage 1, areas from `areas[].pref`, scale = `scaleFrom` |
| 551 `ScalePrompt` | 震度速報 | stage 1 |
| 551 `ScaleAndDestination` / `DetailScale` | 震源・震度 / 各地の震度 | stage 2, per-prefecture max intensity |
| 551 `Destination`, `Foreign`, `Other` | | ignored |
| 552 | 津波予報 | stage 1 (Warning / MajorWarning only) **and** stage 2 |
| any `test: true` / `cancelled: true` | | ignored (TODO: send a "cancelled" notice, §12) |

Intensity scale: 10=1, 20=2, 30=3, 40=4, 45=5-, 50=5+, 55=6-, 60=6+, 70=7. Alerts start at `MIN_QUAKE_SCALE` (default 40 = intensity 4).

---

## 6. Safety rules (`decideAction`)

| Hazard | Condition | Action | Route link |
|---|---|---|---|
| tsunami | Warning / MajorWarning | `high_ground_now` | yes (tsunami sites) |
| tsunami | Watch (advisory) | `leave_coast` | yes (tsunami sites) |
| earthquake | tsunami Warning / Watch / Checking | `coast_high_ground` | yes (tsunami sites) |
| earthquake | intensity ≥ 6- | `check_building` | yes |
| earthquake | intensity 4 – 5+ | `stay_alert` | no |
| rain / landslide | level 5 | `safest_place_now` | no |
| rain / landslide | level 4 | `evacuate_now` | yes |
| rain / landslide | level 3 | `prepare` | yes |
| typhoon | level ≥ 4 / 5 | `evacuate_now` / `safest_place_now` | yes / no |
| typhoon | below 4 | `shelter_indoors` | no |
| volcano | level ≥ 4 | `evacuate_now` | yes |

Two deliberate choices:
- **Evacuating is not always right.** After an earthquake, an undamaged building is often safer than the street; at level 5 rain, going outside can kill. The rules say so.
- **Tsunami beats everything.** A coastal user must never receive "stay where you are". Tsunami first alerts are worded "if you are near the coast or a river", because warnings are issued per coastal region, not per address.

Changing this table is a **safety decision**: get it reviewed by someone with disaster-management expertise, and add a test.

---

## 7. Gemini 4 Argon contract (`api/_lib/argon.js`)

- Endpoint: `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-4-argon:generateContent`, header `x-goog-api-key`.
- `generationConfig`: `responseMimeType: application/json`, `responseSchema` (below), `maxOutputTokens: 32768` (Google recommends ≥ 32K for Argon because thinking uses the budget), `thinkingConfig.thinkingLevel: "low"` (speed matters; default is medium).
- Input (the only thing Argon sees):
  ```json
  { "LANGUAGE": "Tiếng Việt (vi)", "HAZARD": "tsunami", "ACTION": "high_ground_now",
    "AREA": { "prefecture": "Chiba", "prefectureJa": "千葉県" },
    "OFFICIAL_DATA": { "kind": "Tsunami forecast", "area": { "grade": "Warning", "region": "千葉県九十九里・外房", "height": "3m" } },
    "DRILL": false }
  ```
- Output schema: `{ title, summary, steps[2–8], avoid[], sms (≤ 400 chars, prompt asks ≤ 280) }`. Validated by `validGuidance()`; anything else → template fallback.
- System prompt rules: explain the ACTION, never change it; use only OFFICIAL_DATA; plain short sentences; never tell people to wait or watch the sea; no mention of AI.
- Parts with `thought: true` are skipped when reading the answer.
- Calls run in parallel per language. Pricing at launch: $2 / $10 per 1M input / output tokens (introductory, through 30 Nov 2026), so each call costs a fraction of a yen.

**Verify on the day** (not testable from the build environment): the REST spelling of the thinking level (`"low"` vs `"LOW"`), and that `responseSchema` is accepted alongside thinking on Argon. If either errors, the code falls back to templates and logs `[argon] fallback …`, so nothing breaks, but the demo should show Argon.

---

## 8. Channels

| Channel | Provider | Stored contact | Setup | Notes |
|---|---|---|---|---|
| Web Push | browser + `web-push` | PushSubscription | `npm run keys` → VAPID keys | Most private. iOS needs the site added to Home Screen. |
| LINE | Messaging API | LINE userId | official account; webhook `/api/line-webhook`; channel secret + access token; `LINE_ADD_URL` | Sign-up shows a 6-digit code to send to the bot. Free plan has a monthly push limit: check before launch. |
| Email | Resend | email | API key + verified sending domain | |
| SMS | Twilio | +E.164 | account SID, token, Japanese-capable sender | Most reliable when data networks are congested; costs per message. |
| WhatsApp | Twilio | +E.164 | WhatsApp sender | **Business-initiated messages need pre-approved templates.** Plain text works only within 24 h of the user's last message. Needs template work before launch (§12). |

`CHANNELS_DRY_RUN=1` (or a channel without credentials) logs instead of sending; the report status is `simulated`. A channel that reports the address is gone (push 404/410, LINE blocked) deletes the subscriber.

---

## 9. The `/go` page

`/go?e={eventId}&p={prefCode}&l={lang}` → `GET /api/guidance` → shows title, steps, things to avoid, official facts, 119 / 110 buttons and an AEDoko link. If the action involves moving:

1. Browser geolocation (auto if already permitted, otherwise one tap).
2. Fetch GSI 指定緊急避難場所 GeoJSON tiles at zoom 10 for the 3×3 tiles around the user: `https://cyberjapandata.gsi.go.jp/xyz/{layer}/10/{x}/{y}.geojson`. Layers: `skhb01` flood, `skhb02` landslide, `skhb03` storm surge, `skhb04` earthquake, `skhb05` tsunami, `skhb06` large fire, `skhb07` inland flooding, `skhb08` volcano.
3. Rank by straight-line distance, show the top 3 with a **Google Maps walking-directions link** (`https://www.google.com/maps/dir/?api=1&destination=lat,lng&travelmode=walking`; no API key needed).
4. Fallback: Google Maps search for 避難場所.

**Verify:** that GSI tiles allow cross-origin requests from the deployed domain, and the exact property names for the site name and address (the code tries `name`, `名称`, `施設・場所名` and `address`, `住所`, `所在地`). The build environment could not reach GSI.

---

## 10. Running it

```bash
npm install            # only web-push
npm test               # 10 tests, no network
npm run keys           # prints secrets + VAPID pair → .env.local and Vercel
npm run dev            # http://localhost:3000   (drill secret defaults to "drill")
```

Local check: open `/?drill=1`, sign up any email, open `/demo`, enter the drill secret, run a scenario. With `CHANNELS_DRY_RUN=1` nothing is sent; the console shows both messages per language.

### Deploy
1. **Vercel:** import `sunveda/daiboju`. No build step. Add env vars from `.env.example`. Add **Upstash Redis** from the Vercel Marketplace (it sets `KV_REST_API_URL` / `KV_REST_API_TOKEN`, which `store.js` reads).
2. **Gemini:** create a key in Google AI Studio, set `GEMINI_API_KEY` (Argon is not on the free tier; use the event's Cloud credits).
3. **Listener on Cloud Run:**
   ```bash
   cd worker
   gcloud run deploy daiboju-listener --source . --region asia-northeast1 \
     --min-instances 1 --max-instances 1 --no-cpu-throttling --no-allow-unauthenticated \
     --set-env-vars INGEST_URL=https://<app>.vercel.app/api/ingest,INGEST_SECRET=<same as Vercel>
   ```
4. **LINE:** create a Messaging API channel, set the webhook URL to `https://<app>.vercel.app/api/line-webhook`, enable webhooks, disable auto-reply.
5. Set `CHANNELS_DRY_RUN=0` only after a drill to your own phone works.

### Hosting the pages on sunveda.tech
The pages in `public/` are path-relative and read the API origin from `public/config.js`.
The same files are served at **https://sunveda.tech/app/daiboju/** (GitHub Pages, repo `sunveda/sunveda.tech`, folder `app/daiboju/`) with a `config.js` that points at the Vercel deployment.
- Vercel env: `BASE_URL` = the Vercel URL (unsubscribe links), `PUBLIC_URL=https://sunveda.tech/app/daiboju` (links in messages).
- `vercel.json` allows CORS from `https://sunveda.tech` for the browser-facing endpoints (`config`, `subscribe`, `unsubscribe`, `guidance`, `drill`). `ingest` and `line-webhook` stay server-to-server.
- **Sync:** after changing `public/`, copy every file except `config.js` into `sunveda.tech/app/daiboju/` and open a PR there (assigned to `sunveda`, footer version updated).

---

## 11. Demo script (Gemini 4 Argon Tokyo Meetup, 90 minutes, teams of 2)

| Time | Person A | Person B |
|---|---|---|
| 0–15 | Deploy to Vercel, add Upstash, set env | Get Gemini key, run `npm test`, check §7 "verify" items with one drill |
| 15–45 | §12.3 web push end to end on both phones | §12.1 JMA weather adapter OR polish Argon prompt across 5 languages |
| 45–70 | Cloud Run listener live | Translate sign-up page UI (§12.5) |
| 70–90 | Rehearse the 60-second demo | |

**On stage (60 s):** one phone signed up in Vietnamese for Tokyo (with drill ticked). Open `/demo`, tap *Boso offshore earthquake with tsunami warning*. Phone buzzes: first alert instantly. Seconds later: Argon's next steps in Vietnamese. Tap the link → nearest tsunami evacuation site → Google Maps walking route. Close on the privacy slide: *"We never know who you are or where you are."*

---

## 12. Work remaining

In priority order. Each item lists where to work and how to know it's done.

1. **JMA weather adapter (typhoon, heavy rain, landslide, volcano).** Today only drills produce non-earthquake events. Poll the JMA XML feed `https://www.data.jma.go.jp/developer/xml/feed/extra.xml` (Atom; 随時 feed) from the listener every 60 s, fetch new 気象警報・注意報 / 土砂災害警戒情報 / 記録的短時間大雨情報 / 噴火警報 entries, and convert to internal events (§5) with a 警戒レベル: 大雨特別警報 → 5, 土砂災害警戒情報 → 4, 大雨警報・洪水警報 → 3. Post `{events:[…]}` to `/api/ingest`. Done when a real warning produces stage 1 + 2 in the drill console. *Verify the feed URL and XML structure first.*
2. **Verify the external assumptions** in §7 and §9 (thinking level spelling, GSI CORS and property names, P2P production WebSocket URL `wss://api.p2pquake.net/v2/ws`).
3. **Web push on real phones**, including iOS (requires "Add to Home Screen"). Show a short how-to on iOS.
4. **Cancellation and updates.** When P2P sends `cancelled: true` (EEW or tsunami), send a short "cancelled / 解除" message to the same prefectures. When a tsunami warning is downgraded, send the new action.
5. **Translate the sign-up page** (`index.html`) into the 7 template languages; the `/go` page is already done.
6. **Native-speaker review** of every stage-1 text and the `/go` UI strings, then add Nepali, Indonesian, Thai, Tagalog, Burmese templates (common resident languages).
7. **Complete the tsunami region map** in `areas.js` against JMA's 66 forecast regions.
8. **Ward-level areas** (市区町村). P2P `points[].addr` gives municipality names; add an optional ward on sign-up and filter by it, so Tokyo users aren't alerted for Okutama.
9. **Scale the fan-out.** Sending is done inside one function call; fine for thousands. Beyond that, enqueue per-chunk jobs (Upstash QStash or Cloud Tasks) and keep stage 1 first.
10. **WhatsApp templates** (see §8) and SMS cost controls.
11. **Legal:** privacy policy page (APPI), terms, a clear "not an official warning service" statement, and contact.
12. **Observability:** log delivery counts and Argon latency per event; alert the team if the listener's `/healthz` shows `connected:false` for more than 2 minutes.

---

## 13. Sources

- P2P地震情報 API v2 (JSON + WebSocket): https://mill.gitbook.io/p2pq_ts/
- Gemini 4 Argon model page: https://ai.google.dev/gemini-api/docs/models/gemini-4-argon
- What's new in Gemini 4 Argon: https://ai.google.dev/gemini-api/docs/latest-model
- GSI 指定緊急避難場所データ: https://www.gsi.go.jp/bousaichiri/hinanbasho.html
- Google Maps URLs (directions): https://developers.google.com/maps/documentation/urls/get-started
- LINE Messaging API: https://developers.line.biz/en/docs/messaging-api/
- Safety tips (JTA) for comparison: https://apps.apple.com/us/app/safety-tips/id858357174
