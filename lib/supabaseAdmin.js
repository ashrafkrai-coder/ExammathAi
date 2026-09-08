const { createClient } = require('@supabase/supabase-js');

let cachedClient = null;

/**
 * Klien Supabase sisi-server sahaja, menggunakan SUPABASE_SECRET_KEY
 * (kunci "secret" baharu Supabase - pengganti service_role key lama;
 * createClient menerimanya sama seperti JWT service_role key).
 * JANGAN sekali-kali import fail ini daripada kod yang dihantar ke pelayar.
 */
function getSupabaseAdmin() {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    const err = new Error('SUPABASE_URL atau SUPABASE_SECRET_KEY belum ditetapkan.');
    err.code = 'SUPABASE_NOT_CONFIGURED';
    throw err;
  }

  cachedClient = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

module.exports = { getSupabaseAdmin };
