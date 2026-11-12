// Always-on listener. Vercel functions cannot hold a WebSocket open, so this tiny process does:
//   P2P Earthquake Information WebSocket (real time)  ─┐
//   P2P JSON history (polling fallback while offline) ─┴─► POST INGEST_URL (Vercel /api/ingest)
// Deploy on Google Cloud Run with min-instances=1 and CPU always allocated (see README).
// Node 22+, no dependencies.
import http from 'node:http';

const WS_URL = process.env.P2P_WS_URL || 'wss://api.p2pquake.net/v2/ws';
const HISTORY_URL = process.env.P2P_HISTORY_URL || 'https://api.p2pquake.net/v2/history?codes=551&codes=552&codes=556&limit=20';
const INGEST_URL = process.env.INGEST_URL; // https://<your-app>.vercel.app/api/ingest
const SECRET = process.env.INGEST_SECRET;
const CODES = new Set([551, 552, 556]);

if (!INGEST_URL || !SECRET) {
  console.error('Set INGEST_URL and INGEST_SECRET');
  process.exit(1);
}

const seen = new Set();
let connected = false;
let lastMessageAt = 0;

async function forward(msg) {
  if (!CODES.has(msg.code) || !msg.id || seen.has(msg.id)) return;
  seen.add(msg.id);
  if (seen.size > 5000) seen.delete(seen.values().next().value);
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(INGEST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SECRET}` },
        body: JSON.stringify(msg),
        signal: AbortSignal.timeout(55000),
      });
      console.log(`[ingest] code=${msg.code} id=${msg.id} → ${res.status} ${(await res.text()).slice(0, 200)}`);
      if (res.ok || res.status < 500) return;
    } catch (err) {
      console.warn(`[ingest] attempt ${attempt} failed: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, attempt * 1000));
  }
}

function connect(delay = 1000) {
  const ws = new WebSocket(WS_URL);
  ws.addEventListener('open', () => {
    connected = true;
    delay = 1000;
    console.log(`[ws] connected ${WS_URL}`);
  });
  ws.addEventListener('message', (e) => {
    lastMessageAt = Date.now();
    try {
      forward(JSON.parse(e.data));
    } catch {
      /* ignore non-JSON frames */
    }
  });
  ws.addEventListener('close', () => {
    connected = false;
    const next = Math.min(delay * 2, 30000);
    console.warn(`[ws] closed, reconnecting in ${next} ms`);
    setTimeout(() => connect(next), next);
  });
  ws.addEventListener('error', (e) => console.warn(`[ws] error ${e.message || ''}`));
}

// Prime `seen` with history so old messages are not re-sent at startup, then poll only while the socket is down.
async function poll(prime = false) {
  try {
    const list = await (await fetch(HISTORY_URL, { signal: AbortSignal.timeout(8000) })).json();
    for (const msg of list.reverse()) {
      if (prime) seen.add(msg.id);
      else await forward(msg);
    }
  } catch (err) {
    console.warn(`[poll] ${err.message}`);
  }
}

await poll(true);
connect();
setInterval(() => !connected && poll(), 10000);

// Cloud Run needs an HTTP port; /healthz also shows the socket state.
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, connected, lastMessageAt, seen: seen.size }));
}).listen(Number(process.env.PORT || 8080));
