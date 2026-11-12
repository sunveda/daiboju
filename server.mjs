// Daiboju production server for Google Cloud Run (also used by `npm run dev`).
// One process serves everything:
//   /api/<name>  → api/<name>.js (Web Request → Response handlers; same files Vercel would run)
//   /health      → liveness + listener state (/healthz is reserved by Cloud Run)
//   everything else → public/ (clean URLs: /go → go.html)
// With LISTENER=1 it also holds the P2P地震情報 WebSocket and ingests alerts in-process,
// so no separate worker is needed. Run it as ONE always-on instance (see DEPLOY.md).
// No dependencies beyond web-push (loaded only when sending push).
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC = join(root, 'public');
const API_ROUTES = new Set(['config', 'subscribe', 'unsubscribe', 'ingest', 'drill', 'guidance', 'line-webhook']);
// Endpoints the browser calls, possibly from the copy of the pages at sunveda.tech/app/daiboju/.
const CORS_ROUTES = new Set(['config', 'subscribe', 'unsubscribe', 'guidance', 'drill']);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const SECURITY = { 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Permissions-Policy': 'geolocation=(self), camera=(), microphone=()' };

const allowedOrigins = () => (process.env.ALLOWED_ORIGINS || 'https://sunveda.tech').split(',').map((s) => s.trim()).filter(Boolean);

function corsHeaders(origin) {
  if (!origin || !allowedOrigins().includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

let listener = null;

export function createServer() {
  const port = Number(process.env.PORT || 8080);
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    // Cloud Run terminates TLS; rebuild the public URL so handlers produce https links.
    const proto = req.headers['x-forwarded-proto'] || 'http';
    const publicUrl = new URL(url.pathname + url.search, `${proto}://${req.headers.host || `localhost:${port}`}`);
    try {
      if (url.pathname === '/health') {
        return send(res, 200, JSON.stringify({ ok: true, listener: listener ? { connected: listener.connected, lastMessageAt: listener.lastMessageAt } : 'off' }), 'application/json');
      }

      const api = url.pathname.match(/^\/api\/([a-z-]+)$/);
      if (api) {
        const name = api[1];
        if (!API_ROUTES.has(name)) return send(res, 404, 'Not found');
        const cors = CORS_ROUTES.has(name) ? corsHeaders(req.headers.origin) : {};
        const mod = await import(pathToFileURL(join(root, 'api', `${name}.js`)).href);
        const handler = mod[req.method];
        if (!handler) return send(res, 405, 'Method not allowed', 'text/plain', cors);
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const body = ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks);
        const response = await handler(new Request(publicUrl, { method: req.method, headers: req.headers, body }));
        res.writeHead(response.status, { ...SECURITY, ...Object.fromEntries(response.headers), ...cors });
        return res.end(Buffer.from(await response.arrayBuffer()));
      }

      let path = normalize(decodeURIComponent(url.pathname));
      if (path.endsWith('/')) path += 'index.html';
      let file = join(PUBLIC, path);
      if (!file.startsWith(PUBLIC + sep)) return send(res, 404, 'Not found');
      if (!extname(file) && existsSync(`${file}.html`)) file += '.html';
      if (!existsSync(file) || !(await stat(file)).isFile()) return send(res, 404, 'Not found');
      res.writeHead(200, {
        ...SECURITY,
        'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
        'Cache-Control': file.endsWith('sw.js') ? 'no-cache' : 'public, max-age=300',
      });
      res.end(await readFile(file));
    } catch (err) {
      console.error(err);
      send(res, 500, 'Internal error');
    }
  });
}

function send(res, status, text, type = 'text/plain; charset=utf-8', extra = {}) {
  res.writeHead(status, { ...SECURITY, 'Content-Type': type, ...extra });
  res.end(text);
}

export async function startListener() {
  const base = process.env.BASE_URL;
  if (!base) throw new Error('LISTENER=1 needs BASE_URL (this service’s public https URL, for unsubscribe links)');
  const [{ startP2P }, { ingest }] = await Promise.all([import('./worker/p2p.mjs'), import('./api/_lib/ingest.js')]);
  listener = startP2P(async (msg) => {
    const r = await ingest(msg, { baseUrl: base.replace(/\/$/, '') });
    if (r.events.length) console.log(`[ingest] code=${msg.code} id=${msg.id} events=${r.events.length} sent=${r.sent} simulated=${r.simulated} failed=${r.failed}`);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8080);
  createServer().listen(port, () => console.log(`Daiboju listening on :${port}`));
  if (process.env.LISTENER === '1') startListener().catch((err) => console.error(`[listener] not started: ${err.message}`));
}
