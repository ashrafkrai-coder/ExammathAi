const { PROVIDER_CONFIG } = require('../lib/aiProviders');

/**
 * GET /api/status
 * Mengembalikan status konfigurasi (BOOLEAN sahaja, TIDAK PERNAH nilai
 * sebenar) supaya UI "Tetapan API" boleh menunjukkan penyedia mana yang
 * sudah tersedia di pelayan.
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Kaedah tidak dibenarkan.' });
    return;
  }

  res.status(200).json({
    ok: true,
    supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY),
    providers: {
      gemini: { ready: Boolean(process.env.GEMINI_API_KEY), model: PROVIDER_CONFIG.gemini.model, maxBatch: PROVIDER_CONFIG.gemini.maxBatch },
    },
  });
};
