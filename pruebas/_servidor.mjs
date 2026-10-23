// Servidor estático mínimo para las pruebas (sirve la carpeta del sitio)
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
export function servir(root, override = {}) {
  const s = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'); const f = u.pathname === '/' ? '/index.html' : u.pathname;
    if (override[f]) { res.setHeader('Content-Type', 'text/javascript'); return res.end(override[f]); }
    const p = path.join(root, f);
    if (!p.startsWith(root) || !fs.existsSync(p)) { res.statusCode = 404; return res.end('no'); }
    res.setHeader('Content-Type', T[path.extname(p)] || 'text/plain'); res.end(fs.readFileSync(p));
  });
  return new Promise(r => s.listen(0, '127.0.0.1', () => r({ url: 'http://127.0.0.1:' + s.address().port, close: () => s.close() })));
}
