/**
 * Module quản lý Session GoLike (Lưu trữ đủ 17 trường chuẩn GoMax)
 * Cô lập tuyệt đối - Không dùng chung storage với XSMM hay Facebook
 */

export interface GolikeSessionData {
  golike_token: string;
  golike_t_header: string;
  golike_g_auth: string;
  golike_device_id: string;
  golike_username: string;
  golike_user_id: string;
  golike_signing_key: string;
  golike_web_data: string;
  golike_web_cookies: string;
  golike_header: Record<string, string>;
  golike_tiktok_map: Record<string, string>;
  golike_version_app: string;
  golike_web_version: string;
  golike_web_version_text: string;
  golike_protocol: string;
  golike_gauth_version: string;
  golike_scheme: string;
}

export const GOLIKE_STORAGE_KEYS = [
  "golike_token",
  "golike_t_header",
  "golike_g_auth",
  "golike_device_id",
  "golike_username",
  "golike_user_id",
  "golike_signing_key",
  "golike_web_data",
  "golike_web_cookies",
  "golike_header",
  "golike_tiktok_map",
  "golike_version_app",
  "golike_web_version",
  "golike_web_version_text",
  "golike_protocol",
  "golike_gauth_version",
  "golike_scheme",
] as const;

export const DEFAULT_GOLIKE_SESSION: GolikeSessionData = {
  golike_token: "",
  golike_t_header: "",
  golike_g_auth: "",
  golike_device_id: "",
  golike_username: "",
  golike_user_id: "",
  golike_signing_key: "",
  golike_web_data: "null",
  golike_web_cookies: "",
  golike_header: {},
  golike_tiktok_map: {},
  golike_version_app: "3.0",
  golike_web_version: "3.0",
  golike_web_version_text: "26.09.17.1",
  golike_protocol: "v2",
  golike_gauth_version: "1.0",
  golike_scheme: "https",
};

/**
 * Mã JavaScript chuẩn tiêm vào Browser/WebView để hook toàn bộ session GoLike
 */
export const GOLIKE_INJECT_JS = `
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

  // 1. Quét dữ liệu từ LocalStorage, Vuex Store và DOM Text
  function captureSessionStore() {
    try {
      let signingKey = '';
      let userId = '';
      let webData = localStorage.getItem('__') || 'null';
      let deviceId = localStorage.getItem('device_id') || localStorage.getItem('deviceId') || '';
      let username = localStorage.getItem('username') || '';
      let version = '';

      // Đọc từ Vuex Store của Golike
      let appRoot = document.querySelector('#app');
      let state = appRoot && appRoot.__vue__ && appRoot.__vue__.$store ? appRoot.__vue__.$store.state : null;
      if (state) {
        signingKey = String(state.signing_key || '');
        userId = String(state.user_id || '');
        if (!deviceId) deviceId = String(state.device_id || state.deviceId || '');
        if (!username) username = String(state.username || state.user_name || '');
        if (state.app_version || state.version) version = String(state.app_version || state.version);
      }

      // Quét LocalStorage dự phòng
      for (let i = 0; i < localStorage.length; i++) {
        let key = localStorage.key(i);
        let val = localStorage.getItem(key);
        if (!signingKey && key === 'signing_key') signingKey = val;
        if (!userId && key === 'user_id') userId = val;
      }

      // Quét text phiên bản hiển thị trên màn hình (ví dụ: 26.09.17.1)
      let versionText = '26.09.17.1';
      let match = document.body && document.body.innerText ? document.body.innerText.match(/(\\d+\\.\\d+\\.\\d+\\.\\d+)/) : null;
      if (match) versionText = match[1];

      // Gửi dữ liệu về Client/Native Host
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

  // 2. Hook Header từ Network Requests
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

  // Hook window.fetch
  let origFetch = window.fetch;
  window.fetch = function() {
    let args = arguments;
    if (args[1] && args[1].headers) captureHeaders(args[1].headers);
    return origFetch.apply(this, args);
  };

  // Hook XMLHttpRequest
  let origSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
    if (!this._headers) this._headers = {};
    this._headers[header] = value;
    if (String(header).toLowerCase() === 'authorization' && value && value !== 'Bearer null') {
      captureHeaders(this._headers);
    }
    return origSetRequestHeader.apply(this, arguments);
  };

  // 3. Chủ động kích hoạt request /api/users/me nếu đã ở trang chủ để ép Web nhả đủ Headers
  setTimeout(function() {
    if (window.fetch && location.pathname !== '/login') {
      window.fetch('/api/users/me').catch(function(){});
    }
  }, 1000);
})();
`;

/**
 * Lưu toàn bộ 17 trường Session GoLike vào localStorage
 */
export function saveGolikeSession(
  session: Partial<GolikeSessionData>,
): GolikeSessionData {
  if (typeof window === "undefined") {
    return { ...DEFAULT_GOLIKE_SESSION, ...session };
  }

  const existing = loadGolikeSession() || DEFAULT_GOLIKE_SESSION;
  const merged: GolikeSessionData = {
    ...existing,
    ...session,
  };

  // Chuẩn hóa token luôn có tiền tố Bearer
  if (
    merged.golike_token &&
    !merged.golike_token.toLowerCase().startsWith("bearer ")
  ) {
    merged.golike_token = `Bearer ${merged.golike_token.trim()}`;
  }

  try {
    // 1. Lưu từng trường riêng lẻ chuẩn Storage Key
    localStorage.setItem("golike_token", merged.golike_token || "");
    localStorage.setItem("golike_t_header", merged.golike_t_header || "");
    localStorage.setItem("golike_g_auth", merged.golike_g_auth || "");
    localStorage.setItem("golike_device_id", merged.golike_device_id || "");
    localStorage.setItem("golike_username", merged.golike_username || "");
    localStorage.setItem("golike_user_id", merged.golike_user_id || "");
    localStorage.setItem("golike_signing_key", merged.golike_signing_key || "");
    localStorage.setItem("golike_web_data", merged.golike_web_data || "null");
    localStorage.setItem("golike_web_cookies", merged.golike_web_cookies || "");
    localStorage.setItem(
      "golike_header",
      JSON.stringify(merged.golike_header || {}),
    );
    localStorage.setItem(
      "golike_tiktok_map",
      JSON.stringify(merged.golike_tiktok_map || {}),
    );
    localStorage.setItem(
      "golike_version_app",
      merged.golike_version_app || "3.0",
    );
    localStorage.setItem(
      "golike_web_version",
      merged.golike_web_version || "3.0",
    );
    localStorage.setItem(
      "golike_web_version_text",
      merged.golike_web_version_text || "26.09.17.1",
    );
    localStorage.setItem("golike_protocol", merged.golike_protocol || "v2");
    localStorage.setItem(
      "golike_gauth_version",
      merged.golike_gauth_version || "1.0",
    );
    localStorage.setItem("golike_scheme", merged.golike_scheme || "https");

    // 2. Lưu trọn gói vào bundle cô lập golike_session_v1
    localStorage.setItem("golike_session_v1", JSON.stringify(merged));
  } catch {
    // ignore storage error
  }

  return merged;
}

/**
 * Đọc toàn bộ 17 trường Session GoLike từ localStorage
 */
export function loadGolikeSession(): GolikeSessionData | null {
  if (typeof window === "undefined") return null;

  try {
    const bundle = localStorage.getItem("golike_session_v1");
    if (bundle) {
      const parsed = JSON.parse(bundle) as GolikeSessionData;
      if (parsed.golike_token) {
        return { ...DEFAULT_GOLIKE_SESSION, ...parsed };
      }
    }

    // Đọc từng trường riêng lẻ nếu chưa có bundle
    const token = localStorage.getItem("golike_token");
    if (!token) return null;

    let headersMap: Record<string, string> = {};
    try {
      const hStr = localStorage.getItem("golike_header");
      if (hStr) headersMap = JSON.parse(hStr);
    } catch {
      // ignore
    }

    let tiktokMap: Record<string, string> = {};
    try {
      const tStr = localStorage.getItem("golike_tiktok_map");
      if (tStr) tiktokMap = JSON.parse(tStr);
    } catch {
      // ignore
    }

    return {
      golike_token: token,
      golike_t_header: localStorage.getItem("golike_t_header") || "",
      golike_g_auth: localStorage.getItem("golike_g_auth") || "",
      golike_device_id: localStorage.getItem("golike_device_id") || "",
      golike_username: localStorage.getItem("golike_username") || "",
      golike_user_id: localStorage.getItem("golike_user_id") || "",
      golike_signing_key: localStorage.getItem("golike_signing_key") || "",
      golike_web_data: localStorage.getItem("golike_web_data") || "null",
      golike_web_cookies: localStorage.getItem("golike_web_cookies") || "",
      golike_header: headersMap,
      golike_tiktok_map: tiktokMap,
      golike_version_app: localStorage.getItem("golike_version_app") || "3.0",
      golike_web_version: localStorage.getItem("golike_web_version") || "3.0",
      golike_web_version_text:
        localStorage.getItem("golike_web_version_text") || "26.09.17.1",
      golike_protocol: localStorage.getItem("golike_protocol") || "v2",
      golike_gauth_version:
        localStorage.getItem("golike_gauth_version") || "1.0",
      golike_scheme: localStorage.getItem("golike_scheme") || "https",
    };
  } catch {
    return null;
  }
}

/**
 * Xóa sạch toàn bộ 17 trường khi đăng xuất
 */
export async function clearGolikeSession(token?: string): Promise<void> {
  if (typeof window === "undefined") return;

  const currentTok = token || localStorage.getItem("golike_token") || "";

  try {
    for (const key of GOLIKE_STORAGE_KEYS) {
      localStorage.removeItem(key);
    }
    localStorage.removeItem("golike_session_v1");
    localStorage.removeItem("golike_balance");
    localStorage.removeItem("golike_token");
    localStorage.removeItem("golike_username");
  } catch {
    // ignore
  }

  // Xóa trực tiếp file session thông qua Rust Tauri invoke
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("clear_golike_session");
  } catch {
    // ignore
  }
}

/**
 * Tạo bộ 8 Headers chuẩn Golike Gateway để gửi request không bị lỗi version
 */
export function buildGolikeHeaders(
  session: GolikeSessionData,
): Record<string, string> {
  const sanitize = (val: string): string => {
    if (!val) return "";
    return val.replace(/[^\x20-\x7E\xA0-\xFF]/g, "").trim();
  };

  const rawToken = session.golike_token || "";
  const token = rawToken.startsWith("Bearer ")
    ? rawToken
    : `Bearer ${rawToken}`;

  const versionText = session.golike_web_version_text || "26.09.17.1";

  const headers: Record<string, string> = {
    Authorization: sanitize(token),
    t: sanitize(session.golike_t_header || ""),
    "g-auth": sanitize(session.golike_g_auth || ""),
    "g-device-id": sanitize(session.golike_device_id || ""),
    "g-username": sanitize(session.golike_username || ""),
    "g-version": sanitize(versionText),
    "g-client": "web",
    "g-scheme": sanitize(session.golike_scheme || "https"),
    "User-Agent":
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1",
    Origin: "https://app.golike.net",
    Referer: "https://app.golike.net/",
    "Content-Type": "application/json;charset=utf-8",
    Accept: "application/json, text/plain, */*",
  };

  if (session.golike_web_cookies) {
    headers.Cookie = sanitize(session.golike_web_cookies);
  }

  return headers;
}

/**
 * BƯỚC CỰC KỲ QUAN TRỌNG: Gọi API Sync Protocol sau đăng nhập
 * GET https://gateway.golike.net/api/app/golike-protocol
 */
export async function syncGolikeProtocol(
  session: GolikeSessionData,
): Promise<{ success: boolean; protocol?: string; gauthVersion?: string }> {
  try {
    const headers = buildGolikeHeaders(session);

    const res = await fetch("https://gateway.golike.net/api/app/golike-protocol", {
      method: "GET",
      headers,
    });

    const data = await res.json();

    let protocol = "v2";
    let gauthVersion = "1.0";

    if (data?.data) {
      if (data.data.protocol) protocol = String(data.data.protocol);
      if (data.data.gauth_version || data.data.version) {
        gauthVersion = String(data.data.gauth_version || data.data.version);
      }
    } else if (data?.protocol) {
      protocol = String(data.protocol);
    }

    // Cập nhật session với dữ liệu protocol mới
    saveGolikeSession({
      golike_protocol: protocol,
      golike_gauth_version: gauthVersion,
      golike_scheme: "https",
    });

    return {
      success: true,
      protocol,
      gauthVersion,
    };
  } catch (err: unknown) {
    console.warn("Lỗi syncGolikeProtocol (sử dụng cấu hình fallback v2):", err);
    saveGolikeSession({
      golike_protocol: "v2",
      golike_gauth_version: "1.0",
      golike_scheme: "https",
    });
    return {
      success: true,
      protocol: "v2",
      gauthVersion: "1.0",
    };
  }
}

/**
 * Đồng bộ Session GoLike trực tiếp từ LevelDB / GoLike Gateway (Không dùng server trung gian)
 */
export async function syncGolikeSessionFromBridge(): Promise<{
  success: boolean;
  user?: { username: string; balance: string; token: string; coin: number };
  session?: GolikeSessionData;
} | null> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const data: any = await invoke("extract_golike_session");
    if (data?.success && data?.user?.token) {
      let username = data.user.username || "GoLike User";
      let balance = data.user.balance || "0 coin";
      let coin = 0;

      // Kết nối trực tiếp máy chủ GoLike Gateway lấy số dư thực tế
      try {
        const { getGolikeUser } = await import("./golike-api");
        const freshUser = await getGolikeUser(data.user.token);
        if (freshUser.success && freshUser.user) {
          username = freshUser.user.username;
          coin = freshUser.user.coin;
          balance = `${coin.toLocaleString("vi-VN")} coin`;
        }
      } catch {
        // ignore
      }

      const saved = saveGolikeSession({
        ...(data.session || {}),
        golike_token: data.user.token,
        golike_username: username,
      });

      try {
        localStorage.setItem("golike_username", username);
        localStorage.setItem("golike_balance", balance);
        localStorage.setItem("golike_token", data.user.token);
      } catch {
        // ignore
      }

      return {
        success: true,
        user: {
          username,
          balance,
          token: data.user.token,
          coin,
        },
        session: saved,
      };
    }
  } catch {
    // Bỏ qua nếu môi trường web thuần
  }

  return null;
}
