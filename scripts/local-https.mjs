import './sites-env.mjs';
import https from 'node:https';
import http from 'node:http';
import { readFileSync } from 'node:fs';

// Explicit local/LAN address only. No tunnel, Cloudflare login or deployment.
const host = process.argv[2] || '127.0.0.1';
if (process.argv.length > 3 || !/^(127\.0\.0\.1|10\.(\d{1,3}\.){2}\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/.test(host) || host.split('.').some(s => Number(s) > 255)) throw Error('Supply this PC private LAN IPv4 address, or use 127.0.0.1.');
let options;
try { options = { key: readFileSync('.sites-runtime/tls/demo-key.pem'), cert: readFileSync('.sites-runtime/tls/demo-cert.pem') }; }
catch { throw Error('Local TLS certificate missing. See OFFLINE_QR_GUIDE.md. Never use production certificates.'); }
const origin = `https://${host}:8443`, upstream = 'http://127.0.0.1:8788';
const server = https.createServer(options, (req, res) => {
  if (!['GET', 'HEAD', 'POST'].includes(req.method) || !req.url.startsWith('/') || req.url.startsWith('//') || (req.headers.origin && req.headers.origin !== origin) || req.headers.host !== `${host}:8443`) { res.writeHead(403); res.end('Local demo origin rejected'); return; }
  const headers = { ...req.headers, host: '127.0.0.1:8788' };
  // Enforce the HTTPS Origin above, then translate for the fixed local upstream.
  if (headers.origin) headers.origin = upstream;
  const proxy = http.request(upstream + req.url, { method: req.method, headers, timeout: 15000 }, remote => {
    res.writeHead(remote.statusCode || 502, { ...remote.headers, 'Permissions-Policy': 'camera=(self)', 'X-Content-Type-Options': 'nosniff' });
    remote.pipe(res);
  });
  proxy.on('error', () => { if(!res.headersSent)res.writeHead(502); res.end('Start the local demo on port 8788 first.'); });
  proxy.on('timeout', () => proxy.destroy());
  req.on('aborted', () => proxy.destroy());
  req.pipe(proxy);
});
server.requestTimeout = 20000;
server.listen(8443, host, () => console.log(`Local HTTPS demo: ${origin} (certificate must be trusted on each device)`));
