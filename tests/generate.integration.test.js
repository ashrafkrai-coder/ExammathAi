const test = require('node:test');
const { before, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_URL = 'https://fake-project.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'sb_secret_fake-key-for-tests';
process.env.GEMINI_API_KEY = 'fake-gemini-key';

const { statefulFakeFetch, setFakeFetchRules } = require('./helpers/fakeFetch');
const { createTestAuthContext, startJwksServer } = require('./helpers/testAuth');
global.fetch = statefulFakeFetch;

const generateHandler = require('../api/generate');
const topicsHandler = require('../api/topics');

let validAuthHeader;
let expiredAuthHeader;
let jwksServer;

before(async () => {
  const ctx = await createTestAuthContext();
  jwksServer = await startJwksServer(ctx.jwks);
  process.env.SUPABASE_JWKS_URL = jwksServer.url;
  validAuthHeader = `Bearer ${await ctx.signToken()}`;
  expiredAuthHeader = `Bearer ${await ctx.signToken({ expiresAt: Math.floor(Date.now() / 1000) - 10 })}`;
});

after(async () => {
  if (jwksServer) await jwksServer.close();
});

// JWKS kini disajikan melalui pelayan HTTP tempatan sebenar (lihat before()),
// bukan lagi melalui fetch palsu - fungsi ini kekal sebagai titik panggilan
// tunggal sekiranya rules tambahan diperlukan kelak.
function withAuthRule(rules) {
  return rules;
}

function authedReq(partial) {
  return { headers: { authorization: validAuthHeader }, ...partial };
}

function makeRes() {
  const res = { statusCode: 200, body: undefined };
  res.setHeader = () => {};
  res.status = function (code) { res.statusCode = code; return res; };
  res.json = function (obj) { res.body = obj; return res; };
  res.end = function (body) { res.body = body; return res; };
  return res;
}

function sourcesRule(rows) {
  return {
    match: (url) => url.includes('/rest/v1/math_reference_sources'),
    respond: () => ({ status: 200, body: rows }),
  };
}

function chunksRule(rows) {
  return {
    match: (url) => url.includes('/rest/v1/math_reference_chunks'),
    respond: () => ({ status: 200, body: rows }),
  };
}

function makeQuestions(count, startNo, bilanganPilihan = 4) {
  const keys = ['A', 'B', 'C', 'D', 'E', 'F'].slice(0, bilanganPilihan);
  const soalan = [];
  for (let i = 0; i < count; i++) {
    const pilihan = {};
    keys.forEach((k, idx) => { pilihan[k] = `Pilihan ${k} bagi soalan ${startNo + i}`; });
    soalan.push({
      no: startNo + i,
      soalan: `Selesaikan persamaan kuadratik #${startNo + i}: \\(x^2 - 5x + 6 = 0\\)`,
      pilihan,
      jawapan: keys[0],
      tahap: 'sederhana',
      penerangan: 'Faktorkan kepada (x-2)(x-3)=0, maka x=2 atau x=3.',
    });
  }
  return { tajuk: 'Ungkapan Kuadratik', soalan };
}

function geminiRule(responseBuilder) {
  return {
    match: (url) => url.includes('generativelanguage.googleapis.com'),
    respond: (url, opts) => {
      const payload = JSON.parse(opts.body);
      const userMsg = payload.contents[0].parts[0].text;
      const content = JSON.stringify(responseBuilder(userMsg));
      return { status: 200, body: { candidates: [{ content: { parts: [{ text: content }] } }] } };
    },
  };
}

const SAMPLE_SOURCE = [{
  id: 'src-1',
  title: 'Buku Teks - Bab Ungkapan Kuadratik',
  reference_type: 'buku_teks',
  subtajuk: 'Faktorisasi',
  original_text: 'Ungkapan kuadratik ialah ungkapan dalam bentuk ax^2+bx+c, dengan a tidak sama dengan 0.',
}];

const SAMPLE_CHUNKS = [{
  id: 'chunk-1',
  source_id: 'src-1',
  chunk_no: 1,
  title: 'Kaedah Faktorisasi',
  content: 'Untuk memfaktorkan ax^2+bx+c, cari dua nombor yang hasil darab = a*c dan hasil tambah = b.',
  keywords: ['faktorisasi'],
}];

test('Tingkatan 4 dengan 10 soalan (Gemini, 1 kelompok) - berjaya', async () => {
  setFakeFetchRules(withAuthRule([
    sourcesRule(SAMPLE_SOURCE),
    chunksRule(SAMPLE_CHUNKS),
    geminiRule(() => makeQuestions(10, 1)),
  ]));

  const req = authedReq({
    method: 'POST',
    body: {
      provider: 'gemini', tingkatan: 4, tajuk: 'Ungkapan Kuadratik', tahap: 'sederhana',
      bilangan_pilihan: 4, mula: 1, banyak: 10,
    },
  });
  const res = makeRes();
  await generateHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.soalan.length, 10);
  assert.equal(res.body.soalan[0].no, 1);
});

test('Tingkatan 5 dengan 40 soalan (Gemini, 4 kelompok maks 10) - berjaya', async () => {
  setFakeFetchRules(withAuthRule([
    sourcesRule(SAMPLE_SOURCE),
    chunksRule(SAMPLE_CHUNKS),
    geminiRule((userMsg) => {
      const startMatch = userMsg.match(/bermula daripada (\d+)/);
      const countMatch = userMsg.match(/Jana TEPAT (\d+) soalan/);
      const mula = Number(startMatch[1]);
      const banyak = Number(countMatch[1]);
      return makeQuestions(banyak, mula);
    }),
  ]));

  const batches = [[1, 10], [11, 10], [21, 10], [31, 10]];
  const collected = [];
  for (const [mula, banyak] of batches) {
    const req = authedReq({
      method: 'POST',
      body: { provider: 'gemini', tingkatan: 5, tajuk: 'Ungkapan Kuadratik', tahap: 'campuran', bilangan_pilihan: 4, mula, banyak },
    });
    const res = makeRes();
    await generateHandler(req, res);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    collected.push(...res.body.soalan);
  }
  assert.equal(collected.length, 40);
});

test('Tiada bahan rujukan - ralat mesra 404', async () => {
  setFakeFetchRules(withAuthRule([
    sourcesRule([]),
    chunksRule([]),
  ]));

  const req = authedReq({
    method: 'POST',
    body: { provider: 'gemini', tingkatan: 4, tajuk: 'Tajuk Tiada Rujukan', tahap: 'mudah', bilangan_pilihan: 4, mula: 1, banyak: 5 },
  });
  const res = makeRes();
  await generateHandler(req, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.ok, false);
  assert.match(res.body.error, /Tiada bahan rujukan/);
});

test('API key belum ditetapkan - ralat mesra 400', async () => {
  const original = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  setFakeFetchRules(withAuthRule([
    sourcesRule(SAMPLE_SOURCE),
    chunksRule(SAMPLE_CHUNKS),
  ]));

  const req = authedReq({
    method: 'POST',
    body: { provider: 'gemini', tingkatan: 4, tajuk: 'Ungkapan Kuadratik', tahap: 'sederhana', bilangan_pilihan: 4, mula: 1, banyak: 5 },
  });
  const res = makeRes();
  await generateHandler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.ok, false);
  assert.match(res.body.error, /Kunci API/);

  process.env.GEMINI_API_KEY = original;
});

test('AI mengembalikan kurang daripada jumlah diminta - proses dihentikan dengan ralat', async () => {
  setFakeFetchRules(withAuthRule([
    sourcesRule(SAMPLE_SOURCE),
    chunksRule(SAMPLE_CHUNKS),
    geminiRule(() => makeQuestions(8, 1)), // diminta 10, AI pulangkan 8
  ]));

  const req = authedReq({
    method: 'POST',
    body: { provider: 'gemini', tingkatan: 4, tajuk: 'Ungkapan Kuadratik', tahap: 'sederhana', bilangan_pilihan: 4, mula: 1, banyak: 10 },
  });
  const res = makeRes();
  await generateHandler(req, res);

  assert.equal(res.statusCode, 422);
  assert.equal(res.body.ok, false);
  assert.match(res.body.error, /8 soalan sahaja/);
});

test('/api/generate - tiada header Authorization - ralat mesra 401', async () => {
  setFakeFetchRules(withAuthRule([sourcesRule(SAMPLE_SOURCE), chunksRule(SAMPLE_CHUNKS)]));

  const req = { method: 'POST', body: { provider: 'gemini', tingkatan: 4, tajuk: 'Ungkapan Kuadratik', tahap: 'mudah', bilangan_pilihan: 4, mula: 1, banyak: 5 } };
  const res = makeRes();
  await generateHandler(req, res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.ok, false);
  assert.match(res.body.error, /log masuk/);
});

test('/api/generate - token tamat tempoh - ralat mesra 401', async () => {
  setFakeFetchRules(withAuthRule([sourcesRule(SAMPLE_SOURCE), chunksRule(SAMPLE_CHUNKS)]));

  const req = { method: 'POST', headers: { authorization: expiredAuthHeader }, body: { provider: 'gemini', tingkatan: 4, tajuk: 'Ungkapan Kuadratik', tahap: 'mudah', bilangan_pilihan: 4, mula: 1, banyak: 5 } };
  const res = makeRes();
  await generateHandler(req, res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.ok, false);
});

test('/api/topics - mengembalikan tajuk aktif unik', async () => {
  setFakeFetchRules(withAuthRule([
    sourcesRule([{ tajuk: 'Ungkapan Kuadratik' }, { tajuk: 'Ungkapan Kuadratik' }, { tajuk: 'Statistik' }]),
  ]));

  const req = authedReq({ method: 'GET', query: { tingkatan: '4' } });
  const res = makeRes();
  await topicsHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual([...res.body.tajuk].sort(), ['Statistik', 'Ungkapan Kuadratik']);
});

test('/api/topics - tingkatan tidak sah', async () => {
  setFakeFetchRules(withAuthRule([]));
  const req = authedReq({ method: 'GET', query: { tingkatan: '3' } });
  const res = makeRes();
  await topicsHandler(req, res);
  assert.equal(res.statusCode, 400);
});

test('/api/topics - tiada log masuk - ralat mesra 401', async () => {
  setFakeFetchRules(withAuthRule([]));
  const req = { method: 'GET', query: { tingkatan: '4' } };
  const res = makeRes();
  await topicsHandler(req, res);
  assert.equal(res.statusCode, 401);
});
