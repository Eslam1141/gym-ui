// Dev server for testing this checkout's web app (the gym-ui repo root, one
// level up) inside the native app before it merges. Serves it under /app/
// and proxies everything else to production:
// /api/* to gym-be, config.js (real GOOGLE_CLIENT_ID, API base rewritten to
// this origin so there's no CORS), the rest to the app host.
//   node tools/dev-proxy.mjs          (from native/; optional: <web dir> <port>)
//   adb reverse tcp:8090 tcp:8090
//   ETQ_DEV_URL=http://localhost:8090/app/ npx cap sync android && build
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(process.argv[2] || fileURLToPath(new URL('../../', import.meta.url)));
const PORT = Number(process.argv[3]) || 8090;
const UPSTREAM = 'etqadem.cloider.app';
const API_UPSTREAM = 'gym-be.cloider.app'; // config.js's GYM_API_BASE host
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

function proxy(req, res, host = UPSTREAM) {
  const headers = { ...req.headers, host };
  delete headers.origin; delete headers.referer;
  const up = https.request({ host, path: req.url, method: req.method, headers }, (r) => {
    res.writeHead(r.statusCode, r.headers);
    r.pipe(res);
  });
  up.on('error', (e) => { res.writeHead(502); res.end(String(e)); });
  req.pipe(up);
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/app/') && url.pathname !== '/app/config.js') {
    let rel = decodeURIComponent(url.pathname.slice(5)) || 'index.html';
    const file = path.join(ROOT, rel);
    if (file.startsWith(ROOT) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(file).pipe(res);
      return;
    }
  }
  if (url.pathname.startsWith('/api/')) return proxy(req, res, API_UPSTREAM);
  if (url.pathname === '/app/config.js') {
    // Same-origin API through this proxy, so no CORS allow-list change is needed.
    https.get({ host: UPSTREAM, path: '/app/config.js' }, (r) => {
      let body = '';
      r.setEncoding('utf8');
      r.on('data', (c) => { body += c; });
      r.on('end', () => {
        body = body.replace(/window\.GYM_API_BASE\s*=\s*"https:\/\/[^/"]+/, 'window.GYM_API_BASE = "');
        res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' });
        res.end(body);
      });
    }).on('error', (e) => { res.writeHead(502); res.end(String(e)); });
    return;
  }
  proxy(req, res);
}).listen(PORT, () => console.log(`serving ${ROOT} at http://localhost:${PORT}/app/ (rest -> ${UPSTREAM})`));
