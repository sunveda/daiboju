// Prints fresh secrets for .env.local / Vercel: DATA_KEY, INGEST_SECRET, DRILL_SECRET and a VAPID key pair.
import { createECDH, randomBytes } from 'node:crypto';

const ecdh = createECDH('prime256v1');
ecdh.generateKeys();
console.log(`DATA_KEY=${randomBytes(32).toString('base64')}`);
console.log(`INGEST_SECRET=${randomBytes(24).toString('base64url')}`);
console.log(`DRILL_SECRET=${randomBytes(9).toString('base64url')}`);
console.log(`VAPID_PUBLIC_KEY=${ecdh.getPublicKey().toString('base64url')}`);
console.log(`VAPID_PRIVATE_KEY=${ecdh.getPrivateKey().toString('base64url')}`);
