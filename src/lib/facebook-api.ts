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
// TOTP 2FA Generator (RFC 6238)
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

  const counterBytes = new Uint8Array(8);
  let temp = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = temp & 0xff;
    temp = Math.floor(temp / 256);
  }

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes as unknown as BufferSource,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    counterBytes as unknown as BufferSource,
  );
  const hmac = new Uint8Array(sig);

  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (code % 1000000).toString().padStart(6, "0");
}

export function extractUidFromCookie(cookie: string): string | null {
  if (!cookie) return null;
  const match = cookie.match(/c_user=([^;]+)/);
  return match ? match[1].trim() : null;
}

// -------------------------------------------------------------
// Facebook Graph API & Token API (Chuẩn 100% từ FacebookLoginBottomSheet.kt)
// -------------------------------------------------------------
const FB_APP_TOKEN = "350685531728|62f8ce9f74b12f84c123cc23437a4a32";
const FB_API_KEY = "882a8490361da98702bf97a021ddc14d";
const FB_SIG = "214049b9f17c38bd767de53752b53946";
const FB_TARGET_APP_ID = "350685531728";

/**
 * 1. LẤY PROFILE QUA GRAPH API TỪ TOKEN EAAAA
 * URL: https://graph.facebook.com/me?access_token=$token
 * Lấy id, name, email, avatar (https://graph.facebook.com/$id/picture?type=large)
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
  const cleanToken = token.trim();
  const url = `https://graph.facebook.com/me?fields=id,name,email&access_token=${cleanToken}`;

  try {
    const raw = await executeCurlRequest({
      url,
      method: "GET",
      proxy,
      timeoutSecs: 15,
    });

    const json = JSON.parse(raw);
    if (json.id) {
      const uidStr = String(json.id);
      const avatarUrl = `https://graph.facebook.com/${uidStr}/picture?type=large`;

      return {
        uid: uidStr,
        name: json.name || uidStr,
        email: json.email || undefined,
        avatar: avatarUrl,
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
 * 2. CHUYỂN ĐỔI TOKEN SANG EAAAA (App ID 350685531728)
 * URL: https://api.facebook.com/method/auth.getSessionforApp
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
      timeoutSecs: 15,
    });
    const json = JSON.parse(raw);
    return json.access_token || null;
  } catch {
    return null;
  }
}

/**
 * 3. LẤY TOKEN EAAAA TỪ COOKIE QUA getSessionForApp
 * URL: https://api.facebook.com/method/auth.getSessionForApp
 */
export async function getTokenFromCookie(
  cookie: string,
  proxy?: string,
): Promise<{
  token?: string;
  eaaaaToken?: string;
  cookie?: string;
  uid?: string;
  name?: string;
  avatar?: string;
  isLive: boolean;
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
        "Accept: */*",
      ],
      proxy,
      timeoutSecs: 15,
    });

    const json = JSON.parse(raw);
    if (json.access_token) {
      const rawToken = json.access_token;
      const eaaaaToken =
        (await convertTokenToEAAAA(rawToken, proxy)) || rawToken;

      let uid = cUser || json.uid || undefined;
      const cookieParts: string[] = [];
      if (Array.isArray(json.session_cookies)) {
        for (const c of json.session_cookies) {
          cookieParts.push(`${c.name}=${c.value}`);
          if (c.name === "c_user") uid = c.value;
        }
      }
      const finalCookie =
        cookieParts.length > 0 ? cookieParts.join("; ") : cleanCookie;

      // Lấy Profile bằng token EAAAA vừa lấy được qua Graph API /me
      let name = uid || "Facebook User";
      let avatarUrl = uid
        ? `https://graph.facebook.com/${uid}/picture?type=large`
        : undefined;

      try {
        const details = await fetchAccountDetailsWithToken(eaaaaToken, proxy);
        if (details.isLive) {
          if (details.name) name = details.name;
          if (details.avatar) avatarUrl = details.avatar;
          if (details.uid) uid = details.uid;
        }
      } catch {
        // ignore
      }

      return {
        token: rawToken,
        eaaaaToken,
        cookie: finalCookie,
        uid: uid || cUser || "N/A",
        name,
        avatar: avatarUrl,
        isLive: true,
      };
    }

    return {
      isLive: false,
      uid: cUser || undefined,
      error: json.error?.message || "Không thể lấy token từ cookie",
    };
  } catch (err: unknown) {
    return {
      isLive: false,
      uid: cUser || undefined,
      error:
        err instanceof Error
          ? err.message
          : "Lỗi kết nối auth.getSessionForApp",
    };
  }
}

/**
 * 4. ĐĂNG NHẬP FACEBOOK BẰNG TÀI KHOẢN/MẬT KHẨU + 2FA
 * URL: https://b-graph.facebook.com/auth/login
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
  name?: string;
  avatar?: string;
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
      timeoutSecs: 20,
    });

    let json = JSON.parse(raw);

    // Xử lý 2FA nếu Meta yêu cầu mã xác minh
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
          error: "Không thể tạo mã 2FA từ secret",
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
        timeoutSecs: 20,
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

      const finalUid = uid || json.uid || cleanEmail;
      let name = finalUid;
      let avatar = `https://graph.facebook.com/${finalUid}/picture?type=large`;

      try {
        const details = await fetchAccountDetailsWithToken(eaaaaToken, proxy);
        if (details.isLive) {
          if (details.name) name = details.name;
          if (details.avatar) avatar = details.avatar;
          if (details.uid) uid = details.uid;
        }
      } catch {
        // ignore
      }

      return {
        isSuccess: true,
        token: accessToken,
        eaaaaToken,
        cookie: cookieParts.join("; "),
        uid: finalUid,
        name,
        avatar,
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
 * 5. KIỂM TRA TÀI KHOẢN THEO CHUẨN 100% FacebookLoginBottomSheet.kt:
 * 1. Ưu tiên: Nếu dòng bắt đầu bằng EAA hoặc có Token -> gọi fetchAccountDetailsWithToken
 * 2. Nếu có UID|PASS -> gọi facebookLogin lấy Token EAAAA rồi fetchAccountDetailsWithToken
 * 3. Nếu có Cookie -> gọi getTokenFromCookie (auth.getSessionForApp) lấy Token EAAAA rồi fetchAccountDetailsWithToken
 * 4. Fallback: Nếu không lấy được Token từ Cookie nhưng có c_user, vẫn giữ lại UID và ảnh đại diện Graph
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

  // 1. Ưu tiên kiểm tra Token trực tiếp (bắt đầu bằng EAA hoặc đã có Token)
  if (activeToken?.startsWith("EAA")) {
    try {
      const details = await fetchAccountDetailsWithToken(activeToken, proxy);
      if (details.isLive) {
        return {
          uid: details.uid || activeUid,
          name: details.name || activeUid,
          avatar:
            details.avatar ||
            `https://graph.facebook.com/${details.uid || activeUid}/picture?type=large`,
          cover: details.cover,
          email: details.email,
          token: activeToken,
          cookie: activeCookie,
          proxy,
          isLive: true,
        };
      }
    } catch {
      // ignore
    }
  }

  // 2. Nếu có UID & Mật khẩu -> Đăng nhập lấy Token EAAAA (chuẩn FacebookToken.process)
  if (activeUid && pass) {
    try {
      const loginRes = await facebookLogin(
        activeUid,
        pass,
        twoFactor,
        undefined,
        proxy,
      );
      if (loginRes.isSuccess && loginRes.eaaaaToken) {
        activeToken = loginRes.eaaaaToken;
        if (loginRes.cookie) activeCookie = loginRes.cookie;
        if (loginRes.uid) activeUid = loginRes.uid;
        activeName = loginRes.name || activeUid;
        activeAvatar =
          loginRes.avatar ||
          `https://graph.facebook.com/${activeUid}/picture?type=large`;
        isLive = true;

        return {
          uid: activeUid,
          name: activeName,
          token: activeToken,
          cookie: activeCookie,
          avatar: activeAvatar,
          proxy,
          isLive: true,
        };
      }
    } catch {
      // ignore
    }
  }

  // 3. Nếu có Cookie -> Thử lấy Token EAAAA qua getSessionForApp
  if (activeCookie) {
    const cUser = extractUidFromCookie(activeCookie);
    if (cUser && !activeUid) activeUid = cUser;

    try {
      const cookieRes = await getTokenFromCookie(activeCookie, proxy);
      if (cookieRes.isLive && cookieRes.eaaaaToken) {
        return {
          uid: cookieRes.uid || activeUid,
          name: cookieRes.name || activeUid,
          token: cookieRes.eaaaaToken,
          cookie: cookieRes.cookie || activeCookie,
          avatar:
            cookieRes.avatar ||
            `https://graph.facebook.com/${cookieRes.uid || activeUid}/picture?type=large`,
          proxy,
          isLive: true,
        };
      }
    } catch {
      // ignore
    }
  }

  // 4. Nếu không lấy được token nhưng có UID / c_user
  const fallbackUid =
    (activeCookie ? extractUidFromCookie(activeCookie) : null) ||
    activeUid ||
    "N/A";
  const defaultAvatar =
    fallbackUid !== "N/A"
      ? `https://graph.facebook.com/${fallbackUid}/picture?type=large`
      : undefined;

  return {
    uid: fallbackUid,
    name: activeName || fallbackUid,
    token: activeToken,
    cookie: activeCookie,
    avatar: defaultAvatar,
    cover: activeCover,
    email: activeEmail,
    proxy,
    isLive,
    error: isLive ? undefined : "Không thể lấy Access Token từ tài khoản",
  };
}

export async function getTokenAndInfoFromCookie(
  cookieStr: string,
  proxy?: string,
): Promise<FacebookAccountInfo> {
  return checkFacebookAccountFull({ cookie: cookieStr, proxy });
}
