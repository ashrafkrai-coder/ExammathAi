/**
 * Membina system prompt & user prompt untuk AI menjana soalan Matematik SPM.
 * Fungsi tulen (pure) - tiada rangkaian, mudah diuji.
 */

function buildOptionKeys(bilanganPilihan) {
  const keys = [];
  for (let i = 0; i < bilanganPilihan; i++) {
    keys.push(String.fromCharCode(65 + i)); // A, B, C, D, ...
  }
  return keys;
}

function buildSystemPrompt() {
  return [
    'Anda adalah penjana soalan Matematik SPM (Kurikulum Malaysia) yang sangat teliti.',
    'Anda WAJIB mengikut arahan berikut tanpa pengecualian:',
    '1. Gunakan Bahasa Melayu standard dan istilah Matematik yang tepat.',
    '2. Gunakan HANYA fakta, formula, konsep dan skop yang terdapat dalam KONTEKS RUJUKAN yang diberikan. JANGAN mencipta formula, fakta atau tajuk di luar rujukan tersebut.',
    '3. Jika rujukan tidak mencukupi untuk menjana sesuatu soalan, hasilkan soalan lain yang masih berpandukan rujukan yang ada - jangan reka maklumat baharu.',
    '4. Gunakan nombor, simbol dan notasi Matematik dengan jelas. Gunakan LaTeX ringkas seperti \\(x^2\\), \\(\\sqrt{...}\\), pecahan \\(\\frac{a}{b}\\) dan simbol yang sesuai apabila perlu.',
    '5. Pilihan jawapan mesti munasabah, berbeza antara satu sama lain, dan hanya SATU jawapan yang tepat.',
    '6. Sertakan langkah kerja/penerangan jawapan yang jelas dalam Bahasa Melayu bagi setiap soalan.',
    '7. Output MESTI json tulen sahaja mengikut skema yang diberikan dalam arahan pengguna. JANGAN tambah markdown (```), JANGAN tambah teks di luar json, JANGAN tambah ulasan.',
  ].join('\n');
}

function buildUserPrompt({ tingkatan, tajuk, tahap, bilanganPilihan, mula, banyak, contextText }) {
  const optionKeys = buildOptionKeys(bilanganPilihan);
  const optionsExample = optionKeys.reduce((acc, k) => {
    acc[k] = '...';
    return acc;
  }, {});

  const tahapArahan =
    tahap === 'campuran'
      ? 'Agihkan tahap kesukaran secara campuran (mudah, sederhana, sukar) secara rawak merata antara soalan-soalan ini.'
      : `Semua soalan mesti bertahap kesukaran: ${tahap}.`;

  const schemaContoh = {
    tajuk: tajuk,
    soalan: [
      {
        no: mula,
        soalan: 'Selesaikan persamaan ...',
        pilihan: optionsExample,
        jawapan: optionKeys[0],
        tahap: tahap === 'campuran' ? 'mudah' : tahap,
        penerangan: 'Langkah kerja yang jelas...',
      },
    ],
  };

  return [
    `KONTEKS RUJUKAN (Tingkatan ${tingkatan}, Tajuk: ${tajuk}):`,
    '"""',
    contextText,
    '"""',
    '',
    `Jana TEPAT ${banyak} soalan objektif Matematik SPM bagi Tingkatan ${tingkatan}, Tajuk "${tajuk}".`,
    `Nombor soalan bermula daripada ${mula} sehingga ${mula + banyak - 1} (medan "no").`,
    `Setiap soalan mesti mempunyai tepat ${bilanganPilihan} pilihan jawapan dengan kunci: ${optionKeys.join(', ')}.`,
    tahapArahan,
    'Kembalikan HANYA satu objek JSON sah mengikut format berikut (tanpa markdown, tanpa teks lain):',
    JSON.stringify(schemaContoh, null, 2),
  ].join('\n');
}

module.exports = { buildSystemPrompt, buildUserPrompt, buildOptionKeys };
