// Delete everything stored about a subscriber. One tap, no login.
//   GET  ?id=&t=  → confirmation page only. Never deletes, because email/SMS link scanners
//                  and previewers prefetch links and would otherwise unsubscribe people silently.
//   POST ?id=&t=  → deletes. The confirm button submits a form (HTML response);
//                  fetch() callers get JSON.
import { html, json } from './_lib/http.js';
import { deleteSubscriber, unsubToken } from './_lib/subscribers.js';
import { safeEqual } from './_lib/crypto.js';

function params(request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id') || '';
  const t = url.searchParams.get('t') || '';
  return { id, t, valid: Boolean(id) && safeEqual(t, unsubToken(id)) };
}

const page = (body, status = 200) => html(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Daiboju</title>
<body style="font:18px/1.5 system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem">
<h1>Daiboju</h1>${body}</body></html>`, status);

const INVALID = '<p>This link is not valid or was already used.<br>このリンクは無効か、すでに使用されています。</p>';

export function GET(request) {
  const { id, t, valid } = params(request);
  if (!valid) return page(INVALID, 400);
  return page(`<p>Stop alerts and delete your data?<br>通知を止めて、データを削除しますか？</p>
<form method="post" action="?id=${encodeURIComponent(id)}&amp;t=${encodeURIComponent(t)}">
<button type="submit" style="font:inherit;font-weight:700;padding:.8rem 1.2rem;border:0;border-radius:10px;background:#d9381e;color:#fff;cursor:pointer">Delete my data · 削除する</button>
</form>`);
}

export async function POST(request) {
  const { id, valid } = params(request);
  if (valid) await deleteSubscriber(id);
  const wantsHtml = (request.headers.get('content-type') || '').includes('application/x-www-form-urlencoded');
  if (wantsHtml) {
    return valid ? page('<p>Your data has been deleted. You will not get more alerts.<br>データを削除しました。今後、通知は届きません。</p>') : page(INVALID, 400);
  }
  return json({ ok: valid }, valid ? 200 : 400);
}

// CORS preflight for the pages hosted at sunveda.tech/app/daiboju (headers come from vercel.json).
export function OPTIONS() {
  return new Response(null, { status: 204 });
}
