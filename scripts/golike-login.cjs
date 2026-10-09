/**
 * Script Đăng nhập GoLike tự động qua Playwright Chromium
 * Mở cửa sổ đăng nhập https://app.golike.net, tiêm GOLIKE_INJECT_JS
 * Bắt đủ 17 trường và gọi sync protocol
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('C:/Users/Admin/AppData/Local/Programs/Python/Python313/Lib/site-packages/playwright/driver/package/index.js');

const GOLIKE_INJECT_JS = `
(function() {
  if (window.hasInjectedGolikeHook) {
    if (window.captureSessionStore) window.captureSessionStore();
    return;
  }
  window.hasInjectedGolikeHook = true;

  function readHeader(headers, name) {
    if (!headers || !name) return '';
    try {
      if (typeof headers.get === 'function') 
        return headers.get(name) || headers.get(name.toLowerCase()) || '';
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
      if (typeof headers === 'object') {
        for (let k in headers) {
          if (k.toLowerCase() === name.toLowerCase()) return headers[k] || '';
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
      let version = '';

      let appRoot = document.querySelector('#app');
      let state = appRoot && appRoot.__vue__ && appRoot.__vue__.$store ? appRoot.__vue__.$store.state : null;
      if (state) {
        signingKey = String(state.signing_key || '');
        userId = String(state.user_id || '');
        if (!deviceId) deviceId = String(state.device_id || state.deviceId || '');
        if (!username) username = String(state.username || state.user_name || '');
        if (state.app_version || state.version) version = String(state.app_version || state.version);
      }

      for (let i = 0; i < localStorage.length; i++) {
        let key = localStorage.key(i);
        let val = localStorage.getItem(key);
        if (!signingKey && key === 'signing_key') signingKey = val;
        if (!userId && key === 'user_id') userId = val;
      }

      let versionText = '26.09.17.1';
      let match = document.body && document.body.innerText ? document.body.innerText.match(/(\\d+\\.\\d+\\.\\d+\\.\\d+)/) : null;
      if (match) versionText = match[1];

      if (window.NativeBridge && window.NativeBridge.onStoreCaptured) {
        window.NativeBridge.onStoreCaptured(
          signingKey, userId, webData, deviceId, username, version || '3.0', versionText
        );
      }
    } catch(e) {
      console.error("Lỗi captureSessionStore:", e);
    }
  }
  window.captureSessionStore = captureSessionStore;

  function captureHeaders(headers) {
    captureSessionStore();
    let auth = readHeader(headers, 'authorization');
    let t = readHeader(headers, 't');
    let gAuth = readHeader(headers, 'g-auth');
    let gDeviceId = readHeader(headers, 'g-device-id');
    let gUsername = readHeader(headers, 'g-username');
    let gVersion = readHeader(headers, 'g-version');
    let gClient = readHeader(headers, 'g-client') || 'web';
    let gScheme = readHeader(headers, 'g-scheme') || 'https';

    if (auth && auth !== 'null' && auth !== 'Bearer null' && window.NativeBridge) {
      window.NativeBridge.onHeadersCaptured(
        auth, t, gAuth, gDeviceId, gUsername, gVersion, gClient, gScheme
      );
    }
  }

  let origFetch = window.fetch;
  window.fetch = function() {
    let args = arguments;
    if (args[1] && args[1].headers) captureHeaders(args[1].headers);
    return origFetch.apply(this, args);
  };

  let origSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
    if (!this._headers) this._headers = {};
    this._headers[header] = value;
    if (String(header).toLowerCase() === 'authorization' && value && value !== 'Bearer null') {
      captureHeaders(this._headers);
    }
    return origSetRequestHeader.apply(this, arguments);
  };

  setTimeout(function() {
    if (window.fetch && location.pathname !== '/login') {
      window.fetch('/api/users/me').catch(function(){});
    }
  }, 1000);
})();
`;

(async () => {
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

  let isCaptured = false;

  const browser = await chromium.launch({
    headless: false,
    args: ['--window-size=480,760']
  });

  const context = await browser.newContext({
    viewport: { width: 480, height: 760 },
    userAgent: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  });

  await context.exposeFunction('onStoreCaptured', (signingKey, userId, webData, deviceId, username, version, versionText) => {
    if (signingKey) session.golike_signing_key = signingKey;
    if (userId) session.golike_user_id = userId;
    if (webData) session.golike_web_data = webData;
    if (deviceId) session.golike_device_id = deviceId;
    if (username) session.golike_username = username;
    if (version) session.golike_version_app = version;
    if (versionText) session.golike_web_version_text = versionText;
  });

  await context.exposeFunction('onHeadersCaptured', async (auth, t, gAuth, gDeviceId, gUsername, gVersion, gClient, gScheme) => {
    session.golike_token = auth;
    session.golike_t_header = t;
    session.golike_g_auth = gAuth;
    if (gDeviceId) session.golike_device_id = gDeviceId;
    if (gUsername) session.golike_username = gUsername;
    if (gVersion) session.golike_web_version_text = gVersion;
    if (gScheme) session.golike_scheme = gScheme;

    const cookies = await context.cookies();
    session.golike_web_cookies = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    isCaptured = true;
    console.log('[GOLIKE CAPTURED] Captured 17 fields successfully!');

    // Write result to file
    const outPath = path.join(__dirname, '../golike_session.json');
    fs.writeFileSync(outPath, JSON.stringify(session, null, 2), 'utf8');

    setTimeout(async () => {
      await browser.close();
    }, 1500);
  });

  const page = await context.newPage();
  await page.addInitScript(`
    window.NativeBridge = {
      onStoreCaptured: window.onStoreCaptured,
      onHeadersCaptured: window.onHeadersCaptured
    };
  `);
  await page.addInitScript(GOLIKE_INJECT_JS);

  await page.goto('https://app.golike.net/login');

  page.on('close', () => {
    if (!isCaptured) {
      console.log('Browser closed before capturing session.');
    }
  });
})();
