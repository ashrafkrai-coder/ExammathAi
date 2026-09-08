const test = require('node:test');
const { before, after } = require('node:test');
const assert = require('node:assert/strict');

const { createTestAuthContext, startJwksServer } = require('./helpers/testAuth');
const { verifyAccessToken } = require('../lib/verifyAuth');

let ctx;
let jwksServer;

before(async () => {
  ctx = await createTestAuthContext();
  jwksServer = await startJwksServer(ctx.jwks);
  process.env.SUPABASE_JWKS_URL = jwksServer.url;
});

after(async () => {
  if (jwksServer) await jwksServer.close();
});

test('menerima token sah yang ditandatangani dengan kunci JWKS', async () => {
  const token = await ctx.signToken({ sub: 'teacher-1' });
  const payload = await verifyAccessToken(`Bearer ${token}`);
  assert.equal(payload.sub, 'teacher-1');
});

test('menolak jika tiada header Authorization', async () => {
  await assert.rejects(() => verifyAccessToken(undefined), /log masuk/);
});

test('menolak jika header bukan format "Bearer <token>"', async () => {
  await assert.rejects(() => verifyAccessToken('Token abc123'), /log masuk/);
});

test('menolak token yang telah tamat tempoh', async () => {
  const token = await ctx.signToken({ expiresAt: Math.floor(Date.now() / 1000) - 5 });
  await assert.rejects(() => verifyAccessToken(`Bearer ${token}`), /tamat tempoh/);
});

test('menolak token yang ditandatangani dengan kunci lain (tidak sepadan JWKS)', async () => {
  const otherCtx = await createTestAuthContext();
  const token = await otherCtx.signToken();
  await assert.rejects(() => verifyAccessToken(`Bearer ${token}`));
});
