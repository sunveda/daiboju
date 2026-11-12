// Contact details are the only personal data Daiboju keeps. They are encrypted at rest
// with AES-256-GCM, and looked up only through keyed hashes, so a database dump alone reveals nothing.
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

function key() {
  const raw = process.env.DATA_KEY;
  if (!raw) {
    if (process.env.VERCEL_ENV === 'production') throw new Error('DATA_KEY is not set');
    return Buffer.alloc(32, 7); // dev/test only
  }
  const k = Buffer.from(raw, 'base64');
  if (k.length !== 32) throw new Error('DATA_KEY must be 32 bytes, base64-encoded');
  return k;
}

export function encrypt(text) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64url');
}

export function decrypt(blob) {
  const buf = Buffer.from(blob, 'base64url');
  const d = createDecipheriv('aes-256-gcm', key(), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
}

export function keyedHash(purpose, value, len = 32) {
  return createHmac('sha256', key()).update(`${purpose}:${value}`).digest('hex').slice(0, len);
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

export function randomId(bytes = 12) {
  return randomBytes(bytes).toString('base64url');
}

export function randomCode() {
  return String(100000 + (randomBytes(4).readUInt32BE() % 900000));
}
