# Deploying Daiboju to Google Cloud Run

Daiboju runs as **one Cloud Run service** that serves the pages, the API and the live earthquake listener. It runs in Tokyo (`asia-northeast1`) and is paid for with the event's Google Cloud credits.

## 1. Account and project (event guide)

1. Claim the event credits with a personal Gmail account, and check them under **Billing → Credits**.
2. **IAM & Admin → Create a Project**, note the **Project ID**, and link the credit billing account.
3. Open **Cloud Shell** and run:
   ```bash
   gcloud config set project <YOUR_PROJECT_ID>
   ```
   If you get an auth error: `gcloud auth login` (and `gcloud auth application-default login`).

## 2. Get a Gemini API key

Google AI Studio → **Get API key** → create it in the same project. Gemini 4 Argon is not on the free tier, so the project needs billing (the credits).

## 3. Deploy

```bash
git clone https://github.com/sunveda/daiboju && cd daiboju
./scripts/deploy-cloudrun.sh
```

The script:
- enables Cloud Run, Cloud Build, Artifact Registry and Secret Manager;
- creates the secrets once (data key, drill secret, ingest secret) and asks for your Gemini key;
- builds the container from `Dockerfile` and deploys **one always-on instance** (`--min-instances 1 --max-instances 1 --no-cpu-throttling`), so the earthquake WebSocket stays connected;
- sets `BASE_URL`, `PUBLIC_URL` and `LISTENER=1`, and prints the service URL.

Messages are **simulated** by default (`CHANNELS_DRY_RUN=1`): the drill console shows exactly what each language would receive, without sending anything.

Sign-up is **closed** by default (`SIGNUP_OPEN=0`): `/api/subscribe` accepts only drill opt-ins, so contacts are not collected before the privacy policy covers them. Open it once with `SIGNUP_OPEN=1 ./scripts/deploy-cloudrun.sh`; later runs keep the deployed value (and `CHANNELS_DRY_RUN`) unless you set it again.

## 4. Check it

```bash
URL=$(gcloud run services describe daiboju --region asia-northeast1 --format='value(status.url)')
curl $URL/health          # {"ok":true,"listener":{"connected":true,...}}
gcloud secrets versions access latest --secret=daiboju-drill-secret   # for /demo
```

Then open `$URL/?drill=1` on your phone, sign up, open `$URL/demo` on the laptop and run a drill.

## 5. Connect real delivery (optional)

Add keys, then redeploy with `CHANNELS_DRY_RUN=0 ./scripts/deploy-cloudrun.sh`:

| Channel | What to add |
|---|---|
| Web push | `npm run keys` → `gcloud run services update daiboju --region asia-northeast1 --update-env-vars VAPID_PUBLIC_KEY=…,VAPID_SUBJECT=mailto:you@example.com` and a `VAPID_PRIVATE_KEY` secret |
| Email | `RESEND_API_KEY` secret, `EMAIL_FROM` env |
| LINE | `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN` secrets, `LINE_ADD_URL` env; webhook `$URL/api/line-webhook` |
| SMS / WhatsApp | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` secrets, `TWILIO_SMS_FROM` / `TWILIO_WHATSAPP_FROM` env |

Add a secret with `printf '%s' "<value>" | gcloud secrets create <name> --data-file=-` and attach it with `gcloud run services update daiboju --region asia-northeast1 --update-secrets ENV_NAME=<name>:latest`.

## 6. Use it from sunveda.tech

The same pages are hosted at `https://sunveda.tech/app/daiboju/`. Point them at this service in the site repo's `app/daiboju/config.js`:

```js
window.DAIBOJU_API = '<URL from step 4>';
```

and set `PUBLIC_URL=https://sunveda.tech/app/daiboju` on the service, so message links open the site. CORS already allows `https://sunveda.tech` (`ALLOWED_ORIGINS`).

## Storage

With no Upstash variables set, subscribers are kept **in memory** in the single instance. That is fine for the demo, and it means nothing persists: a redeploy forgets everyone. For real use, add Upstash Redis (`UPSTASH_REDIS_REST_URL` env + `UPSTASH_REDIS_REST_TOKEN` secret). A Firestore store is a natural next step on Google Cloud (implement the small interface in `api/_lib/store.js`).

## Vercel (alternative)

The same `api/` handlers also run on Vercel (`vercel.json`). There, the listener can't hold a WebSocket, so run `worker/` separately (it forwards to `/api/ingest`).
