/*
 * SmartSplit dev server — tiny static file server, zero dependencies.
 * Run:  node server.js        (then open http://localhost:5173)
 * Port: PORT=3000 node server.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 5173;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

// Only the app itself is public — not server.js, package.json, tests, etc.
function isPublic(pathname) {
  return pathname === '/index.html' || pathname.startsWith('/src/') || pathname.startsWith('/assets/');
}

function send(res, status, body, type) {
  res.writeHead(status, {
    'Content-Type': type || 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache'
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (e) {
    return send(res, 400, 'Bad request');
  }

  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
  if (!isPublic(pathname)) return send(res, 404, 'Not found');

  const filePath = path.join(ROOT, pathname);
  if (!filePath.startsWith(ROOT + path.sep)) return send(res, 403, 'Forbidden');

  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, 'Not found');
    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    send(res, 200, req.method === 'HEAD' ? '' : data, type);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Try:  PORT=${PORT + 1} node server.js`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log('\n  SmartSplit is running');
  console.log(`  -> http://localhost:${PORT}\n`);
  console.log('  Press Ctrl+C to stop.\n');
});
