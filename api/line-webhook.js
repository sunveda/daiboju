// LINE Messaging API webhook. Set it in the LINE Developers console to https://<host>/api/line-webhook
// Flow: sign-up page shows a 6-digit code → user adds the official account and sends the code
//       → we link their opaque LINE userId to { lang, pref }. LINE never gives us their phone number.
// "STOP" / "停止" or blocking the account deletes their data.
import { createHmac } from 'node:crypto';
import { json } from './_lib/http.js';
import { safeEqual } from './_lib/crypto.js';
import { store } from './_lib/store.js';
import { deleteSubscriber, findSubscriber, upsertSubscriber } from './_lib/subscribers.js';
import { lineReply } from './_lib/channels.js';
import { ui } from './_lib/templates.js';

export function verifyLineSignature(rawBody, signature, secret = process.env.LINE_CHANNEL_SECRET) {
  if (!secret || !signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('base64');
  return safeEqual(expected, signature);
}

export async function POST(request) {
  const raw = await request.text();
  if (!verifyLineSignature(raw, request.headers.get('x-line-signature'))) return json({ error: 'Bad signature' }, 401);
  const { events = [] } = JSON.parse(raw || '{}');
  const s = store();

  for (const ev of events) {
    const userId = ev.source?.userId;
    if (!userId) continue;

    if (ev.type === 'unfollow') {
      const sub = await findSubscriber('line', userId);
      if (sub) await deleteSubscriber(sub.id);
      continue;
    }
    if (ev.type === 'follow') {
      await lineReply(ev.replyToken, 'Daiboju: send the 6-digit code from the sign-up page.\nサインアップ画面の6桁のコードを送ってください。');
      continue;
    }
    if (ev.type !== 'message' || ev.message?.type !== 'text') continue;
    const text = ev.message.text.trim();

    if (/^(stop|停止|ストップ)$/i.test(text)) {
      const sub = await findSubscriber('line', userId);
      if (sub) await deleteSubscriber(sub.id);
      await lineReply(ev.replyToken, `${ui('deleted', sub?.lang || 'en')}\n${ui('deleted', 'ja')}`);
      continue;
    }

    const code = text.replace(/\D/g, '');
    if (code.length === 6) {
      const pending = JSON.parse((await s.get(`pending:${code}`)) || 'null');
      if (!pending) {
        await lineReply(ev.replyToken, 'This code is not valid or has expired. Please sign up again.\nコードが無効か期限切れです。もう一度登録してください。');
        continue;
      }
      await s.del(`pending:${code}`);
      const sub = await upsertSubscriber({ ch: 'line', contact: userId, ...pending });
      await lineReply(ev.replyToken, ui('registered', sub.lang));
    }
  }
  return json({ ok: true });
}
