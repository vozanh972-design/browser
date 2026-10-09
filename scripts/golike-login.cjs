/**
 * AutoLunex GoLike Login Service (Chuẩn GoMax 100%)
 * - Tự mở trình duyệt mobile view (iOS Safari User-Agent chuẩn GoMax để bypass Cloudflare Turnstile)
 * - Tự tiêm Javascript Hook bắt trọn 17 trường session
 * - Tự đồng bộ Protocol gateway.golike.net/api/app/golike-protocol
 * - Lưu file session và cung cấp Local HTTP API (cổng 18899) cho AutoLunex
 */

const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('C:/Users/Admin/AppData/Local/Programs/Python/Python313/Lib/site-packages/playwright/driver/package/index.js');

const PORT = 18899;
const GOMAX_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1';

const SESSION_PATHS = [
  path.join(__dirname, '../golike_session.json'),
  'D:\\AutoLunex\\golike_session.json'
];

let currentSession = null;
let isBrowserOpen = false;

// Tải session đã lưu nếu có
for (const p of SESSION_PATHS) {
  try {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed && parsed.golike_token) {
        currentSession = parsed;
        break;
      }
    }
  } catch (e) {}
}

const GOMAX_INJECT_JS = `
(function() {
  if (window.hasInjectedAuthDetector) {
    if (window.goMaxCaptureSessionStore) window.goMaxCaptureSessionStore();
    return;
  }
  window.hasInjectedAuthDetector = true;

  function readHeader(headers, name) {
    if (!headers || !name) return '';
    try {
      if (typeof headers.get === 'function')
        return headers.get(name) || headers.get(name.toLowerCase()) || headers.get(name.toUpperCase()) || '';
    } catch(e) {}
    try {
      if (Array.isArray(headers)) {
        for (let i = 0; i < headers.length; i++) {
          let h = headers[i] || [];
          if (String(h[0]).toLowerCase() === name.toLowerCase()) return h[1] || '';
        }
      }
    } catch(e) {}
    try {
      let lower = name.toLowerCase();
      for (let key in headers) {
        if (String(key).toLowerCase() === lower) return headers[key] || '';
      }
    } catch(e) {}
    return '';
  }

  function findValueDeep(obj, key, depth) {
    if (!obj || depth > 8) return '';
    try {
      if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== null && obj[key] !== undefined) return obj[key];
      if (key === 'user_id' && obj.user && obj.user.id !== null && obj.user.id !== undefined) return obj.user.id;
      if (key === 'user_id' && obj.auth && obj.auth.user && obj.auth.user.id !== null && obj.auth.user.id !== undefined) return obj.auth.user.id;
      for (let k in obj) {
        let v = obj[k];
        if (v && typeof v === 'object') {
          let found = findValueDeep(v, key, depth + 1);
          if (found !== '' && found !== null && found !== undefined) return found;
        }
      }
    } catch(e) {}
    return '';
  }

  function captureSessionStore() {
    try {
      let signingKey = '';
      let userId = '';
      let webData = localStorage.getItem('__') || 'null';
      let deviceId = localStorage.getItem('device_id') || localStorage.getItem('deviceId') || '';
      let username = localStorage.getItem('username') || '';
      let appRoot = document.querySelector('#app');
      let state = appRoot && appRoot.__vue__ && appRoot.__vue__.$store ? appRoot.__vue__.$store.state : null;
      if (!state && appRoot && appRoot.__vue_app__ && appRoot.__vue_app__.config && appRoot.__vue_app__.config.globalProperties && appRoot.__vue_app__.config.globalProperties.$store) {
        state = appRoot.__vue_app__.config.globalProperties.$store.state;
      }
      if (state) {
        signingKey = String(state.signing_key || '');
        userId = String(state.user_id || '');
        if (!deviceId) deviceId = String(state.device_id || state.deviceId || '');
        if (!username) username = String(state.username || state.user_name || '');
      }
      for (let i = 0; i < localStorage.length; i++) {
        let storageKey = localStorage.key(i);
        let raw = localStorage.getItem(storageKey);
        if (!raw) continue;
        if (!signingKey && storageKey === 'signing_key') signingKey = raw;
        if (!userId && storageKey === 'user_id') userId = raw;
        if (raw.charAt(0) === '{' || raw.charAt(0) === '[') {
          try {
            let parsed = JSON.parse(raw);
            if (!signingKey) signingKey = String(findValueDeep(parsed, 'signing_key', 0) || '');
            if (!userId) userId = String(findValueDeep(parsed, 'user_id', 0) || '');
          } catch(e) {}
        }
      }
      if (!signingKey && state) signingKey = String(findValueDeep(state, 'signing_key', 0) || '');
      if (!userId && state) userId = String(findValueDeep(state, 'user_id', 0) || '');
      if (!deviceId && state) deviceId = String(findValueDeep(state, 'device_id', 0) || findValueDeep(state, 'deviceId', 0) || '');
      if (!username && state) username = String(findValueDeep(state, 'username', 0) || '');

      let versionText = '26.09.17.1';
      let match = document.body && document.body.innerText ? document.body.innerText.match(/(\\d+\\.\\d+\\.\\d+\\.\\d+)/) : null;
      if (match) versionText = match[1];

      if (window.GoMaxApp && window.GoMaxApp.sendGatewayHeaders && (deviceId || username)) {
        GoMaxApp.sendGatewayHeaders('', deviceId || '', username || '');
      }
      if (window.GoMaxApp && window.GoMaxApp.sendSessionStore) {
        GoMaxApp.sendSessionStore(signingKey || '', userId || '', webData || 'null', versionText);
      }
      if (window.NativeBridge && window.NativeBridge.onStoreCaptured) {
        window.NativeBridge.onStoreCaptured(signingKey || '', userId || '', webData || 'null', deviceId || '', username || '', '3.0', versionText);
      }
    } catch(e) {}
  }
  window.goMaxCaptureSessionStore = captureSessionStore;

  function captureHeaders(headers) {
    captureSessionStore();
    let auth = readHeader(headers, 'authorization');
    let tHeader = readHeader(headers, 't');
    let gAuth = readHeader(headers, 'g-auth');
    let gDeviceId = readHeader(headers, 'g-device-id');
    let gUsername = readHeader(headers, 'g-username');
    let gVersion = readHeader(headers, 'g-version');
    let gScheme = readHeader(headers, 'g-scheme') || 'https';

    if (gAuth || gDeviceId || gUsername) {
      if (window.GoMaxApp && window.GoMaxApp.sendGatewayHeaders) {
        GoMaxApp.sendGatewayHeaders(gAuth || '', gDeviceId || '', gUsername || '');
      }
    }
    if (auth && auth !== 'null' && auth !== 'undefined' && auth !== 'Bearer null') {
      console.log('AUTH_HEADER=' + auth);
      if (window.GoMaxApp && window.GoMaxApp.sendAuthData) {
        GoMaxApp.sendAuthData(auth, tHeader || '');
      }
      if (window.NativeBridge && window.NativeBridge.onHeadersCaptured) {
        window.NativeBridge.onHeadersCaptured(auth, tHeader || '', gAuth || '', gDeviceId || '', gUsername || '', gVersion || '', 'web', gScheme);
      }
    }
    if (tHeader && tHeader !== 'null' && tHeader !== 'undefined') {
      console.log('T_HEADER=' + tHeader);
    }
  }

  let origFetch = window.fetch;
  window.fetch = function() {
    const args = arguments;
    let options = args[1] || {};
    try {
      if (args[0] && args[0].headers) captureHeaders(args[0].headers);
    } catch(e) {}
    captureHeaders(options.headers || {});
    return origFetch.apply(this, args);
  };

  let origSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
    if (!this._headers) this._headers = {};
    this._headers[String(header).toLowerCase()] = value;
    if (String(header).toLowerCase() === 'authorization' && value && value !== 'Bearer null') {
      console.log('AUTH_HEADER=' + value);
      if (window.GoMaxApp && window.GoMaxApp.sendAuthData) {
        GoMaxApp.sendAuthData(value, this._headers['t'] || '');
      }
      if (window.NativeBridge && window.NativeBridge.onHeadersCaptured) {
        window.NativeBridge.onHeadersCaptured(value, this._headers['t'] || '', this._headers['g-auth'] || '', this._headers['g-device-id'] || '', this._headers['g-username'] || '', this._headers['g-version'] || '', 'web', 'https');
      }
    }
    if (String(header).toLowerCase() === 'g-auth' || String(header).toLowerCase() === 'g-device-id' || String(header).toLowerCase() === 'g-username') {
      if (window.GoMaxApp && window.GoMaxApp.sendGatewayHeaders) {
        GoMaxApp.sendGatewayHeaders(this._headers['g-auth'] || '', this._headers['g-device-id'] || '', this._headers['g-username'] || '');
      }
    }
    if (String(header).toLowerCase() === 't' && value && value !== 'null') {
      console.log('T_HEADER=' + value);
    }
    return origSetRequestHeader.apply(this, arguments);
  };

  captureSessionStore();
  setTimeout(captureSessionStore, 1000);
  setTimeout(captureSessionStore, 2500);
  let sessionPolls = 0;
  let sessionTimer = setInterval(function() {
    captureSessionStore();
    if (++sessionPolls >= 120) clearInterval(sessionTimer);
  }, 1000);
})();
`;

async function syncProtocol(session) {
  try {
    const token = session.golike_token.startsWith('Bearer ') ? session.golike_token : `Bearer ${session.golike_token}`;
    const headers = {
      'Authorization': token,
      't': session.golike_t_header || '',
      'g-auth': session.golike_g_auth || '',
      'g-device-id': session.golike_device_id || '',
      'g-username': session.golike_username || '',
      'g-version': session.golike_web_version_text || '26.09.17.1',
      'g-client': 'web',
      'g-scheme': session.golike_scheme || 'https',
      'User-Agent': GOMAX_USER_AGENT,
      'Origin': 'https://app.golike.net',
      'Referer': 'https://app.golike.net/',
      'Accept': 'application/json, text/plain, */*'
    };

    const res = await fetch('https://gateway.golike.net/api/app/golike-protocol', {
      method: 'GET',
      headers
    });
    const data = await res.json();
    if (data?.data?.protocol) session.golike_protocol = String(data.data.protocol);
    if (data?.data?.gauth_version) session.golike_gauth_version = String(data.data.gauth_version);
    console.log('[GOMAX SYNC] Protocol synced:', session.golike_protocol, session.golike_gauth_version);
  } catch (err) {
    console.warn('[GOMAX SYNC] Fallback protocol v2:', err.message);
  }
}

async function launchGolikeBrowser() {
  if (isBrowserOpen) {
    console.log('[GOMAX] Browser already open.');
    return { success: false, message: 'Trình duyệt đang mở sẵn.' };
  }

  isBrowserOpen = true;

  const session = {
    golike_token: '',
    golike_t_header: '',
    golike_g_auth: '',
    golike_device_id: '',
    golike_username: '',
    golike_user_id: '',
    golike_signing_key: '',
    golike_web_data: 'null',
    golike_web_cookies: '',
    golike_header: {},
    golike_tiktok_map: {},
    golike_version_app: '3.0',
    golike_web_version: '3.0',
    golike_web_version_text: '26.09.17.1',
    golike_protocol: 'v2',
    golike_gauth_version: '1.0',
    golike_scheme: 'https'
  };

  let browser;
  let isSaved = false;

  try {
    browser = await chromium.launch({
      headless: false,
      args: [
        '--window-size=450,780',
        '--window-position=400,100',
        '--app=https://app.golike.net/login'
      ]
    });

    const context = await browser.newContext({
      viewport: { width: 430, height: 740 },
      userAgent: GOMAX_USER_AGENT
    });

    const finishCapture = async () => {
      if (isSaved || !session.golike_token) return;
      isSaved = true;

      const cookies = await context.cookies();
      session.golike_web_cookies = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      await syncProtocol(session);

      currentSession = session;

      for (const p of SESSION_PATHS) {
        try {
          const dir = path.dirname(p);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(p, JSON.stringify(session, null, 2), 'utf8');
          console.log('[GOMAX] Saved session to:', p);
        } catch (e) {
          console.warn('[GOMAX] Cannot write to:', p, e.message);
        }
      }

      console.log('✅ [GOMAX CAPTURED 17 FIELDS SUCCESS]');

      setTimeout(async () => {
        try {
          await browser.close();
        } catch (e) {}
        isBrowserOpen = false;
      }, 1200);
    };

    // Expose GoMax interfaces
    await context.exposeFunction('goMaxSendAuthData', async (auth, t) => {
      if (auth && auth !== 'Bearer null' && auth !== 'null') {
        session.golike_token = auth.startsWith('Bearer ') ? auth : `Bearer ${auth}`;
        if (t) session.golike_t_header = t;
        await finishCapture();
      }
    });

    await context.exposeFunction('goMaxSendGatewayHeaders', (gAuth, gDeviceId, gUsername) => {
      if (gAuth) session.golike_g_auth = gAuth;
      if (gDeviceId) session.golike_device_id = gDeviceId;
      if (gUsername) session.golike_username = gUsername;
    });

    await context.exposeFunction('goMaxSendSessionStore', async (signingKey, userId, webData, versionText) => {
      if (signingKey) session.golike_signing_key = signingKey;
      if (userId) session.golike_user_id = userId;
      if (webData) session.golike_web_data = webData;
      if (versionText) session.golike_web_version_text = versionText;
      if (session.golike_token) await finishCapture();
    });

    const page = await context.newPage();

    // Listen to console for fallback capture
    page.on('console', async (msg) => {
      const text = msg.text();
      if (text.startsWith('AUTH_HEADER=')) {
        const auth = text.replace('AUTH_HEADER=', '').trim();
        if (auth && auth !== 'null' && auth !== 'Bearer null') {
          session.golike_token = auth.startsWith('Bearer ') ? auth : `Bearer ${auth}`;
          await finishCapture();
        }
      } else if (text.startsWith('T_HEADER=')) {
        session.golike_t_header = text.replace('T_HEADER=', '').trim();
      }
    });

    await page.addInitScript(`
      window.GoMaxApp = {
        sendAuthData: window.goMaxSendAuthData,
        sendGatewayHeaders: window.goMaxSendGatewayHeaders,
        sendSessionStore: window.goMaxSendSessionStore
      };
      window.NativeBridge = {
        onStoreCaptured: function(signingKey, userId, webData, deviceId, username, version, versionText) {
          window.goMaxSendSessionStore(signingKey, userId, webData, versionText);
          if (deviceId || username) window.goMaxSendGatewayHeaders('', deviceId, username);
        },
        onHeadersCaptured: function(auth, t, gAuth, gDeviceId, gUsername, gVersion, gClient, gScheme) {
          window.goMaxSendAuthData(auth, t);
          window.goMaxSendGatewayHeaders(gAuth, gDeviceId, gUsername);
        }
      };
    `);

    await page.addInitScript(GOMAX_INJECT_JS);

    await page.goto('https://app.golike.net/login', { waitUntil: 'domcontentloaded' });

    page.on('close', () => {
      isBrowserOpen = false;
      console.log('[GOMAX] Browser window closed.');
    });

    return { success: true, message: 'Đã mở trình duyệt đăng nhập GoLike.' };
  } catch (err) {
    isBrowserOpen = false;
    console.error('[GOMAX ERROR] Lỗi mở browser:', err);
    return { success: false, error: err.message };
  }
}

// Khởi chạy HTTP Server cục bộ cho AutoLunex giao tiếp
const server = http.createServer(async (req, res) => {
  // Bật CORS cho AutoLunex
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', isBrowserOpen }));
    return;
  }

  if (url.pathname === '/open-login' && req.method === 'POST') {
    const result = await launchGolikeBrowser();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  if (url.pathname === '/session') {
    // Đọc session mới nhất từ file nếu có
    for (const p of SESSION_PATHS) {
      try {
        if (fs.existsSync(p)) {
          const content = fs.readFileSync(p, 'utf8');
          currentSession = JSON.parse(content);
          break;
        }
      } catch (e) {}
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      hasSession: Boolean(currentSession && currentSession.golike_token),
      session: currentSession,
      isBrowserOpen
    }));
    return;
  }

  if (url.pathname === '/clear-session' && req.method === 'POST') {
    currentSession = null;
    for (const p of SESSION_PATHS) {
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch (e) {}
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[GOMAX SERVER] GoLike Bridge listening on http://127.0.0.1:${PORT}`);
  if (process.argv.includes('--open')) {
    launchGolikeBrowser();
  }
});
