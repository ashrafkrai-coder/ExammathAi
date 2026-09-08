(function () {
  'use strict';

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }

  const SESSION_KEY = 'examMathSpm.authSession.v1';
  const REFRESH_MARGIN_SECONDS = 60;

  let config = null; // { supabaseUrl, supabasePublishableKey }
  let appActivated = false;

  const els = {};

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    els.loginScreen = document.getElementById('loginScreen');
    els.appRoot = document.getElementById('appRoot');
    els.loginForm = document.getElementById('loginForm');
    els.loginEmail = document.getElementById('loginEmail');
    els.loginPassword = document.getElementById('loginPassword');
    els.loginError = document.getElementById('loginError');
    els.btnLogin = document.getElementById('btnLogin');
    els.loginSpinner = document.getElementById('loginSpinner');
    els.btnLogout = document.getElementById('btnLogout');

    els.loginForm.addEventListener('submit', onLoginSubmit);
    els.btnLogout.addEventListener('click', onLogoutClick);

    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      if (data.ok) config = data;
    } catch (e) {
      config = null;
    }

    if (!config || !config.supabaseUrl || !config.supabasePublishableKey) {
      showLoginError('Sistem log masuk belum ditetapkan sepenuhnya di pelayan. Sila hubungi pentadbir sistem.');
      setFormDisabled(true);
      return;
    }

    const existing = loadSession();
    if (existing) {
      const valid = await ensureFreshSession(existing);
      if (valid) {
        activateApp();
        return;
      }
    }
    showLoginScreen();
  }

  function setFormDisabled(disabled) {
    els.loginEmail.disabled = disabled;
    els.loginPassword.disabled = disabled;
    els.btnLogin.disabled = disabled;
  }

  function showLoginError(msg) {
    els.loginError.textContent = msg;
    els.loginError.classList.remove('hidden');
  }

  function clearLoginError() {
    els.loginError.textContent = '';
    els.loginError.classList.add('hidden');
  }

  function showLoginScreen() {
    els.loginScreen.hidden = false;
    els.appRoot.hidden = true;
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function sessionFromGoTrueResponse(data) {
    const expiresAt = data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600);
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: expiresAt,
      user: data.user ? { email: data.user.email } : null,
    };
  }

  async function ensureFreshSession(session) {
    const now = Math.floor(Date.now() / 1000);
    if (session.expires_at && session.expires_at - now > REFRESH_MARGIN_SECONDS) {
      return true;
    }
    if (!session.refresh_token) {
      clearSession();
      return false;
    }
    try {
      const res = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: config.supabasePublishableKey },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
      if (!res.ok) {
        clearSession();
        return false;
      }
      const data = await res.json();
      saveSession(sessionFromGoTrueResponse(data));
      return true;
    } catch (e) {
      clearSession();
      return false;
    }
  }

  async function onLoginSubmit(evt) {
    evt.preventDefault();
    clearLoginError();

    const email = els.loginEmail.value.trim();
    const password = els.loginPassword.value;
    if (!email || !password) return;

    setFormDisabled(true);
    els.btnLogin.classList.add('is-loading');

    try {
      const res = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: config.supabasePublishableKey },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        showLoginError('E-mel atau kata laluan tidak sah. Sila cuba lagi.');
        return;
      }

      saveSession(sessionFromGoTrueResponse(data));
      activateApp();
    } catch (e) {
      showLoginError('Gagal menghubungi pelayan log masuk. Sila semak sambungan internet dan cuba lagi.');
    } finally {
      setFormDisabled(false);
      els.btnLogin.classList.remove('is-loading');
    }
  }

  async function onLogoutClick() {
    const session = loadSession();
    clearSession();
    if (session && session.access_token && config) {
      try {
        await fetch(`${config.supabaseUrl}/auth/v1/logout`, {
          method: 'POST',
          headers: { apikey: config.supabasePublishableKey, Authorization: `Bearer ${session.access_token}` },
        });
      } catch (e) {
        // Diabaikan - sesi tempatan sudah dibersihkan.
      }
    }
    location.reload();
  }

  function activateApp() {
    els.loginScreen.hidden = true;
    els.appRoot.hidden = false;

    if (appActivated) return;
    appActivated = true;

    const script = document.createElement('script');
    script.src = '/js/app.js';
    document.body.appendChild(script);
  }

  window.AppAuth = {
    getAccessToken() {
      const session = loadSession();
      return session ? session.access_token : null;
    },
  };
})();
