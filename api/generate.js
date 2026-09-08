const { getSupabaseAdmin } = require('../lib/supabaseAdmin');
const { fetchReferenceContext } = require('../lib/referenceContext');
const { buildSystemPrompt, buildUserPrompt } = require('../lib/promptBuilder');
const { generateWithProvider, getProviderConfig } = require('../lib/aiProviders');
const { parseAndValidateBatch } = require('../lib/questionValidator');
const { validateGenerateInput } = require('../lib/validateInput');
const { verifyAccessToken } = require('../lib/verifyAuth');
const { fetchFromBank, markUsed, saveToBank } = require('../lib/questionBank');

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

  let teacherId;
  try {
    const payload = await verifyAccessToken(req.headers && req.headers.authorization);
    teacherId = payload.sub;
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

  // --- Bank-dahulu: cuba guna semula soalan sedia ada sebelum panggil AI.
  // Bank ialah pengoptimuman (kelajuan + daya tahan bila AI sibuk/gagal),
  // bukan langkah kritikal - jika bacaan bank gagal, teruskan ke AI sahaja.
  let bankSoalan = [];
  let bankIds = [];
  try {
    const bankResult = await fetchFromBank(supabase, {
      tingkatan: input.tingkatan,
      tajuk: input.tajuk,
      tahap: input.tahap,
      bilanganPilihan: input.bilanganPilihan,
      teacherId,
      limit: input.banyak,
    });
    bankSoalan = bankResult.soalan;
    bankIds = bankResult.ids;
  } catch (e) {
    bankSoalan = [];
    bankIds = [];
  }

  const remaining = input.banyak - bankSoalan.length;
  let aiSoalan = [];
  let savedIds = [];

  if (remaining > 0) {
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt({
      tingkatan: input.tingkatan,
      tajuk: input.tajuk,
      tahap: input.tahap,
      bilanganPilihan: input.bilanganPilihan,
      mula: input.mula + bankSoalan.length,
      banyak: remaining,
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
        banyak: remaining,
        mula: input.mula + bankSoalan.length,
        bilanganPilihan: input.bilanganPilihan,
      });
    } catch (e) {
      // Jumlah soalan tidak sepadan (AI sengaja pulangkan kurang) ialah
      // isyarat perniagaan yang jelas - hentikan proses per spesifikasi.
      // Ralat lain (JSON rosak/terpotong, struktur tidak sah) ialah gangguan
      // sementara AI - pulangkan 502 supaya klien cuba semula secara automatik
      // (lihat js/app.js), bukan terus gagal dengan mesej teknikal.
      if (e.code === 'BILANGAN_TIDAK_SEPADAN') {
        res.status(422).json({
          ok: false,
          error: `AI mengembalikan hasil yang tidak lengkap atau tidak sah: ${e.message}`,
        });
        return;
      }
      res.status(502).json({
        ok: false,
        error: `AI mengembalikan hasil yang tidak sah, sedang cuba semula: ${e.message}`,
      });
      return;
    }

    aiSoalan = batch.soalan;

    try {
      savedIds = await saveToBank(supabase, {
        tingkatan: input.tingkatan,
        tajuk: input.tajuk,
        bilanganPilihan: input.bilanganPilihan,
        sourceId: refContext.sources[0].id,
        soalanList: aiSoalan,
      });
    } catch (e) {
      savedIds = [];
    }
  }

  // Nombor semula soalan bank supaya bersambung dengan urutan yang diminta.
  const numberedBank = bankSoalan.map((q, idx) => ({ ...q, no: input.mula + idx }));
  const finalSoalan = [...numberedBank, ...aiSoalan];

  // Tanda SEMUA soalan yang dihantar (bank + baru disimpan) sebagai telah
  // digunakan oleh guru ini, supaya tidak diulang pada janaan akan datang.
  try {
    await markUsed(supabase, { teacherId, questionIds: [...bankIds, ...savedIds] });
  } catch (e) {
    // senyap - penjejakan bukan langkah kritikal
  }

  res.status(200).json({
    ok: true,
    tajuk: input.tajuk,
    soalan: finalSoalan,
    bankCount: numberedBank.length,
    aiCount: aiSoalan.length,
  });
};
