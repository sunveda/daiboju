# Daiboju 大丈夫

**When disaster hits Japan, know what to do. In your language.**

Daiboju sends two messages when an earthquake, tsunami, typhoon or flood hits:

1. **Within seconds:** a fixed, pre-translated "protect yourself now" alert.
2. **Once the official severity is known:** clear next steps written by **Gemini 4 Argon** in your language, with a link to the nearest designated evacuation site and a **Google Maps** walking route.

No app to install. No account. We keep only where to send the alert (encrypted), your language and your prefecture. Your exact location never leaves your phone (it downloads public map data for its area to find shelters), and the AI never sees anything about you.

The name is how a two-year-old says *daijōbu*, "it's okay".

## Deploy (Google Cloud Run)

```bash
gcloud config set project <YOUR_PROJECT_ID>
git clone https://github.com/sunveda/daiboju && cd daiboju
./scripts/deploy-cloudrun.sh
```

One always-on service in Tokyo serves the pages, the API and the live earthquake listener. See **[DEPLOY.md](DEPLOY.md)**.

## Quick start

```bash
npm install
npm test
npm run dev        # http://localhost:3000
```

- Sign up: http://localhost:3000/?drill=1
- Drill console: http://localhost:3000/demo (drill secret: `drill`)

## How it works

```
JMA data → P2P地震情報 → Daiboju on Cloud Run (listener + API in one service)
   → stage 1: template alert  → push · LINE · email · SMS · WhatsApp
   → stage 2: rules pick the action → Gemini 4 Argon writes it per language → link to /go
/go → nearest evacuation site computed on the phone → Google Maps walking route
```

Full spec, deployment steps and the remaining work: **[SPEC.md](SPEC.md)**. Rules for contributors and coding agents: **[AGENTS.md](AGENTS.md)**.

## Important

Daiboju is not an official warning service. Always follow instructions from your city, the police and the fire services. Alert texts need native-speaker and expert review before public launch.

Built by [SunVeda](https://sunveda.tech) for the Gemini 4 Argon Tokyo Meetup. Someone collapsed? Find an AED with [AEDoko](https://sunveda.tech/app/aedoko/).
