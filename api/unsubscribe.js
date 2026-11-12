// GET or POST ?id=&t=  → deletes everything stored about this subscriber. One tap, no login.
import { html, json } from './_lib/http.js';
import { deleteSubscriber, unsubToken } from './_lib/subscribers.js';
import { safeEqual } from './_lib/crypto.js';

async function run(request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id') || '';
  const t = url.searchParams.get('t') || '';
  if (!id || !safeEqual(t, unsubToken(id))) return { ok: false };
  await deleteSubscriber(id);
  return { ok: true };
}

export async function GET(request) {
  const { ok } = await run(request);
  return html(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Daiboju</title><body style="font:18px/1.5 system-ui;max-width:32rem;margin:3rem auto;padding:0 1rem">
<h1>Daiboju</h1><p>${ok ? 'Your data has been deleted. You will not get more alerts.<br>データを削除しました。今後、通知は届きません。' : 'This link is not valid or was already used.<br>このリンクは無効か、すでに使用されています。'}</p>`, ok ? 200 : 400);
}

export async function POST(request) {
  const r = await run(request);
  return json(r, r.ok ? 200 : 400);
}
