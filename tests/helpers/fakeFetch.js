/**
 * Fetch palsu untuk ujian - memadankan permintaan mengikut substring URL
 * dan mengembalikan objek Response tiruan. Membolehkan kita menguji
 * api/generate.js & api/topics.js hujung-ke-hujung tanpa rangkaian sebenar.
 *
 * Reka bentuk sebagai satu fungsi fetch STATIK (dipasang sekali ke
 * global.fetch) yang membaca peraturan semasa melalui rujukan boleh-ubah,
 * supaya ia tetap berfungsi walaupun @supabase/supabase-js menyimpan
 * rujukan kepada global.fetch pada masa klien dicipta.
 */
let currentRules = [];

async function statefulFakeFetch(url, opts) {
  const urlStr = String(url);
  for (const rule of currentRules) {
    if (rule.match(urlStr, opts)) {
      const result = rule.respond(urlStr, opts);
      return new Response(JSON.stringify(result.body), {
        status: result.status || 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  throw new Error(`fakeFetch: tiada peraturan sepadan untuk URL: ${urlStr}`);
}

function setFakeFetchRules(rules) {
  currentRules = rules;
}

module.exports = { statefulFakeFetch, setFakeFetchRules };
