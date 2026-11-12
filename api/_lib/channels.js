// Delivery channels. Each one takes a decrypted contact and a message
// { title, text, url?, unsubUrl? } and returns { status: 'sent' | 'simulated' | 'gone' | 'error' }.
// 'gone' means the address no longer exists and the subscriber should be deleted.

export const CHANNELS = ['webpush', 'email', 'line', 'sms', 'whatsapp'];

const dryRun = () => process.env.CHANNELS_DRY_RUN === '1';

export function configured(ch) {
  const e = process.env;
  return {
    webpush: Boolean(e.VAPID_PUBLIC_KEY && e.VAPID_PRIVATE_KEY),
    email: Boolean(e.RESEND_API_KEY && e.EMAIL_FROM),
    line: Boolean(e.LINE_CHANNEL_ACCESS_TOKEN && e.LINE_CHANNEL_SECRET),
    sms: Boolean(e.TWILIO_ACCOUNT_SID && e.TWILIO_AUTH_TOKEN && e.TWILIO_SMS_FROM),
    whatsapp: Boolean(e.TWILIO_ACCOUNT_SID && e.TWILIO_AUTH_TOKEN && e.TWILIO_WHATSAPP_FROM),
  }[ch];
}

function plain(msg) {
  return [msg.text, msg.url, msg.unsubUrl ? `${msg.unsubLabel || 'Stop'}: ${msg.unsubUrl}` : ''].filter(Boolean).join('\n');
}

export async function send(ch, contact, msg) {
  if (dryRun() || !configured(ch)) {
    console.log(`[send:${ch}] (simulated) ${msg.title} | ${msg.text.slice(0, 80)}`);
    return { status: 'simulated' };
  }
  try {
    switch (ch) {
      case 'webpush': return await webpush(contact, msg);
      case 'email': return await email(contact, msg);
      case 'line': return await line(contact, msg);
      case 'sms': return await twilio(contact, plain(msg), process.env.TWILIO_SMS_FROM);
      case 'whatsapp': return await twilio(`whatsapp:${contact}`, plain(msg), `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`);
      default: return { status: 'error', error: `unknown channel ${ch}` };
    }
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

async function webpush(contact, msg) {
  const { default: wp } = await import('web-push');
  wp.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:alerts@example.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  try {
    await wp.sendNotification(JSON.parse(contact), JSON.stringify({ title: msg.title, body: msg.text, url: msg.url, tag: msg.tag }), { TTL: 3600, urgency: 'high' });
    return { status: 'sent' };
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) return { status: 'gone' };
    throw err;
  }
}

async function email(to, msg) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject: msg.title, text: plain(msg) }),
  });
  if (!res.ok) throw new Error(`resend ${res.status} ${await res.text()}`);
  return { status: 'sent' };
}

async function line(userId, msg) {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: userId, messages: [{ type: 'text', text: plain(msg).slice(0, 4900) }] }),
  });
  if (res.status === 400 || res.status === 403) {
    const body = await res.text();
    if (/not found|blocked|invalid.*to/i.test(body)) return { status: 'gone' };
    throw new Error(`line ${res.status} ${body}`);
  }
  if (!res.ok) throw new Error(`line ${res.status} ${await res.text()}`);
  return { status: 'sent' };
}

export async function lineReply(replyToken, text) {
  if (dryRun() || !configured('line')) return console.log(`[line-reply] (simulated) ${text}`);
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
  });
}

async function twilio(to, body, from) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: from, Body: body.slice(0, 1500) }),
  });
  if (!res.ok) throw new Error(`twilio ${res.status} ${await res.text()}`);
  return { status: 'sent' };
}

export function validContact(ch, value) {
  if (ch === 'email') return typeof value === 'string' && /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i.test(value);
  if (ch === 'sms' || ch === 'whatsapp') return typeof value === 'string' && /^\+[1-9]\d{7,14}$/.test(value);
  if (ch === 'webpush') return Boolean(value && typeof value.endpoint === 'string' && value.endpoint.startsWith('https://') && value.keys?.p256dh && value.keys?.auth);
  return false;
}
