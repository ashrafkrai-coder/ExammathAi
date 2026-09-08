const VALID_TINGKATAN = [4, 5];
const VALID_TAHAP = ['mudah', 'sederhana', 'sukar', 'campuran'];
const VALID_BILANGAN = [5, 10, 15, 20, 30, 40];
const VALID_PROVIDER = ['gemini'];

/**
 * Mengesahkan payload untuk /api/generate (satu kelompok).
 * Melempar Error dengan mesej Bahasa Melayu jika tidak sah.
 */
function validateGenerateInput(body) {
  const { provider, tingkatan, tajuk, tahap, bilangan_pilihan, mula, banyak } = body || {};

  if (!VALID_PROVIDER.includes(provider)) {
    throw new Error('Penyedia AI tidak sah. Sila pilih Gemini.');
  }

  const tingkatanNum = Number(tingkatan);
  if (!VALID_TINGKATAN.includes(tingkatanNum)) {
    throw new Error('Tingkatan tidak sah. Sila pilih Tingkatan 4 atau Tingkatan 5.');
  }

  if (typeof tajuk !== 'string' || !tajuk.trim()) {
    throw new Error('Sila pilih tajuk terlebih dahulu.');
  }

  if (!VALID_TAHAP.includes(tahap)) {
    throw new Error('Tahap kesukaran tidak sah.');
  }

  const bilanganPilihanNum = Number(bilangan_pilihan) || 4;
  if (bilanganPilihanNum < 2 || bilanganPilihanNum > 6) {
    throw new Error('Bilangan pilihan jawapan tidak sah.');
  }

  const mulaNum = Number(mula);
  if (!Number.isInteger(mulaNum) || mulaNum < 1) {
    throw new Error('Parameter "mula" tidak sah.');
  }

  const banyakNum = Number(banyak);
  if (!Number.isInteger(banyakNum) || banyakNum < 1) {
    throw new Error('Parameter "banyak" tidak sah.');
  }

  return {
    provider,
    tingkatan: tingkatanNum,
    tajuk: tajuk.trim(),
    tahap,
    bilanganPilihan: bilanganPilihanNum,
    mula: mulaNum,
    banyak: banyakNum,
  };
}

function isValidBilanganTotal(n) {
  return VALID_BILANGAN.includes(Number(n));
}

module.exports = {
  VALID_TINGKATAN,
  VALID_TAHAP,
  VALID_BILANGAN,
  VALID_PROVIDER,
  validateGenerateInput,
  isValidBilanganTotal,
};
