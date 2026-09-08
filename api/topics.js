const { getSupabaseAdmin } = require('../lib/supabaseAdmin');
const { fetchActiveTopics } = require('../lib/referenceContext');
const { VALID_TINGKATAN } = require('../lib/validateInput');
const { verifyAccessToken } = require('../lib/verifyAuth');

/**
 * GET /api/topics?tingkatan=4
 * Mengembalikan senarai tajuk AKTIF bagi Tingkatan yang diminta.
 * Tidak pernah mendedahkan kandungan rujukan sebenar - hanya nama tajuk.
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Kaedah tidak dibenarkan.' });
    return;
  }

  try {
    await verifyAccessToken(req.headers && req.headers.authorization);
  } catch (e) {
    res.status(401).json({ ok: false, error: e.message });
    return;
  }

  const tingkatan = Number(req.query?.tingkatan);
  if (!VALID_TINGKATAN.includes(tingkatan)) {
    res.status(400).json({ ok: false, error: 'Tingkatan tidak sah.' });
    return;
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Pelayan belum ditetapkan dengan lengkap (Supabase).' });
    return;
  }

  try {
    const tajukList = await fetchActiveTopics(supabase, tingkatan);
    res.status(200).json({ ok: true, tajuk: tajukList });
  } catch (e) {
    res.status(502).json({ ok: false, error: 'Gagal membaca senarai tajuk daripada Supabase.' });
  }
};
