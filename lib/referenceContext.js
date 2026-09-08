/**
 * Membaca bahan rujukan aktif daripada Supabase bagi Tingkatan + Tajuk
 * yang dipilih, dan menyusunnya menjadi teks konteks untuk AI.
 *
 * `supabase` diterima sebagai parameter (bukan diimport terus) supaya
 * fungsi ini mudah diuji dengan klien palsu (lihat tests/).
 */

const MAX_CONTEXT_CHARS = 12000;

async function fetchActiveTopics(supabase, tingkatan) {
  const { data, error } = await supabase
    .from('math_reference_sources')
    .select('tajuk')
    .eq('tingkatan', tingkatan)
    .eq('is_active', true)
    .order('tajuk', { ascending: true });

  if (error) {
    const err = new Error('Gagal membaca senarai tajuk daripada Supabase.');
    err.cause = error;
    throw err;
  }

  const unique = [...new Set((data || []).map((row) => row.tajuk).filter(Boolean))];
  return unique;
}

async function fetchReferenceContext(supabase, { tingkatan, tajuk }) {
  const { data: sources, error: sourcesError } = await supabase
    .from('math_reference_sources')
    .select('id, title, reference_type, subtajuk, original_text')
    .eq('tingkatan', tingkatan)
    .eq('tajuk', tajuk)
    .eq('is_active', true);

  if (sourcesError) {
    const err = new Error('Gagal membaca bahan rujukan daripada Supabase.');
    err.cause = sourcesError;
    throw err;
  }

  if (!sources || sources.length === 0) {
    return { sources: [], chunks: [], contextText: '' };
  }

  const sourceIds = sources.map((s) => s.id);

  const { data: chunks, error: chunksError } = await supabase
    .from('math_reference_chunks')
    .select('id, source_id, chunk_no, title, content, keywords')
    .in('source_id', sourceIds)
    .order('chunk_no', { ascending: true });

  if (chunksError) {
    const err = new Error('Gagal membaca petikan rujukan daripada Supabase.');
    err.cause = chunksError;
    throw err;
  }

  const contextText = buildContextText(sources, chunks || []);

  return { sources, chunks: chunks || [], contextText };
}

function buildContextText(sources, chunks) {
  const parts = [];

  for (const source of sources) {
    let block = `[SUMBER: ${source.title}]`;
    if (source.subtajuk) block += ` (Subtajuk: ${source.subtajuk})`;
    if (source.original_text) {
      block += `\n${source.original_text}`;
    }
    parts.push(block);

    const relatedChunks = chunks
      .filter((c) => c.source_id === source.id)
      .sort((a, b) => a.chunk_no - b.chunk_no);

    for (const chunk of relatedChunks) {
      const chunkTitle = chunk.title ? ` - ${chunk.title}` : '';
      parts.push(`(Petikan #${chunk.chunk_no}${chunkTitle})\n${chunk.content}`);
    }
  }

  let text = parts.join('\n\n');
  if (text.length > MAX_CONTEXT_CHARS) {
    text = text.slice(0, MAX_CONTEXT_CHARS) + '\n\n[...rujukan dipotong kerana terlalu panjang...]';
  }
  return text;
}

module.exports = { fetchActiveTopics, fetchReferenceContext, buildContextText, MAX_CONTEXT_CHARS };
