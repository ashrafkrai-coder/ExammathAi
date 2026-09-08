const { getSupabaseAdmin } = require('../lib/supabaseAdmin');
const { fetchReferenceContext } = require('../lib/referenceContext');
const { buildSystemPrompt, buildUserPrompt } = require('../lib/promptBuilder');
const { generateWithProvider, getProviderConfig } = require('../lib/aiProviders');
const { parseAndValidateBatch } = require('../lib/questionValidator');
const { validateGenerateInput } = require('../lib/validateInput');
const { verifyAccessToken } = require('../lib/verifyAuth');

/**
 * POST /api/generate
 * Menjana SATU kelompok soalan (<= had kelompok penyedia AI).
 * Klien (frontend) bertanggungjawab memanggil endpoint ini berulang kali
 * untuk kelompok seterusnya sehingga jumlah soalan yang diminta tercapai,
 * dan memaparkan kemajuan semasa berbuat demikian.
 *
 * Body: { provider, tingkatan, tajuk, tahap, bilangan_pilihan, mula, banyak }
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Kaedah tidak dibenarkan.' });
    return;
  }

  try {
    await verifyAccessToken(req.headers && req.headers.authorization);
  } catch (e) {
    res.status(401).json({ ok: false, error: e.message });
    return;
  }

  let input;
  try {
    input = validateGenerateInput(req.body);
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
    return;
  }

  const cfg = getProviderConfig(input.provider);
  if (input.banyak > cfg.maxBatch) {
    res.status(400).json({
      ok: false,
      error: `Kelompok terlalu besar untuk ${cfg.label}. Maksimum ${cfg.maxBatch} soalan setiap kelompok.`,
    });
    return;
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: 'Pelayan belum ditetapkan dengan lengkap (Supabase). Sila hubungi pentadbir sistem.',
    });
    return;
  }

  let refContext;
  try {
    refContext = await fetchReferenceContext(supabase, {
      tingkatan: input.tingkatan,
      tajuk: input.tajuk,
    });
  } catch (e) {
    res.status(502).json({ ok: false, error: 'Gagal menghubungi pangkalan data rujukan. Sila cuba lagi.' });
    return;
  }

  if (!refContext.sources || refContext.sources.length === 0) {
    res.status(404).json({
      ok: false,
      error: `Tiada bahan rujukan dijumpai untuk Tingkatan ${input.tingkatan} - Tajuk "${input.tajuk}". Sila minta guru menambah rujukan dalam Supabase sebelum menjana soalan bagi tajuk ini.`,
    });
    return;
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt({
    tingkatan: input.tingkatan,
    tajuk: input.tajuk,
    tahap: input.tahap,
    bilanganPilihan: input.bilanganPilihan,
    mula: input.mula,
    banyak: input.banyak,
    contextText: refContext.contextText,
  });

  let rawText;
  try {
    rawText = await generateWithProvider(input.provider, { systemPrompt, userPrompt });
  } catch (e) {
    const status = e.code === 'MISSING_API_KEY' ? 400 : 502;
    res.status(status).json({ ok: false, error: e.message || 'Gagal menjana soalan daripada AI.' });
    return;
  }

  let batch;
  try {
    batch = parseAndValidateBatch(rawText, {
      banyak: input.banyak,
      mula: input.mula,
      bilanganPilihan: input.bilanganPilihan,
    });
  } catch (e) {
    res.status(422).json({
      ok: false,
      error: `AI mengembalikan hasil yang tidak lengkap atau tidak sah: ${e.message}`,
    });
    return;
  }

  res.status(200).json({
    ok: true,
    tajuk: batch.tajuk || input.tajuk,
    soalan: batch.soalan,
  });
};
