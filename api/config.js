/**
 * GET /api/config
 * Mengembalikan konfigurasi PUBLIK sahaja yang selamat didedahkan kepada
 * pelayar - URL projek Supabase dan kunci "publishable" (setara kunci
 * "anon" lama; direka untuk didedahkan di sisi klien, seperti kunci
 * publishable Stripe). TIDAK PERNAH mengembalikan SUPABASE_SECRET_KEY.
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Kaedah tidak dibenarkan.' });
    return;
  }

  res.status(200).json({
    ok: true,
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || '',
  });
};
