// Standalone listener, for when the API runs somewhere that cannot hold a WebSocket (e.g. Vercel).
// On Cloud Run you don't need this: server.mjs runs the same listener in-process (LISTENER=1).
// Forwards each P2P message to INGEST_URL with the bearer INGEST_SECRET.
import http from 'node:http';
import { startP2P } from './p2p.mjs';

const INGEST_URL = process.env.INGEST_URL;
const SECRET = process.env.INGEST_SECRET;
if (!INGEST_URL || !SECRET) {
  console.error('Set INGEST_URL and INGEST_SECRET');
  process.exit(1);
}

async function forward(msg) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(INGEST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SECRET}` },
        body: JSON.stringify(msg),
        signal: AbortSignal.timeout(55000),
      });
      console.log(`[ingest] code=${msg.code} id=${msg.id} → ${res.status}`);
      if (res.ok || res.status < 500) return;
    } catch (err) {
      console.warn(`[ingest] attempt ${attempt} failed: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, attempt * 1000));
  }
}

const state = startP2P(forward);

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, connected: state.connected, lastMessageAt: state.lastMessageAt, seen: state.seen.size }));
}).listen(Number(process.env.PORT || 8080));
