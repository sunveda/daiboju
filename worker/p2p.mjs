// P2P地震情報 feed: real-time WebSocket, with JSON-history polling while the socket is down.
// Calls onMessage(msg) once per message id for codes 551 (earthquake), 552 (tsunami), 556 (EEW).
// Node 22+, no dependencies. Used by server.mjs (Cloud Run) and listener.mjs (standalone).
const WS_URL = process.env.P2P_WS_URL || 'wss://api.p2pquake.net/v2/ws';
const HISTORY_URL = process.env.P2P_HISTORY_URL || 'https://api.p2pquake.net/v2/history?codes=551&codes=552&codes=556&limit=20';
const CODES = new Set([551, 552, 556]);

export function startP2P(onMessage) {
  const state = { connected: false, lastMessageAt: 0, seen: new Set() };

  function handle(msg) {
    if (!msg || !CODES.has(msg.code) || !msg.id || state.seen.has(msg.id)) return;
    state.seen.add(msg.id);
    if (state.seen.size > 5000) state.seen.delete(state.seen.values().next().value);
    Promise.resolve(onMessage(msg)).catch((err) => console.error(`[p2p] handler failed for ${msg.id}: ${err.message}`));
  }

  function connect(delay = 1000) {
    const ws = new WebSocket(WS_URL);
    ws.addEventListener('open', () => {
      state.connected = true;
      delay = 1000;
      console.log(`[p2p] connected ${WS_URL}`);
    });
    ws.addEventListener('message', (e) => {
      state.lastMessageAt = Date.now();
      try {
        handle(JSON.parse(e.data));
      } catch {
        /* ignore non-JSON frames */
      }
    });
    ws.addEventListener('close', () => {
      state.connected = false;
      const next = Math.min(delay * 2, 30000);
      console.warn(`[p2p] closed, reconnecting in ${next} ms`);
      setTimeout(() => connect(next), next);
    });
    ws.addEventListener('error', () => console.warn('[p2p] socket error'));
  }

  // Prime `seen` with recent history so old messages are not re-sent at startup.
  async function poll(prime = false) {
    try {
      const list = await (await fetch(HISTORY_URL, { signal: AbortSignal.timeout(8000) })).json();
      for (const msg of list.reverse()) prime ? state.seen.add(msg.id) : handle(msg);
    } catch (err) {
      console.warn(`[p2p] poll failed: ${err.message}`);
    }
  }

  poll(true).then(() => {
    connect();
    setInterval(() => !state.connected && poll(), 10000);
  });
  return state;
}
