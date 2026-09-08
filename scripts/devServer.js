/**
 * Pelayan pratonton tempatan (BUKAN untuk deploy).
 * Menjalankan fail statik (root) + fungsi serverless sebenar di api/*.js
 * dengan meniru bentuk (req.query, req.body, res.status().json()) yang
 * disediakan oleh runtime Vercel - supaya kod api/*.js sama persis dengan
 * yang akan berjalan selepas deploy nanti.
 */
const http = require('http');
const path = require('path');
const fs = require('fs');
const { URL } = require('url');
const { wrapResponse } = require('../lib/httpShim');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

// Muatkan .env secara manual (tanpa pergantungan luaran) supaya
// SUPABASE_URL/API keys dsb. tersedia semasa pratonton tempatan.
loadDotEnv(path.join(ROOT, '.env'));

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function handleApi(req, res, pathname) {
  const fnName = pathname.replace(/^\/api\//, '').replace(/\.js$/, '');
  const filePath = path.join(ROOT, 'api', `${fnName}.js`);

  if (!fs.existsSync(filePath)) {
    wrapResponse(res).status(404).json({ ok: false, error: 'Fungsi API tidak dijumpai.' });
    return;
  }

  delete require.cache[require.resolve(filePath)];
  const handler = require(filePath);

  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const raw = await readBody(req);
    try {
      req.body = raw ? JSON.parse(raw) : {};
    } catch {
      wrapResponse(res).status(400).json({ ok: false, error: 'Badan permintaan bukan JSON yang sah.' });
      return;
    }
  } else {
    req.body = {};
  }

  wrapResponse(res);

  try {
    await handler(req, res);
  } catch (e) {
    console.error('[api error]', fnName, e);
    if (!res.headersSent && !res.writableEnded) {
      res.status(500).json({ ok: false, error: 'Ralat pelayan dalaman.' });
    }
  }
}

function serveStatic(req, res, pathname) {
  let relPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(ROOT, relPath);

  if (!filePath.startsWith(ROOT)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.end('404 Not Found: ' + relPath);
      return;
    }
    const ext = path.extname(filePath);
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;
  req.query = Object.fromEntries(url.searchParams.entries());

  if (pathname.startsWith('/api/')) {
    await handleApi(req, res, pathname);
    return;
  }

  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log('=======================================================');
  console.log(' Exam Matematik SPM - Pratonton Tempatan');
  console.log(` URL: http://localhost:${PORT}`);
  console.log(' (Ini BUKAN deployment - hanya untuk ujian di komputer ini)');
  console.log('=======================================================');
});
