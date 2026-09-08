const { createRemoteJWKSet, jwtVerify } = require('jose');

let cachedJwks = null;
let cachedJwksUrl = null;

function getJwks() {
  const url = process.env.SUPABASE_JWKS_URL
    || (process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/.well-known/jwks.json` : null);

  if (!url) {
    const err = new Error('SUPABASE_JWKS_URL / SUPABASE_URL belum ditetapkan.');
    err.code = 'SUPABASE_NOT_CONFIGURED';
    throw err;
  }

  if (cachedJwks && cachedJwksUrl === url) return cachedJwks;
  cachedJwks = createRemoteJWKSet(new URL(url));
  cachedJwksUrl = url;
  return cachedJwks;
}

/**
 * Sahkan header "Authorization: Bearer <access_token>" daripada sesi
 * Supabase Auth guru (disahkan terhadap JWKS Supabase - kunci awam sahaja,
 * tiada rahsia terlibat). Melempar Error mesra Bahasa Melayu jika tiada
 * token / token tidak sah / telah tamat tempoh.
 */
async function verifyAccessToken(authorizationHeader) {
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    const err = new Error('Sila log masuk terlebih dahulu untuk menggunakan ciri ini.');
    err.code = 'UNAUTHENTICATED';
    throw err;
  }

  const token = authorizationHeader.slice('Bearer '.length).trim();
  if (!token) {
    const err = new Error('Sila log masuk terlebih dahulu untuk menggunakan ciri ini.');
    err.code = 'UNAUTHENTICATED';
    throw err;
  }

  try {
    const { payload } = await jwtVerify(token, getJwks());
    return payload;
  } catch (e) {
    if (e.code === 'SUPABASE_NOT_CONFIGURED') throw e;
    const err = new Error('Sesi log masuk tidak sah atau telah tamat tempoh. Sila log masuk semula.');
    err.code = 'UNAUTHENTICATED';
    throw err;
  }
}

module.exports = { verifyAccessToken, getJwks };
