/**
 * AutoLunex GoLike Login Service (Chuẩn GoMax 100%)
 * - Trích xuất tự động toàn bộ 17 trường từ LevelDB WebView2 (Decrypt AES CryptoJS của GoLike)
 * - Tự động đồng bộ Protocol gateway.golike.net/api/app/golike-protocol
 * - Lưu file session chuẩn và cung cấp Local HTTP API (cổng 18899) cho AutoLunex
 */

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');

const PORT = 18899;
const GOMAX_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1';

const SESSION_PATHS = [
  path.join(__dirname, '../golike_session.json'),
  'D:\\AutoLunex\\golike_session.json'
];

let currentSession = null;
let isBrowserOpen = false;
const clearedTokens = new Set();

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

// ================= LEVELDB DECRYPTION ENGINE (GOMAX / GOLIKE VUE STORE) =================
function evpBytesToKey(password, salt, keyLen, ivLen) {
  let d = Buffer.alloc(0);
  let d_i = Buffer.alloc(0);
  while (d.length < keyLen + ivLen) {
    const hash = crypto.createHash('md5');
    hash.update(d_i);
    hash.update(password);
    hash.update(salt);
    d_i = hash.digest();
    d = Buffer.concat([d, d_i]);
  }
  return { key: d.subarray(0, keyLen), iv: d.subarray(keyLen, keyLen + ivLen) };
}

function decryptAES(ciphertextBase64, passphrase) {
  const raw = Buffer.from(ciphertextBase64, 'base64');
  const salt = raw.subarray(8, 16);
  const data = raw.subarray(16);
  const { key, iv } = evpBytesToKey(Buffer.from(passphrase, 'utf8'), salt, 32, 16);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

function extractFromLevelDb() {
  const candidateDirs = [
    'C:/Users/Admin/AppData/Local/com.autolunex.app/EBWebView/Default/Local Storage/leveldb',
    'D:/AutoLunex/webview_data/Default/Local Storage/leveldb',
    path.join(process.env.LOCALAPPDATA || '', 'com.autolunex.app/EBWebView/Default/Local Storage/leveldb')
  ];

  const BLOCK_SIZE = 32768;
  const key = '426dbb3397e15b7628b5cc8b150107e5';

  for (const dbDir of candidateDirs) {
    if (!fs.existsSync(dbDir)) continue;
    try {
      const files = fs.readdirSync(dbDir).filter(f => f.endsWith('.ldb') || f.endsWith('.log'));
      files.sort((a, b) => fs.statSync(path.join(dbDir, b)).mtimeMs - fs.statSync(path.join(dbDir, a)).mtimeMs);

      for (const f of files) {
        try {
          const buf = fs.readFileSync(path.join(dbDir, f));
          let records = [];
          if (f.endsWith('.log')) {
            let offset = 0;
            let chunks = [];
            while (offset + 7 < buf.length) {
              const rem = BLOCK_SIZE - (offset % BLOCK_SIZE);
              if (rem < 7) { offset += rem; continue; }
              const length = buf.readUInt16LE(offset + 4);
              const type = buf[offset + 6];
              chunks.push({ type, data: buf.subarray(offset + 7, offset + 7 + length) });
              offset += 7 + length;
            }
            let currentRecord = Buffer.alloc(0);
            for (const c of chunks) {
              if (c.type === 1) records.push(c.data);
              else if (c.type === 2) currentRecord = c.data;
              else if (c.type === 3) currentRecord = Buffer.concat([currentRecord, c.data]);
              else if (c.type === 4) { currentRecord = Buffer.concat([currentRecord, c.data]); records.push(currentRecord); currentRecord = Buffer.alloc(0); }
            }
          } else {
            records = [buf];
          }

          for (const rec of records) {
            const str = rec.toString('latin1');
            const marker = '_gx_48923a15c3af';
            let idx = str.indexOf(marker);
            while (idx !== -1) {
              const uIdx = str.indexOf('U2FsdGVkX1', idx);
              if (uIdx !== -1 && uIdx - idx < 50) {
                let b64 = '';
                for (let i = uIdx; i < str.length; i++) {
                  if (/[a-zA-Z0-9+\/=]/.test(str[i])) b64 += str[i];
                  else break;
                }
                try {
                  const dec = decryptAES(b64, key);
                  const parsed = JSON.parse(dec);
                  if (parsed && (parsed.token || parsed.user)) {
                    const cleanTok = String(parsed.token || '').replace(/^Bearer\s+/i, '').trim();
                    if (cleanTok && clearedTokens.has(cleanTok)) {
                      idx = str.indexOf(marker, idx + marker.length);
                      continue;
                    }
                    return parsed;
                  }
                } catch(e) {}
              }
              idx = str.indexOf(marker, idx + marker.length);
            }
          }
        } catch(e) {}
      }
    } catch(e) {}
  }
  return null;
}

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

// Khởi chạy HTTP Server cục bộ cho AutoLunex giao tiếp
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, *');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', isBrowserOpen, hasSession: Boolean(currentSession && currentSession.golike_token) }));
    return;
  }

  // Route trích xuất tự động trực tiếp từ LevelDB của WebView2
  if (url.pathname === '/extract-session' || url.pathname === '/session') {
    const dbData = extractFromLevelDb();
    if (dbData && dbData.token) {
      const token = dbData.token.startsWith('Bearer ') ? dbData.token : `Bearer ${dbData.token}`;
      const username = dbData.user?.username || dbData.user?.name || 'GoLike User';
      const coin = Number(dbData.user?.coin ?? dbData.current_coin ?? 0);
      const balance = `${coin.toLocaleString('vi-VN')} coin`;
      const userId = String(dbData.user?.id || '');

      currentSession = {
        golike_token: token,
        golike_t_header: currentSession?.golike_t_header || '',
        golike_g_auth: currentSession?.golike_g_auth || '',
        golike_device_id: dbData.device_token || currentSession?.golike_device_id || 'd41d8cd98f00b204e9800998ecf8427e',
        golike_username: username,
        golike_user_id: userId,
        golike_signing_key: String(dbData.signing_key || currentSession?.golike_signing_key || ''),
        golike_web_data: JSON.stringify(dbData.user || {}),
        golike_web_cookies: currentSession?.golike_web_cookies || '',
        golike_header: currentSession?.golike_header || {},
        golike_tiktok_map: currentSession?.golike_tiktok_map || {},
        golike_version_app: '3.0',
        golike_web_version: '3.0',
        golike_web_version_text: '26.09.17.1',
        golike_protocol: currentSession?.golike_protocol || 'v2',
        golike_gauth_version: currentSession?.golike_gauth_version || '1.0',
        golike_scheme: 'https'
      };

      // Background protocol sync
      syncProtocol(currentSession).catch(() => {});

      for (const p of SESSION_PATHS) {
        try {
          const dir = path.dirname(p);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(p, JSON.stringify(currentSession, null, 2), 'utf8');
        } catch(e) {}
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        hasSession: true,
        user: { username, balance, token, coin },
        session: currentSession
      }));
      return;
    }

    // fallback: Đọc session từ file nếu không bị cleared
    for (const p of SESSION_PATHS) {
      try {
        if (fs.existsSync(p)) {
          const content = fs.readFileSync(p, 'utf8');
          const parsed = JSON.parse(content);
          const cleanTok = String(parsed?.golike_token || '').replace(/^Bearer\s+/i, '').trim();
          if (!clearedTokens.has(cleanTok)) {
            currentSession = parsed;
            break;
          }
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

  if (url.pathname === '/clear-session') {
    let bodyStr = '';
    req.on('data', chunk => { bodyStr += chunk; });
    req.on('end', () => {
      try {
        if (bodyStr) {
          const b = JSON.parse(bodyStr);
          if (b && b.token) {
            clearedTokens.add(String(b.token).replace(/^Bearer\s+/i, '').trim());
          }
        }
      } catch (e) {}

      const qToken = url.searchParams.get('token');
      if (qToken) {
        clearedTokens.add(String(qToken).replace(/^Bearer\s+/i, '').trim());
      }

      if (currentSession?.golike_token) {
        clearedTokens.add(currentSession.golike_token.replace(/^Bearer\s+/i, '').trim());
      }
      currentSession = null;
      for (const p of SESSION_PATHS) {
        try {
          if (fs.existsSync(p)) fs.unlinkSync(p);
        } catch (e) {}
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    });
    return;
  }

  if (url.pathname === '/reset-clear') {
    clearedTokens.clear();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[GOMAX SERVER] GoLike Bridge listening on http://127.0.0.1:${PORT}`);
});
