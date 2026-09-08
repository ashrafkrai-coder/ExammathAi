(function () {
  'use strict';

  const TAHAP_LABEL = { mudah: 'Mudah', sederhana: 'Sederhana', sukar: 'Sukar', campuran: 'Campuran' };
  const SAVE_KEY = 'examMathSpm.savedSets.v1';

  const els = {};
  let statusData = null;
  let currentSet = null;
  let isGenerating = false;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function authHeaders() {
    const token = window.AppAuth && window.AppAuth.getAccessToken ? window.AppAuth.getAccessToken() : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function init() {
    cacheEls();
    initTabs();
    initFormListeners();
    loadStatus();
    loadTopics(els.fTingkatan.value);
    updateGenerateButtonLabel();
    renderSavedList();
  }

  function cacheEls() {
    [
      'fTingkatan', 'fTajuk', 'fTahap', 'fBilangan', 'fPilihan', 'fProvider',
      'btnGenerate', 'btnGenerateCount', 'settingsHint',
      'progressCard', 'progressBarFill', 'progressPercent', 'progressCount', 'progressStatus',
      'errorCard', 'errorMessage',
      'resultsWrap', 'resultsTitle', 'resultsMeta', 'questionsList',
      'toggleJawapan', 'toggleLangkah',
      'btnSimpan', 'btnCetak', 'btnEksportWord', 'btnSalin',
      'aiIndicator', 'aiDot', 'aiIndicatorText',
      'providerStatusList', 'fDefaultProvider',
      'savedList',
    ].forEach((id) => { els[id] = document.getElementById(id); });
  }

  // ---------------------------------------------------------------
  // Tabs
  // ---------------------------------------------------------------
  function initTabs() {
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach((b) => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
        document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
        if (btn.dataset.tab === 'simpanan') renderSavedList();
      });
    });
  }

  function switchToTab(name) {
    const btn = document.querySelector(`.tab-btn[data-tab="${name}"]`);
    if (btn) btn.click();
  }

  // ---------------------------------------------------------------
  // Form listeners
  // ---------------------------------------------------------------
  function initFormListeners() {
    els.fTingkatan.addEventListener('change', () => loadTopics(els.fTingkatan.value));
    els.fBilangan.addEventListener('change', updateGenerateButtonLabel);
    els.btnGenerate.addEventListener('click', onGenerateClick);

    els.toggleJawapan.addEventListener('change', () => applyToggles());
    els.toggleLangkah.addEventListener('change', () => applyToggles());

    els.btnSimpan.addEventListener('click', onSaveClick);
    els.btnCetak.addEventListener('click', () => window.print());
    els.btnEksportWord.addEventListener('click', onExportWordClick);
    els.btnSalin.addEventListener('click', onCopyClick);

    els.fDefaultProvider.addEventListener('change', () => {
      localStorage.setItem('examMathSpm.defaultProvider', els.fDefaultProvider.value);
    });

    const savedProvider = localStorage.getItem('examMathSpm.defaultProvider');
    if (savedProvider) {
      els.fDefaultProvider.value = savedProvider;
      els.fProvider.value = savedProvider;
    }
  }

  function updateGenerateButtonLabel() {
    els.btnGenerateCount.textContent = els.fBilangan.value;
  }

  // ---------------------------------------------------------------
  // Status AI (/api/status)
  // ---------------------------------------------------------------
  async function loadStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (!data.ok) throw new Error('gagal');
      statusData = data;
      renderAiIndicator(data);
      renderProviderStatusList(data);
    } catch (e) {
      els.aiDot.classList.add('error');
      els.aiIndicatorText.textContent = 'Gagal menyemak status AI';
      els.providerStatusList.innerHTML = '<p>Gagal menyemak status pelayan. Sila semak sambungan internet.</p>';
    }
  }

  function renderAiIndicator(data) {
    const anyReady = Object.values(data.providers).some((p) => p.ready);
    els.aiDot.classList.remove('ready', 'error');
    if (anyReady && data.supabase) {
      els.aiDot.classList.add('ready');
      els.aiIndicatorText.textContent = 'AI Bersedia';
    } else if (!data.supabase) {
      els.aiDot.classList.add('error');
      els.aiIndicatorText.textContent = 'Supabase belum ditetapkan';
    } else {
      els.aiDot.classList.add('error');
      els.aiIndicatorText.textContent = 'Tiada kunci API AI ditetapkan';
    }
  }

  function renderProviderStatusList(data) {
    const labels = { gemini: 'Gemini' };
    els.providerStatusList.innerHTML = '';

    const supaRow = document.createElement('div');
    supaRow.className = 'provider-status-row';
    supaRow.innerHTML = `
      <div><strong>Supabase (Bank Rujukan)</strong><span class="model">SUPABASE_URL + SUPABASE_SECRET_KEY</span></div>
      <span class="status-badge ${data.supabase ? 'ready' : 'not-ready'}">${data.supabase ? 'Bersedia' : 'Belum Ditetapkan'}</span>
    `;
    els.providerStatusList.appendChild(supaRow);

    Object.keys(data.providers).forEach((key) => {
      const p = data.providers[key];
      const row = document.createElement('div');
      row.className = 'provider-status-row';
      row.innerHTML = `
        <div><strong>${labels[key] || key}</strong><span class="model">${p.model} • maks ${p.maxBatch} soalan/kelompok</span></div>
        <span class="status-badge ${p.ready ? 'ready' : 'not-ready'}">${p.ready ? 'Bersedia' : 'Belum Ditetapkan'}</span>
      `;
      els.providerStatusList.appendChild(row);
    });
  }

  // ---------------------------------------------------------------
  // Tajuk aktif (/api/topics)
  // ---------------------------------------------------------------
  async function loadTopics(tingkatan) {
    els.fTajuk.disabled = true;
    els.fTajuk.innerHTML = '<option value="">Memuatkan tajuk...</option>';
    els.settingsHint.textContent = '';

    try {
      const res = await fetch(`/api/topics?tingkatan=${encodeURIComponent(tingkatan)}`, { headers: authHeaders() });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Gagal memuatkan tajuk.');

      if (!data.tajuk || data.tajuk.length === 0) {
        els.fTajuk.innerHTML = '<option value="">Tiada tajuk aktif</option>';
        els.settingsHint.textContent = `Tiada tajuk aktif dijumpai untuk Tingkatan ${tingkatan} dalam Bank Rujukan. Sila hubungi pentadbir untuk menambah rujukan.`;
        return;
      }

      els.fTajuk.innerHTML = data.tajuk.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
      els.fTajuk.disabled = false;
    } catch (e) {
      els.fTajuk.innerHTML = '<option value="">Gagal memuatkan tajuk</option>';
      els.settingsHint.textContent = 'Gagal memuatkan senarai tajuk daripada pelayan. Sila cuba muat semula halaman.';
    }
  }

  // ---------------------------------------------------------------
  // Jana Soalan (batching + progress)
  // ---------------------------------------------------------------
  function planBatches(total, maxBatch) {
    const batches = [];
    let remaining = total;
    let mula = 1;
    while (remaining > 0) {
      const banyak = Math.min(maxBatch, remaining);
      batches.push({ mula, banyak });
      mula += banyak;
      remaining -= banyak;
    }
    return batches;
  }

  async function onGenerateClick() {
    if (isGenerating) return;

    const tingkatan = Number(els.fTingkatan.value);
    const tajuk = els.fTajuk.value;
    const tahap = els.fTahap.value;
    const bilangan = Number(els.fBilangan.value);
    const bilanganPilihan = Number(els.fPilihan.value);
    const provider = els.fProvider.value;

    hideEl(els.errorCard);
    hideEl(els.resultsWrap);

    if (!tajuk) {
      showError('Sila pilih tajuk terlebih dahulu sebelum menjana soalan.');
      return;
    }

    if (!statusData) await loadStatus();
    const providerInfo = statusData && statusData.providers ? statusData.providers[provider] : null;

    if (!statusData || !statusData.supabase) {
      showError('Supabase belum ditetapkan sepenuhnya di pelayan (SUPABASE_URL / SUPABASE_SECRET_KEY). Sila hubungi pentadbir sistem.');
      return;
    }
    if (!providerInfo || !providerInfo.ready) {
      showError(`Kunci API untuk penyedia AI yang dipilih belum ditetapkan di pelayan. Sila pilih penyedia lain atau hubungi pentadbir sistem.`);
      return;
    }

    const maxBatch = providerInfo.maxBatch;
    const batches = planBatches(bilangan, maxBatch);

    isGenerating = true;
    els.btnGenerate.disabled = true;
    showEl(els.progressCard);
    updateProgress(0, bilangan, 'Menyediakan permintaan...');

    const collected = [];
    let resultTajuk = tajuk;

    try {
      const MAX_ATTEMPTS = 3;

      for (let i = 0; i < batches.length; i++) {
        const b = batches[i];
        let data;
        let status;

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          const statusText = attempt === 1
            ? `Menjana soalan ${b.mula} hingga ${b.mula + b.banyak - 1}...`
            : `Menjana soalan ${b.mula} hingga ${b.mula + b.banyak - 1}... (cuba semula ${attempt}/${MAX_ATTEMPTS})`;
          updateProgress(collected.length, bilangan, statusText);

          const res = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({
              provider, tingkatan, tajuk, tahap,
              bilangan_pilihan: bilanganPilihan,
              mula: b.mula, banyak: b.banyak,
            }),
          });

          status = res.status;
          data = await res.json();

          if (data.ok) break;

          // 502 = kegagalan sementara AI/rangkaian (timeout, model sibuk) - patut cuba semula.
          // Ralat lain (401/400/404/422) bersifat kekal untuk kelompok ini - jangan buang masa.
          if (status !== 502 || attempt === MAX_ATTEMPTS) break;

          await sleep(1500);
        }

        if (!data.ok) {
          throw new Error(data.error || 'Gagal menjana soalan.');
        }

        resultTajuk = data.tajuk || resultTajuk;
        collected.push(...data.soalan);
        updateProgress(collected.length, bilangan, `Selesai soalan ${b.mula} hingga ${b.mula + b.banyak - 1}.`);
      }

      if (collected.length !== bilangan) {
        throw new Error(
          `Jumlah soalan akhir (${collected.length}) tidak sama dengan jumlah yang diminta (${bilangan}). Proses dihentikan dan hasil tidak dipaparkan.`
        );
      }

      currentSet = {
        id: `set_${Date.now()}`,
        tingkatan, tajuk: resultTajuk, tahap, bilanganPilihan, provider,
        tarikh: formatTarikhHariIni(),
        soalan: collected,
      };

      updateProgress(bilangan, bilangan, 'Selesai!');
      renderResults(currentSet);
      hideEl(els.progressCard);
      showEl(els.resultsWrap);
    } catch (e) {
      hideEl(els.progressCard);
      showError(e.message || 'Ralat tidak diketahui berlaku semasa menjana soalan.');
      currentSet = null;
    } finally {
      isGenerating = false;
      els.btnGenerate.disabled = false;
    }
  }

  function updateProgress(done, total, statusText) {
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    els.progressBarFill.style.width = `${pct}%`;
    els.progressPercent.textContent = `${pct}%`;
    els.progressCount.textContent = `${done} / ${total} soalan`;
    els.progressStatus.textContent = statusText;
  }

  function showError(msg) {
    els.errorMessage.textContent = msg;
    showEl(els.errorCard);
  }

  // ---------------------------------------------------------------
  // Render hasil
  // ---------------------------------------------------------------
  function renderResults(set) {
    els.resultsTitle.textContent = set.tajuk;
    els.resultsMeta.textContent = `Tingkatan ${set.tingkatan} • ${TAHAP_LABEL[set.tahap] || set.tahap} • ${set.soalan.length} soalan • ${set.tarikh}`;

    els.questionsList.innerHTML = set.soalan.map((q) => questionCardHtml(q)).join('');

    els.toggleJawapan.checked = false;
    els.toggleLangkah.checked = false;
    applyToggles();

    renderMathIfAvailable();
  }

  function questionCardHtml(q) {
    const optionsHtml = Object.keys(q.pilihan || {}).map((key) => {
      const isCorrect = key === q.jawapan;
      return `
        <div class="option-item ${isCorrect ? 'correct-answer' : ''}" data-correct="${isCorrect}">
          <span class="opt-key">${escapeHtml(key)}.</span>
          <span class="opt-text">${escapeHtml(q.pilihan[key])}</span>
        </div>`;
    }).join('');

    const tahap = (q.tahap || 'sederhana').toLowerCase();

    return `
      <div class="question-card">
        <div class="question-head">
          <span class="question-no">${q.no}</span>
          <span class="question-tahap-badge ${tahap}">${TAHAP_LABEL[tahap] || tahap}</span>
        </div>
        <p class="question-text">${escapeHtml(q.soalan)}</p>
        <div class="options-grid">${optionsHtml}</div>
        <div class="working-box">${escapeHtml(q.penerangan || '')}</div>
      </div>`;
  }

  function applyToggles() {
    const showAnswer = els.toggleJawapan.checked;
    const showWorking = els.toggleLangkah.checked;

    document.querySelectorAll('.question-card').forEach((card) => {
      card.classList.toggle('answer-hidden', !showAnswer);
      const workingBox = card.querySelector('.working-box');
      if (workingBox) workingBox.classList.toggle('visible', showWorking);
    });
  }

  function renderMathIfAvailable() {
    if (window.renderMathInElement) {
      window.renderMathInElement(els.questionsList, {
        delimiters: [
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true },
          { left: '$$', right: '$$', display: true },
        ],
        throwOnError: false,
      });
    }
  }

  // ---------------------------------------------------------------
  // Simpanan (localStorage)
  // ---------------------------------------------------------------
  function getSavedSets() {
    try {
      return JSON.parse(localStorage.getItem(SAVE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function setSavedSets(list) {
    localStorage.setItem(SAVE_KEY, JSON.stringify(list));
  }

  function onSaveClick() {
    if (!currentSet) return;
    const list = getSavedSets();
    list.unshift(currentSet);
    setSavedSets(list);
    els.btnSimpan.textContent = '✅ Disimpan';
    setTimeout(() => { els.btnSimpan.textContent = '💾 Simpan'; }, 1800);
    renderSavedList();
  }

  function renderSavedList() {
    const list = getSavedSets();
    if (list.length === 0) {
      els.savedList.innerHTML = '<p class="hint-text">Belum ada set soalan disimpan.</p>';
      return;
    }

    els.savedList.innerHTML = list.map((set) => `
      <div class="saved-item" data-id="${set.id}">
        <div class="saved-item-info">
          <strong>${escapeHtml(set.tajuk)}</strong>
          <span>Tingkatan ${set.tingkatan} • ${set.soalan.length} soalan • ${escapeHtml(set.tarikh)}</span>
        </div>
        <div class="saved-item-actions">
          <button class="btn btn-secondary btn-view" data-id="${set.id}">👁️ Lihat</button>
          <button class="btn btn-secondary btn-export" data-id="${set.id}">📄 Word</button>
          <button class="btn btn-danger-outline btn-delete" data-id="${set.id}">🗑️ Padam</button>
        </div>
      </div>
    `).join('');

    els.savedList.querySelectorAll('.btn-view').forEach((btn) => {
      btn.addEventListener('click', () => {
        const set = getSavedSets().find((s) => s.id === btn.dataset.id);
        if (!set) return;
        currentSet = set;
        renderResults(set);
        hideEl(els.errorCard);
        hideEl(els.progressCard);
        showEl(els.resultsWrap);
        switchToTab('jana');
      });
    });

    els.savedList.querySelectorAll('.btn-export').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const set = getSavedSets().find((s) => s.id === btn.dataset.id);
        if (!set) return;
        try {
          await window.exportQuestionSetToDocx(set);
        } catch (e) {
          alert(e.message);
        }
      });
    });

    els.savedList.querySelectorAll('.btn-delete').forEach((btn) => {
      btn.addEventListener('click', () => {
        const list2 = getSavedSets().filter((s) => s.id !== btn.dataset.id);
        setSavedSets(list2);
        renderSavedList();
      });
    });
  }

  // ---------------------------------------------------------------
  // Eksport / Salin
  // ---------------------------------------------------------------
  async function onExportWordClick() {
    if (!currentSet) return;
    els.btnEksportWord.disabled = true;
    const original = els.btnEksportWord.textContent;
    els.btnEksportWord.textContent = 'Menjana fail...';
    try {
      await window.exportQuestionSetToDocx(currentSet);
    } catch (e) {
      alert(e.message);
    } finally {
      els.btnEksportWord.disabled = false;
      els.btnEksportWord.textContent = original;
    }
  }

  async function onCopyClick() {
    if (!currentSet) return;
    const text = buildPlainText(currentSet);
    try {
      await navigator.clipboard.writeText(text);
      const original = els.btnSalin.textContent;
      els.btnSalin.textContent = '✅ Disalin';
      setTimeout(() => { els.btnSalin.textContent = original; }, 1800);
    } catch (e) {
      alert('Gagal menyalin ke papan klip. Sila cuba lagi.');
    }
  }

  function buildPlainText(set) {
    const lines = [`${set.tajuk}`, `Tingkatan ${set.tingkatan} • ${set.soalan.length} soalan • ${set.tarikh}`, ''];
    set.soalan.forEach((q) => {
      lines.push(`${q.no}. ${q.soalan}`);
      Object.keys(q.pilihan || {}).forEach((k) => lines.push(`   ${k}. ${q.pilihan[k]}`));
      lines.push(`   Jawapan: ${q.jawapan}`);
      if (q.penerangan) lines.push(`   Langkah Kerja: ${q.penerangan}`);
      lines.push('');
    });
    return lines.join('\n');
  }

  // ---------------------------------------------------------------
  // Util
  // ---------------------------------------------------------------
  function showEl(el) { el.classList.remove('hidden'); }
  function hideEl(el) { el.classList.add('hidden'); }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatTarikhHariIni() {
    const d = new Date();
    const bulan = ['Januari','Februari','Mac','April','Mei','Jun','Julai','Ogos','September','Oktober','November','Disember'];
    return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
  }
})();
