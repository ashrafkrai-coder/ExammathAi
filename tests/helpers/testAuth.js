const http = require('http');
const { generateKeyPair, exportJWK, SignJWT } = require('jose');

/**
 * Sedia satu pasangan kunci ES256 untuk ujian, meniru sistem "JWT signing
 * keys" Supabase. `jose`'s createRemoteJWKSet menggunakan modul http/https
 * Node terus (bukan global fetch), jadi JWKS didedahkan melalui pelayan
 * HTTP tempatan sebenar (loopback) - bukan fetch palsu - supaya
 * lib/verifyAuth.js boleh diuji hujung-ke-hujung dengan setia.
 */
async function createTestAuthContext() {
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const jwk = await exportJWK(publicKey);
  jwk.kid = 'test-key-1';
  jwk.alg = 'ES256';
  jwk.use = 'sig';

  const jwks = { keys: [jwk] };

  async function signToken({ expiresIn, expiresAt, sub, ...rest } = {}) {
    let builder = new SignJWT({ role: 'authenticated', email: 'guru@sekolah.edu.my', ...rest })
      .setProtectedHeader({ alg: 'ES256', kid: jwk.kid })
      .setIssuedAt()
      .setSubject(sub || 'test-teacher-id');
    builder = builder.setExpirationTime(expiresAt !== undefined ? expiresAt : (expiresIn || '1h'));
    return builder.sign(privateKey);
  }

  return { jwks, signToken };
}

/**
 * Mulakan pelayan HTTP tempatan (127.0.0.1, port rawak) yang menyajikan
 * JSON JWKS pada mana-mana laluan. Mengembalikan { url, close }.
 */
function startJwksServer(jwks) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(jwks));
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}/auth/v1/.well-known/jwks.json`,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

module.exports = { createTestAuthContext, startJwksServer };
