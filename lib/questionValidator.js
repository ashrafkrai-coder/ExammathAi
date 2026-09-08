const { buildOptionKeys } = require('./promptBuilder');

/**
 * Mengekstrak objek JSON daripada teks respons AI (buang pagar markdown jika ada)
 * dan mengesahkan strukturnya. Melempar Error dengan mesej Bahasa Melayu jika tidak sah.
 */
function parseAndValidateBatch(rawText, { banyak, mula, bilanganPilihan }) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('AI tidak mengembalikan sebarang teks.');
  }

  let jsonText = rawText.trim();
  const fencedMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch) {
    jsonText = fencedMatch[1].trim();
  }

  const firstBrace = jsonText.indexOf('{');
  const lastBrace = jsonText.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error('Respons AI bukan format JSON yang sah.');
  }
  jsonText = jsonText.slice(firstBrace, lastBrace + 1);

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    throw new Error('Gagal menghurai JSON daripada respons AI.');
  }

  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.soalan)) {
    throw new Error('Struktur JSON daripada AI tidak lengkap (medan "soalan" tiada).');
  }

  if (parsed.soalan.length !== banyak) {
    throw new Error(
      `AI mengembalikan ${parsed.soalan.length} soalan sahaja, bukan ${banyak} soalan yang diminta.`
    );
  }

  const expectedKeys = buildOptionKeys(bilanganPilihan);

  parsed.soalan.forEach((q, idx) => {
    const expectedNo = mula + idx;
    if (!q || typeof q !== 'object') {
      throw new Error(`Soalan #${expectedNo} tidak sah.`);
    }
    if (typeof q.soalan !== 'string' || !q.soalan.trim()) {
      throw new Error(`Soalan #${expectedNo} tiada teks soalan.`);
    }
    if (!q.pilihan || typeof q.pilihan !== 'object') {
      throw new Error(`Soalan #${expectedNo} tiada pilihan jawapan.`);
    }
    for (const key of expectedKeys) {
      if (typeof q.pilihan[key] !== 'string' || !q.pilihan[key].trim()) {
        throw new Error(`Soalan #${expectedNo} tiada pilihan "${key}".`);
      }
    }
    if (!expectedKeys.includes(q.jawapan)) {
      throw new Error(`Soalan #${expectedNo} mempunyai jawapan yang tidak sah ("${q.jawapan}").`);
    }
    if (typeof q.penerangan !== 'string' || !q.penerangan.trim()) {
      throw new Error(`Soalan #${expectedNo} tiada langkah kerja/penerangan.`);
    }
    q.no = expectedNo;
    if (!q.tahap) q.tahap = 'sederhana';
  });

  return parsed;
}

module.exports = { parseAndValidateBatch };
