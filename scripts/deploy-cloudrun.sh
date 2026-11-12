#!/usr/bin/env bash
# Deploy Daiboju to Google Cloud Run from Cloud Shell.
#   gcloud config set project <YOUR_PROJECT_ID>
#   ./scripts/deploy-cloudrun.sh
# Safe to re-run: existing secrets are kept, the service is updated in place.
set -euo pipefail

SERVICE="${SERVICE:-daiboju}"
REGION="${REGION:-asia-northeast1}"          # Tokyo
PROJECT="$(gcloud config get-value project 2>/dev/null)"
[ -n "$PROJECT" ] || { echo "Run: gcloud config set project <YOUR_PROJECT_ID>"; exit 1; }
echo "▶ Project $PROJECT · region $REGION · service $SERVICE"

echo "▶ Enabling Cloud Run, Cloud Build, Artifact Registry and Secret Manager (first run takes a minute)"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com --quiet

secret() { # secret <name> <value-if-missing>
  if gcloud secrets describe "$1" >/dev/null 2>&1; then echo "  · $1 exists"; else
    printf '%s' "$2" | gcloud secrets create "$1" --data-file=- --replication-policy=automatic --quiet >/dev/null; echo "  · $1 created"; fi
}
rand() { node -e "console.log(require('crypto').randomBytes($1).toString('$2'))"; }

echo "▶ Secrets"
secret daiboju-data-key "$(rand 32 base64)"        # encrypts stored contacts — never rotate without migrating
secret daiboju-drill-secret "$(rand 9 base64url)"
secret daiboju-ingest-secret "$(rand 24 base64url)"
if ! gcloud secrets describe gemini-api-key >/dev/null 2>&1; then
  read -rsp "  Gemini API key (Google AI Studio → Get API key): " GEMINI; echo
  secret gemini-api-key "$GEMINI"
fi

NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
gcloud projects add-iam-policy-binding "$PROJECT" --quiet >/dev/null \
  --member="serviceAccount:${NUMBER}-compute@developer.gserviceaccount.com" --role=roles/secretmanager.secretAccessor
echo "  · Cloud Run can read the secrets"
# New projects build source deploys with the default compute service account, which has no
# build permissions until it gets Cloud Run Builder (read sources, push the image, write logs).
gcloud projects add-iam-policy-binding "$PROJECT" --quiet >/dev/null \
  --member="serviceAccount:${NUMBER}-compute@developer.gserviceaccount.com" --role=roles/run.builder
echo "  · Cloud Build can build the container"

# --set-env-vars replaces every variable, so keep the deployed launch-gate and dry-run values
# unless this run sets them (first deploy: sign-up closed, messages simulated).
deployed() { # deployed <NAME> <default>
  gcloud run services describe "$SERVICE" --region "$REGION" --format=json 2>/dev/null | node -e '
    let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
      let v; try { v = (JSON.parse(s).spec.template.spec.containers[0].env || []).find((e) => e.name === process.argv[1])?.value; } catch {}
      process.stdout.write(v ?? process.argv[2]);
    });' "$1" "$2"
}
CHANNELS_DRY_RUN="${CHANNELS_DRY_RUN:-$(deployed CHANNELS_DRY_RUN 1)}"
SIGNUP_OPEN="${SIGNUP_OPEN:-$(deployed SIGNUP_OPEN 0)}"
echo "▶ Sign-up open: $SIGNUP_OPEN · simulated messages: $CHANNELS_DRY_RUN"

echo "▶ Building and deploying (3–5 minutes)"
# One always-on instance: it holds the earthquake WebSocket and the in-memory store.
gcloud run deploy "$SERVICE" --source . --region "$REGION" --quiet \
  --allow-unauthenticated --min-instances 1 --max-instances 1 --no-cpu-throttling \
  --memory 512Mi --timeout 60 \
  --set-env-vars "CHANNELS_DRY_RUN=${CHANNELS_DRY_RUN},SIGNUP_OPEN=${SIGNUP_OPEN},GEMINI_MODEL=gemini-4-argon,GEMINI_THINKING_LEVEL=low,ALLOWED_ORIGINS=https://sunveda.tech" \
  --set-secrets "DATA_KEY=daiboju-data-key:latest,DRILL_SECRET=daiboju-drill-secret:latest,INGEST_SECRET=daiboju-ingest-secret:latest,GEMINI_API_KEY=gemini-api-key:latest"

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
echo "▶ Turning on the live earthquake listener and setting links to $URL"
gcloud run services update "$SERVICE" --region "$REGION" --quiet \
  --update-env-vars "BASE_URL=$URL,PUBLIC_URL=${PUBLIC_URL:-$URL},LISTENER=1" >/dev/null

echo
echo "✅ Daiboju is live: $URL"
echo "   Health:        curl $URL/health"
echo "   Demo sign-up:  $URL/?drill=1"
echo "   Drill console: $URL/demo   (secret: gcloud secrets versions access latest --secret=daiboju-drill-secret)"
echo "   Messages are simulated (CHANNELS_DRY_RUN=1). See DEPLOY.md to connect push, email, LINE or SMS."
