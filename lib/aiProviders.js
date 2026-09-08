/**
 * Adapter untuk memanggil penyedia AI (Gemini) menggunakan `fetch` global
 * Node.js. Fungsi menerima `fetchImpl` pilihan supaya mudah diuji dengan
 * fetch palsu.
 */

const PROVIDER_CONFIG = {
  gemini: {
    label: 'Gemini',
    model: 'gemini-2.5-flash',
    maxBatch: 10,
    timeoutMs: 45000,
  },
};

function getProviderConfig(provider) {
  const cfg = PROVIDER_CONFIG[provider];
  if (!cfg) {
    const err = new Error(`Penyedia AI "${provider}" tidak disokong.`);
    err.code = 'INVALID_PROVIDER';
    throw err;
  }
  return cfg;
}

function withTimeout(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

async function callGemini({ apiKey, systemPrompt, userPrompt, timeoutMs, fetchImpl = fetch }) {
  const { signal, clear } = withTimeout(timeoutMs);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${PROVIDER_CONFIG.gemini.model}:generateContent?key=${apiKey}`;
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.4,
        },
      }),
      signal,
    });
    if (!res.ok) {
      const bodyText = await safeReadText(res);
      throw new Error(`Gemini ralat (${res.status}): ${bodyText}`);
    }
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  } finally {
    clear();
  }
}

async function safeReadText(res) {
  try {
    return await res.text();
  } catch {
    return '(tiada butiran)';
  }
}

/**
 * Menjana satu kelompok soalan menggunakan penyedia AI yang dipilih.
 * Melempar Error mesra-pengguna (Bahasa Melayu) jika kunci API tiada
 * atau panggilan gagal/timeout.
 */
async function generateWithProvider(provider, { systemPrompt, userPrompt, env = process.env, fetchImpl }) {
  const cfg = getProviderConfig(provider);

  if (provider === 'gemini') {
    if (!env.GEMINI_API_KEY) {
      throw friendlyKeyError('Gemini', 'GEMINI_API_KEY');
    }
    return callGemini({
      apiKey: env.GEMINI_API_KEY,
      systemPrompt,
      userPrompt,
      timeoutMs: cfg.timeoutMs,
      fetchImpl,
    });
  }

  throw new Error(`Penyedia AI "${provider}" tidak disokong.`);
}

function friendlyKeyError(label, envName) {
  const err = new Error(
    `Kunci API untuk ${label} belum ditetapkan di pelayan (env var ${envName}). Sila tetapkan dalam Vercel/​.env dan cuba lagi.`
  );
  err.code = 'MISSING_API_KEY';
  return err;
}

module.exports = {
  PROVIDER_CONFIG,
  getProviderConfig,
  generateWithProvider,
  callGemini,
};
