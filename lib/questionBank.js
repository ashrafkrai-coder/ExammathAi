/**
 * Bank soalan: guna semula soalan yang pernah dijana AI supaya janaan
 * seterusnya lebih pantas dan tetap berfungsi walaupun AI sedang sibuk
 * atau gagal sementara.
 *
 * Strategi "bank-dahulu": bagi setiap kelompok, cuba ambil soalan sedia
 * ada daripada math_question_examples (sepadan Tingkatan+Tajuk+Tahap,
 * belum pernah dilihat oleh guru berkenaan - lihat math_question_usage)
 * sebelum memanggil AI untuk baki yang masih diperlukan.
 */

const CANDIDATE_POOL_SIZE = 100;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function rowToSoalan(row) {
  return {
    soalan: row.question_text,
    pilihan: row.options,
    jawapan: row.correct_answer,
    tahap: row.tahap,
    penerangan: row.working_text,
  };
}

/**
 * Ambil sehingga `limit` soalan daripada bank yang sepadan dan belum
 * pernah digunakan oleh `teacherId`. Pulangkan { soalan, ids } - ids
 * diperlukan untuk ditanda sebagai "telah digunakan" selepas dihantar.
 */
async function fetchFromBank(supabase, { tingkatan, tajuk, tahap, bilanganPilihan, teacherId, limit }) {
  if (limit <= 0) return { soalan: [], ids: [] };

  let excludeIds = [];
  if (teacherId) {
    const { data: usageRows, error: usageError } = await supabase
      .from('math_question_usage')
      .select('question_id')
      .eq('teacher_id', teacherId);
    if (usageError) throw usageError;
    excludeIds = (usageRows || []).map((r) => r.question_id);
  }

  let query = supabase
    .from('math_question_examples')
    .select('id, question_text, options, correct_answer, working_text, tahap')
    .eq('tingkatan', tingkatan)
    .eq('tajuk', tajuk)
    .eq('approved', true)
    .eq('bilangan_pilihan', bilanganPilihan)
    .limit(CANDIDATE_POOL_SIZE);

  if (tahap !== 'campuran') {
    query = query.eq('tahap', tahap);
  }
  if (excludeIds.length > 0) {
    query = query.not('id', 'in', `(${excludeIds.join(',')})`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const picked = shuffle(data || []).slice(0, limit);
  return { soalan: picked.map(rowToSoalan), ids: picked.map((r) => r.id) };
}

/**
 * Tandakan soalan bank sebagai telah dilihat oleh guru ini (elak ulangan
 * pada janaan akan datang). Gagal secara senyap - ini bukan langkah kritikal.
 */
async function markUsed(supabase, { teacherId, questionIds }) {
  if (!teacherId || !questionIds || questionIds.length === 0) return;
  const rows = questionIds.map((id) => ({ teacher_id: teacherId, question_id: id }));
  await supabase
    .from('math_question_usage')
    .upsert(rows, { onConflict: 'teacher_id,question_id', ignoreDuplicates: true })
    .then(() => {}, () => {});
}

/**
 * Simpan soalan yang baru dijana AI ke dalam bank supaya boleh diguna
 * semula pada masa hadapan. Gagal secara senyap (pulang []) - ini bukan
 * langkah kritikal dan tidak patut menyebabkan permintaan semasa gagal.
 * Pulangkan id baris yang berjaya disimpan supaya boleh ditanda "telah
 * digunakan" oleh guru semasa serta-merta (elak diulang pada permintaan
 * seterusnya oleh guru yang sama).
 */
async function saveToBank(supabase, { tingkatan, tajuk, bilanganPilihan, sourceId, soalanList }) {
  if (!soalanList || soalanList.length === 0) return [];
  const rows = soalanList.map((q) => ({
    tingkatan,
    tajuk,
    tahap: q.tahap,
    bilangan_pilihan: bilanganPilihan,
    question_text: q.soalan,
    options: q.pilihan,
    correct_answer: q.jawapan,
    working_text: q.penerangan,
    source_id: sourceId || null,
    approved: true,
  }));
  const { data } = await supabase
    .from('math_question_examples')
    .insert(rows)
    .select('id')
    .then((r) => r, () => ({ data: [] }));
  return (data || []).map((r) => r.id);
}

module.exports = { fetchFromBank, markUsed, saveToBank };
