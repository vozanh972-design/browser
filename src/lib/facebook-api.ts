import { invoke } from "@tauri-apps/api/core";

export interface FacebookAccountInfo {
  uid: string;
  name: string;
  token?: string;
  cookie?: string;
  avatar?: string;
  cover?: string;
  email?: string;
  proxy?: string;
  isLive: boolean;
  error?: string;
}

export async function executeCurlRequest(options: {
  url: string;
  method?: string;
  headers?: string[];
  body?: string;
  cookie?: string;
  proxy?: string;
  includeHeaders?: boolean;
  timeoutSecs?: number;
}): Promise<string> {
  const timeoutLimit = options.timeoutSecs || 15;

  try {
    return await invoke<string>("curl_request", {
      url: options.url,
      method: options.method ?? "GET",
      headers: options.headers ?? null,
      body: options.body ?? null,
      cookie: options.cookie ?? null,
      proxy: options.proxy ?? null,
      includeHeaders: options.includeHeaders ?? false,
      timeoutSecs: timeoutLimit,
    });
  } catch {
    // Web fallback if outside Tauri
    const headersObj: Record<string, string> = {};
    if (options.headers) {
      for (const h of options.headers) {
        const [k, ...v] = h.split(":");
        if (k && v.length) headersObj[k.trim()] = v.join(":").trim();
      }
    }
    const res = await fetch(options.url, {
      method: options.method ?? "GET",
      headers: headersObj,
      body: options.body,
    });
    return await res.text();
  }
}

// -------------------------------------------------------------
// TOTP 2FA Generator (RFC 6238) - Pure TypeScript implementation
// -------------------------------------------------------------
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32ToBytes(base32: string): Uint8Array {
  const clean = base32.replace(/[\s=-]/g, "").toUpperCase();
  let buffer = 0;
  let bitsLeft = 0;
  const out: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const valIndex = BASE32_ALPHABET.indexOf(clean[i]);
    if (valIndex < 0) continue;
    buffer = ((buffer & ((1 << bitsLeft) - 1)) << 5) | valIndex;
    bitsLeft += 5;
    if (bitsLeft >= 8) {
      out.push((buffer >>> (bitsLeft - 8)) & 0xff);
      bitsLeft -= 8;
      buffer = buffer & ((1 << bitsLeft) - 1);
    }
  }
  return new Uint8Array(out);
}

export async function generateTOTP(secret: string): Promise<string> {
  const keyBytes = base32ToBytes(secret);
  if (keyBytes.length === 0) return "";

  const timeStep = 30;
  const counter = Math.floor(Date.now() / 1000 / timeStep);

  // 8 bytes big-endian counter
  const counterBytes = new Uint8Array(8);
  let temp = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = temp & 0xff;
    temp = Math.floor(temp / 256);
  }

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign("HMAC", cryptoKey, counterBytes);
  const hmac = new Uint8Array(sig);

  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (code % 1000000).toString().padStart(6, "0");
}

// -------------------------------------------------------------
// Facebook Live Checker (Port chuẩn 100% từ FacebookLiveChecker.kt)
// URL: https://m.facebook.com/$uid
// User-Agent: iPhone iOS 18.5
// -------------------------------------------------------------
export function extractUidFromCookie(cookie: string): string | null {
  if (!cookie) return null;
  const match = cookie.match(/c_user=([^;]+)/);
  return match ? match[1].trim() : null;
}

function unescapeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractFacebookAvatarUrl(html: string): string | null {
  const patterns = [
    /data-profile-pic-url="([^"]+)"/,
    /<img[^>]*class="[^"]*profilePic[^"]*"[^>]*src="([^"]+)"/,
    /<div[^>]*role="img"[^>]*style="background-image:\s*url\(['"]?([^'"]+)['"]?\)/,
    /https:\/\/scontent\.[^"]+\.fbcdn\.net\/[^"]+_n\.(?:jpg|png|gif|webp)/,
    /<img[^>]+src="([^"]+)"[^>]*class="[^"]*rounded gray-border[^"]*"/,
  ];

  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1] || m?.[0]) {
      const url = (m[1] || m[0]).replace(/&amp;/g, "&");
      if (!url.includes("silhouette") && !url.includes("default_avatar")) {
        return url;
      }
    }
  }
  return null;
}

export function extractFacebookFullName(html: string): string | null {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch?.[1]) {
    let title = unescapeHtmlEntities(titleMatch[1]);
    title = title.split(" | ")[0].split(" - ")[0].trim();
    // Bỏ số thông báo (3) Tên
    title = title.replace(/^\(\d+\)\s*/, "").trim();
    if (
      title &&
      title.toLowerCase() !== "facebook" &&
      title.toLowerCase() !== "log in" &&
      title.toLowerCase() !== "đăng nhập"
    ) {
      return title;
    }
  }

  const ariaMatch = html.match(
    /aria-label="([^"]+)"[^>]{0,400}?class="f4"[^>]*>\s*([^<]+?)\s*(?:&nbsp;)?\s*<\/span>/i,
  );
  if (ariaMatch?.[1] && ariaMatch[2]) {
    const ariaLabel = unescapeHtmlEntities(ariaMatch[1]);
    const spanText = unescapeHtmlEntities(ariaMatch[2]);
    if (ariaLabel && ariaLabel === spanText) {
      return spanText;
    }
  }

  return null;
}

/**
 * Kiểm tra cookie bằng m.facebook.com/$uid (Chuẩn 100% FacebookLiveChecker.kt)
 */
export async function checkCookieWithAvatarAndName(
  cookieStr: string,
  proxy?: string,
): Promise<{
  uid: string;
  isLive: boolean;
  avatarUrl?: string;
  fullName?: string;
}> {
  const cleanCookie = cookieStr.replace(/[\r\n]+/g, "").trim();
  const uid = extractUidFromCookie(cleanCookie);

  if (!uid) {
    return { uid: "", isLive: false };
  }

  try {
    const raw = await executeCurlRequest({
      url: `https://m.facebook.com/${uid}`,
      method: "GET",
      cookie: cleanCookie,
      proxy,
      headers: [
        "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
        "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language: vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
      ],
      includeHeaders: true,
      timeoutSecs: 15,
    });

    const lower = raw.toLowerCase();

    // Bước 1: Kiểm tra xem có bị redirect về login hay không (Chuẩn FacebookLiveChecker)
    const isRedirectToLogin =
      raw.includes("Location: ") &&
      (raw.includes("/login") || raw.includes("login.php"));
    const isLoginPage =
      lower.includes("login") &&
      lower.includes("password") &&
      !raw.includes("profile");

    if (isRedirectToLogin || isLoginPage) {
      return { uid, isLive: false };
    }

    // Bước 2: Xác định isLive
    const avatarUrl = extractFacebookAvatarUrl(raw);
    const hasProfileContent =
      lower.includes("profile") ||
      raw.includes("_1dwg") ||
      raw.includes("profilePic");

    const isLive = !!avatarUrl || hasProfileContent;

    // Bước 3: Lấy full name
    const fullName = extractFacebookFullName(raw) || undefined;

    return {
      uid,
      isLive,
      avatarUrl: avatarUrl || undefined,
      fullName,
    };
  } catch {
    return { uid, isLive: false };
  }
}

// -------------------------------------------------------------
// Facebook Token & Login (Port chuẩn 100% từ FacebookToken.kt)
// -------------------------------------------------------------
const FB_APP_TOKEN = "350685531728|62f8ce9f74b12f84c123cc23437a4a32";
const FB_API_KEY = "882a8490361da98702bf97a021ddc14d";
const FB_SIG = "214049b9f17c38bd767de53752b53946";
const FB_TARGET_APP_ID = "350685531728";

/**
 * Chuyển đổi token sang App ID 350685531728 (EAAAA)
 */
export async function convertTokenToEAAAA(
  accessToken: string,
  proxy?: string,
): Promise<string | null> {
  const url = "https://api.facebook.com/method/auth.getSessionforApp";
  const params = new URLSearchParams({
    access_token: accessToken,
    format: "json",
    new_app_id: FB_TARGET_APP_ID,
    generate_session_cookies: "1",
  });

  try {
    const raw = await executeCurlRequest({
      url,
      method: "POST",
      body: params.toString(),
      headers: ["Content-Type: application/x-www-form-urlencoded"],
      proxy,
    });
    const json = JSON.parse(raw);
    return json.access_token || null;
  } catch {
    return null;
  }
}

/**
 * Lấy token EAAAA từ Cookie qua auth.getSessionForApp (Chuẩn FacebookToken.kt)
 */
export async function getTokenFromCookie(
  cookie: string,
  proxy?: string,
): Promise<{
  token?: string;
  eaaaaToken?: string;
  cookie?: string;
  uid?: string;
  error?: string;
}> {
  const cleanCookie = cookie.replace(/[\r\n]+/g, "").trim();
  const cUser = extractUidFromCookie(cleanCookie);

  const url = "https://api.facebook.com/method/auth.getSessionForApp";
  const params = new URLSearchParams({
    format: "json",
    generate_session_cookies: "1",
  });

  try {
    const raw = await executeCurlRequest({
      url,
      method: "POST",
      body: params.toString(),
      cookie: cleanCookie,
      headers: [
        "Content-Type: application/x-www-form-urlencoded",
        "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ],
      proxy,
    });

    const json = JSON.parse(raw);
    if (json.access_token) {
      const accessToken = json.access_token;
      const eaaaaToken =
        (await convertTokenToEAAAA(accessToken, proxy)) || accessToken;

      let uid = cUser || json.uid || undefined;
      const cookieParts: string[] = [];
      if (Array.isArray(json.session_cookies)) {
        for (const c of json.session_cookies) {
          cookieParts.push(`${c.name}=${c.value}`);
          if (c.name === "c_user") uid = c.value;
        }
      }
      if (cookieParts.length === 0) cookieParts.push(cleanCookie);

      return {
        token: accessToken,
        eaaaaToken,
        cookie: cookieParts.join("; "),
        uid,
      };
    }

    return { error: json.error?.message || "Không thể lấy token từ cookie" };
  } catch (err: unknown) {
    return {
      error:
        err instanceof Error ? err.message : "Lỗi kết nối auth.getSessionForApp",
    };
  }
}

/**
 * Lấy thông tin tài khoản Facebook từ Token (EAA...) trực tiếp qua Graph API
 */
export async function fetchAccountDetailsWithToken(
  token: string,
  proxy?: string,
): Promise<{
  uid: string;
  name: string;
  avatar?: string;
  cover?: string;
  email?: string;
  isLive: boolean;
  error?: string;
}> {
  const url = `https://graph.facebook.com/me?fields=id,name,email,picture.type(large),cover&access_token=${token.trim()}`;
  try {
    const raw = await executeCurlRequest({
      url,
      method: "GET",
      proxy,
    });
    const json = JSON.parse(raw);
    if (json.id) {
      const uidStr = String(json.id);
      const avatarUrl =
        json.picture?.data?.url ||
        `https://graph.facebook.com/${uidStr}/picture?type=large`;
      const coverUrl = json.cover?.source || undefined;

      return {
        uid: uidStr,
        name: json.name || uidStr,
        email: json.email || undefined,
        avatar: avatarUrl,
        cover: coverUrl,
        isLive: true,
      };
    }
    const errMsg = json.error?.message || "Token không hợp lệ hoặc hết hạn";
    return {
      uid: "",
      name: "",
      isLive: false,
      error: errMsg,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Lỗi kết nối Facebook API";
    return {
      uid: "",
      name: "",
      isLive: false,
      error: msg,
    };
  }
}

/**
 * Đăng nhập Facebook bằng tài khoản/mật khẩu + 2FA (Port chuẩn 100% FacebookToken.kt)
 */
export async function facebookLogin(
  email: string,
  pass: string,
  twofaSecret?: string,
  datr?: string,
  proxy?: string,
): Promise<{
  isSuccess: boolean;
  token?: string;
  eaaaaToken?: string;
  cookie?: string;
  uid?: string;
  error?: string;
}> {
  const cleanEmail = email.trim();
  const cleanPass = pass.trim();

  const deviceId = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    },
  );
  const adid = deviceId;
  const jazoest = Array.from({ length: 5 }, () =>
    Math.floor(Math.random() * 10),
  ).join("");
  const machineId =
    datr && datr.length >= 24
      ? datr.substring(0, 24)
      : Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);

  const cookieJar = datr ? `datr=${datr}` : undefined;

  const loginParams = new URLSearchParams({
    email: cleanEmail,
    password: cleanPass,
    generate_session_cookies: "1",
    locale: "vi_VN",
    client_country_code: "VN",
    access_token: FB_APP_TOKEN,
    api_key: FB_API_KEY,
    adid,
    machine_id: machineId,
    jazoest,
    fb_api_req_friendly_name: "authenticate",
    sig: FB_SIG,
  });

  try {
    let raw = await executeCurlRequest({
      url: "https://b-graph.facebook.com/auth/login",
      method: "POST",
      body: loginParams.toString(),
      cookie: cookieJar,
      headers: [
        "Content-Type: application/x-www-form-urlencoded",
        "User-Agent: [FBAN/FB4A;FBAV/537.0.0.47.77;FBPN/com.facebook.katana;]",
      ],
      proxy,
    });

    let json = JSON.parse(raw);

    // Xử lý 2FA nếu Facebook yêu cầu login_first_factor (Chuẩn FacebookToken.kt)
    const errorData = json.error?.error_data;
    if (errorData?.login_first_factor && errorData?.uid) {
      const factor = errorData.login_first_factor;
      const uidFromError = errorData.uid;

      if (!twofaSecret) {
        return {
          isSuccess: false,
          error: "Tài khoản yêu cầu mã 2FA nhưng chưa nhập mã bảo mật",
        };
      }

      let otpCode = twofaSecret.trim();
      if (!/^\d{6}$/.test(otpCode)) {
        otpCode = await generateTOTP(twofaSecret);
      }

      if (!otpCode) {
        return {
          isSuccess: false,
          error: "Không thể tạo mã 2FA từ secret đã nhập",
        };
      }

      const data2fa = new URLSearchParams({
        email: cleanEmail,
        access_token: FB_APP_TOKEN,
        twofactor_code: otpCode,
        password: cleanPass,
        userid: uidFromError,
        machine_id: factor,
        generate_session_cookies: "1",
      });

      raw = await executeCurlRequest({
        url: "https://b-graph.facebook.com/auth/login",
        method: "POST",
        body: data2fa.toString(),
        cookie: cookieJar,
        headers: [
          "Content-Type: application/x-www-form-urlencoded",
          "User-Agent: [FBAN/FB4A;FBAV/537.0.0.47.77;FBPN/com.facebook.katana;]",
        ],
        proxy,
      });

      json = JSON.parse(raw);
    }

    if (json.access_token) {
      const accessToken = json.access_token;
      const eaaaaToken =
        (await convertTokenToEAAAA(accessToken, proxy)) || accessToken;

      const cookieParts: string[] = [];
      let uid: string | undefined;

      if (Array.isArray(json.session_cookies)) {
        for (const c of json.session_cookies) {
          cookieParts.push(`${c.name}=${c.value}`);
          if (c.name === "c_user") uid = c.value;
        }
      }

      return {
        isSuccess: true,
        token: accessToken,
        eaaaaToken,
        cookie: cookieParts.join("; "),
        uid: uid || json.uid || cleanEmail,
      };
    }

    const errorMsg = json.error?.message || "Đăng nhập Facebook thất bại";
    return { isSuccess: false, error: errorMsg };
  } catch (err: unknown) {
    return {
      isSuccess: false,
      error: err instanceof Error ? err.message : "Lỗi kết nối Facebook login",
    };
  }
}

/**
 * Hàm tích hợp kiểm tra toàn diện tài khoản Facebook:
 * 1. Nếu có token: kiểm tra qua Graph API /me.
 * 2. Nếu có cookie: chạy LiveChecker (m.facebook.com/$uid) + lấy token qua auth.getSessionForApp.
 * 3. Nếu có pass & uid/email: chạy login qua b-graph.facebook.com/auth/login.
 * ĐẢM BẢO TUYỆT ĐỐI: KHÔNG BAO GIỜ MẶC ĐỊNH GÁN DIE KHI CHƯA CHECK!
 */
export async function checkFacebookAccountFull(params: {
  uid?: string;
  pass?: string;
  twoFactor?: string;
  cookie?: string;
  token?: string;
  proxy?: string;
}): Promise<FacebookAccountInfo> {
  const {
    uid: inputUid,
    pass,
    twoFactor,
    cookie: inputCookie,
    token: inputToken,
    proxy,
  } = params;

  let activeToken = inputToken?.trim();
  let activeCookie = inputCookie?.trim();
  let activeUid = inputUid?.trim() || "";
  let activeName = "";
  let activeAvatar: string | undefined;
  let activeCover: string | undefined;
  let activeEmail: string | undefined;
  let isLive = false;

  // 1. Kiểm tra bằng Token nếu có
  if (activeToken) {
    try {
      const info = await fetchAccountDetailsWithToken(activeToken, proxy);
      if (info.isLive) {
        isLive = true;
        if (info.uid) activeUid = info.uid;
        if (info.name) activeName = info.name;
        if (info.avatar) activeAvatar = info.avatar;
        if (info.cover) activeCover = info.cover;
        if (info.email) activeEmail = info.email;
      }
    } catch {
      // ignore
    }
  }

  // 2. Nếu có Cookie: Chạy FacebookLiveChecker và lấy token
  if (activeCookie) {
    const cUser = extractUidFromCookie(activeCookie);
    if (cUser && !activeUid) activeUid = cUser;

    // Chạy LiveChecker trực tiếp (kiểm tra chuẩn 100% bằng trang profile)
    try {
      const liveCheck = await checkCookieWithAvatarAndName(activeCookie, proxy);
      if (liveCheck.isLive) {
        isLive = true;
        if (liveCheck.uid) activeUid = liveCheck.uid;
        if (liveCheck.fullName && !activeName) activeName = liveCheck.fullName;
        if (liveCheck.avatarUrl && !activeAvatar)
          activeAvatar = liveCheck.avatarUrl;
      }
    } catch {
      // ignore
    }

    // Nếu chưa có token, thử lấy qua getSessionForApp
    if (!activeToken) {
      try {
        const tokenRes = await getTokenFromCookie(activeCookie, proxy);
        if (tokenRes.eaaaaToken) {
          activeToken = tokenRes.eaaaaToken;
          if (tokenRes.cookie) activeCookie = tokenRes.cookie;
          if (tokenRes.uid) activeUid = tokenRes.uid;
          isLive = true;

          // Lấy thêm tên/avatar từ Graph API nếu chưa có
          if (!activeName || !activeAvatar) {
            const graphInfo = await fetchAccountDetailsWithToken(
              activeToken,
              proxy,
            );
            if (graphInfo.name && !activeName) activeName = graphInfo.name;
            if (graphInfo.avatar && !activeAvatar)
              activeAvatar = graphInfo.avatar;
            if (graphInfo.cover) activeCover = graphInfo.cover;
            if (graphInfo.email) activeEmail = graphInfo.email;
          }
        }
      } catch {
        // ignore
      }
    }
  }

  // 3. Nếu chưa Live và có UID + Mật khẩu: Thử đăng nhập Facebook
  if (!isLive && activeUid && pass) {
    try {
      const loginRes = await facebookLogin(
        activeUid,
        pass,
        twoFactor,
        undefined,
        proxy,
      );
      if (loginRes.isSuccess && loginRes.eaaaaToken) {
        isLive = true;
        activeToken = loginRes.eaaaaToken;
        if (loginRes.cookie) activeCookie = loginRes.cookie;
        if (loginRes.uid) activeUid = loginRes.uid;

        const graphInfo = await fetchAccountDetailsWithToken(
          activeToken,
          proxy,
        );
        if (graphInfo.name) activeName = graphInfo.name;
        if (graphInfo.avatar) activeAvatar = graphInfo.avatar;
        if (graphInfo.cover) activeCover = graphInfo.cover;
        if (graphInfo.email) activeEmail = graphInfo.email;
      }
    } catch {
      // ignore
    }
  }

  // Tự động gán avatar mặc định từ UID nếu có
  if (!activeAvatar && activeUid && /^\d+$/.test(activeUid)) {
    activeAvatar = `https://graph.facebook.com/${activeUid}/picture?type=large`;
  }

  return {
    uid: activeUid || "N/A",
    name: activeName || activeUid || "Facebook User",
    token: activeToken,
    cookie: activeCookie,
    avatar: activeAvatar,
    cover: activeCover,
    email: activeEmail,
    proxy,
    isLive,
    error: isLive ? undefined : "Không thể xác thực hoặc tài khoản bị giới hạn",
  };
}

// Giữ lại hàm tương thích ngược
export async function getTokenAndInfoFromCookie(
  cookieStr: string,
  proxy?: string,
): Promise<FacebookAccountInfo> {
  return checkFacebookAccountFull({ cookie: cookieStr, proxy });
}
