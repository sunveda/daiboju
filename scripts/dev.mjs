// Local server that behaves like Vercel for this project: /api/<name> → api/<name>.js (GET/POST exports),
// everything else from public/ with clean URLs. No dependencies. Reads .env.local if present.
//   npm run dev  →  http://localhost:3000
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const envFile = join(root, '.env.local');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
process.env.CHANNELS_DRY_RUN ??= '1';
process.env.DRILL_SECRET ||= 'drill';
process.env.INGEST_SECRET ||= 'ingest';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const PORT = Number(process.env.PORT || 3000);

export function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    try {
      const api = url.pathname.match(/^\/api\/([a-z0-9-]+)$/);
      if (api) {
        const file = join(root, 'api', `${api[1]}.js`);
        if (!existsSync(file)) return send(res, 404, 'Not found');
        const mod = await import(pathToFileURL(file).href);
        const handler = mod[req.method];
        if (!handler) return send(res, 405, 'Method not allowed');
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const body = chunks.length ? Buffer.concat(chunks) : undefined;
        const request = new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body });
        const response = await handler(request);
        res.writeHead(response.status, Object.fromEntries(response.headers));
        return res.end(Buffer.from(await response.arrayBuffer()));
      }
      let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
      if (path.endsWith('/')) path += 'index.html';
      let file = join(root, 'public', path);
      if (!extname(file) && existsSync(`${file}.html`)) file += '.html';
      if (!existsSync(file) || !(await stat(file)).isFile()) return send(res, 404, 'Not found');
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
      res.end(await readFile(file));
    } catch (err) {
      console.error(err);
      send(res, 500, err.message);
    }
  });
}

function send(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain' });
  res.end(text);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createServer().listen(PORT, () => console.log(`Daiboju dev server → http://localhost:${PORT}  (drill secret: ${process.env.DRILL_SECRET})`));
}
