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
}): Promise<string> {
  try {
    return await invoke<string>("curl_request", {
      url: options.url,
      method: options.method ?? "GET",
      headers: options.headers ?? null,
      body: options.body ?? null,
      cookie: options.cookie ?? null,
      proxy: options.proxy ?? null,
      includeHeaders: options.includeHeaders ?? false,
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

/**
 * Kiểm tra xem UID tài khoản Facebook có đang LIVE hay DIE/Checkpoint (chuẩn 100%)
 * Gọi https://graph.facebook.com/${uid}/picture?type=normal
 * Live trả về 302 Found hoặc Location CDN ảnh fbcdn
 * Die trả về 400 Bad Request hoặc "Unsupported get request / does not exist"
 */
export async function checkUidLive(
  uid: string,
  proxy?: string,
): Promise<{ isLive: boolean; avatarUrl?: string }> {
  const cleanUid = uid.trim();
  if (!cleanUid || !/^\d+$/.test(cleanUid)) {
    return { isLive: false };
  }
  const url = `https://graph.facebook.com/${cleanUid}/picture?type=normal`;
  try {
    const raw = await executeCurlRequest({
      url,
      method: "GET",
      proxy,
      includeHeaders: true,
    });
    if (
      raw.includes("302 Found") ||
      raw.includes("Location: http") ||
      raw.includes("image/jpeg") ||
      raw.includes("image/png")
    ) {
      return {
        isLive: true,
        avatarUrl: `https://graph.facebook.com/${cleanUid}/picture?type=large`,
      };
    }
    if (
      raw.includes('"error"') &&
      (raw.includes("Unsupported get request") ||
        raw.includes("does not exist"))
    ) {
      return { isLive: false };
    }
    return { isLive: false };
  } catch {
    return { isLive: false };
  }
}

/**
 * Kiểm tra Cookie Facebook xem còn sống (Live) hay hết hạn/Checkpoint
 */
export async function checkCookieLive(
  cookieStr: string,
  proxy?: string,
): Promise<{ isLive: boolean; uid?: string; name?: string }> {
  const cleanCookie = cookieStr.replace(/[\r\n]+/g, "").trim();
  const cUserMatch = cleanCookie.match(/c_user=([^;]+)/);
  const uid = cUserMatch ? cUserMatch[1].trim() : undefined;

  try {
    const raw = await executeCurlRequest({
      url: "https://mbasic.facebook.com/",
      method: "GET",
      cookie: cleanCookie,
      headers: [
        "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ],
      proxy,
      includeHeaders: true,
    });

    if (
      raw.includes("/login.php") ||
      raw.includes("checkpoint") ||
      raw.includes('name="login"')
    ) {
      return { isLive: false, uid };
    }

    if (
      raw.includes("fb_dtsg") ||
      raw.includes("/logout.php") ||
      raw.includes("c_user")
    ) {
      let name: string | undefined;
      const titleMatch = raw.match(/<title>([^<]+)<\/title>/);
      if (
        titleMatch &&
        !titleMatch[1].includes("Facebook") &&
        !titleMatch[1].includes("Log in")
      ) {
        name = titleMatch[1].trim();
      }
      return { isLive: true, uid, name };
    }

    return { isLive: false, uid };
  } catch {
    return { isLive: false, uid };
  }
}

/**
 * Tạo mã 2FA TOTP 6 số từ secret key (RFC 6238)
 */
export async function generateTOTP(secret: string): Promise<string> {
  const cleanSecret = secret.toUpperCase().replace(/[\s=]/g, "");
  const base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let val = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleanSecret.length; i++) {
    const c = cleanSecret.charAt(i);
    const index = base32chars.indexOf(c);
    if (index === -1) continue;
    val = (val << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((val >> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  const epoch = Math.floor(Date.now() / 1000);
  const time = Math.floor(epoch / 30);
  const timeBuffer = new ArrayBuffer(8);
  const timeView = new DataView(timeBuffer);
  timeView.setUint32(4, time, false);

  const key = await crypto.subtle.importKey(
    "raw",
    new Uint8Array(bytes),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, timeBuffer);
  const hash = new Uint8Array(signature);
  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, "0");
}

/**
 * Lấy Public Key từ Facebook pwd_key_fetch để mã hóa mật khẩu
 */
async function fetchPasswordPublicKey(proxy?: string): Promise<{
  publicKeyPem: string;
  keyId: number;
} | null> {
  const url =
    "https://b-graph.facebook.com/pwd_key_fetch?version=2&flow=CONTROLLER_INITIALIZATION&method=GET&fb_api_req_friendly_name=pwdKeyFetch&fb_api_caller_class=com.facebook.auth.login.AuthOperations&access_token=438142079694454%7Cfc0a7caa49b192f64f6f5a6d9643bb28";
  try {
    const raw = await executeCurlRequest({ url, method: "GET", proxy });
    const json = JSON.parse(raw);
    if (json.public_key && typeof json.public_key === "string") {
      return {
        publicKeyPem: json.public_key,
        keyId: json.key_id ? Number(json.key_id) : 25,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function parseRsaPublicKey(pem: string): { n: bigint; e: bigint } | null {
  try {
    const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    let idx = 0;
    while (idx < bytes.length - 4) {
      if (bytes[idx] === 0x02) {
        let len = bytes[idx + 1];
        let offset = idx + 2;
        if (len === 0x81) {
          len = bytes[idx + 2];
          offset = idx + 3;
        } else if (len === 0x82) {
          len = (bytes[idx + 2] << 8) | bytes[idx + 3];
          offset = idx + 4;
        }

        if (len >= 256 && len <= 257) {
          let nHex = "";
          for (let j = 0; j < len; j++) {
            nHex += bytes[offset + j].toString(16).padStart(2, "0");
          }
          const n = BigInt(`0x${nHex}`);

          const eIdx = offset + len;
          if (bytes[eIdx] === 0x02) {
            const eLen = bytes[eIdx + 1];
            let eHex = "";
            for (let j = 0; j < eLen; j++) {
              eHex += bytes[eIdx + 2 + j].toString(16).padStart(2, "0");
            }
            const e = BigInt(`0x${eHex}`);
            return { n, e };
          }
        }
      }
      idx++;
    }
    return null;
  } catch {
    return null;
  }
}

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let res = 1n;
  let b = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e % 2n === 1n) res = (res * b) % mod;
    b = (b * b) % mod;
    e = e / 2n;
  }
  return res;
}

function rsaEncryptPkcs1(data: Uint8Array, n: bigint, e: bigint): Uint8Array {
  const k = 256;
  const mLen = data.length;
  const psLen = k - mLen - 3;
  const em = new Uint8Array(k);
  em[0] = 0x00;
  em[1] = 0x02;

  const ps = new Uint8Array(psLen);
  crypto.getRandomValues(ps);
  for (let i = 0; i < psLen; i++) {
    if (ps[i] === 0) ps[i] = 1;
    em[2 + i] = ps[i];
  }

  em[2 + psLen] = 0x00;
  em.set(data, 3 + psLen);

  let emHex = "";
  for (let i = 0; i < k; i++) {
    emHex += em[i].toString(16).padStart(2, "0");
  }
  const m = BigInt(`0x${emHex}`);
  const c = modPow(m, e, n);

  let cHex = c.toString(16);
  if (cHex.length % 2 !== 0) cHex = `0${cHex}`;
  cHex = cHex.padStart(k * 2, "0");

  const out = new Uint8Array(k);
  for (let i = 0; i < k; i++) {
    out[i] = Number.parseInt(cHex.substring(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * Mã hóa mật khẩu Facebook theo thuật toán AES-256-GCM + RSA PKCS#1 v1.5 (chuẩn app Android)
 */
export async function encryptPassword(
  password: string,
  proxy?: string,
): Promise<string | null> {
  try {
    const keyInfo = await fetchPasswordPublicKey(proxy);
    if (!keyInfo) return null;

    const rsaKeys = parseRsaPublicKey(keyInfo.publicKeyPem);
    if (!rsaKeys) return null;

    const aesKeyBytes = new Uint8Array(32);
    const iv = new Uint8Array(12);
    crypto.getRandomValues(aesKeyBytes);
    crypto.getRandomValues(iv);

    const encryptedAesKey = rsaEncryptPkcs1(aesKeyBytes, rsaKeys.n, rsaKeys.e);

    const currentTime = Math.floor(Date.now() / 1000).toString();
    const aad = new TextEncoder().encode(currentTime);

    const aesKey = await crypto.subtle.importKey(
      "raw",
      aesKeyBytes,
      { name: "AES-GCM" },
      false,
      ["encrypt"],
    );

    const encryptedData = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: aad,
        tagLength: 128,
      },
      aesKey,
      new TextEncoder().encode(password),
    );

    const encBytes = new Uint8Array(encryptedData);
    const tag = encBytes.slice(encBytes.length - 16);
    const encryptedPass = encBytes.slice(0, encBytes.length - 16);

    const totalLen =
      1 + 1 + 12 + 2 + encryptedAesKey.length + 16 + encryptedPass.length;
    const buf = new Uint8Array(totalLen);
    let offset = 0;

    buf[offset++] = 1;
    buf[offset++] = keyInfo.keyId;
    buf.set(iv, offset);
    offset += 12;

    buf[offset++] = encryptedAesKey.length & 0xff;
    buf[offset++] = (encryptedAesKey.length >> 8) & 0xff;

    buf.set(encryptedAesKey, offset);
    offset += encryptedAesKey.length;

    buf.set(tag, offset);
    offset += 16;

    buf.set(encryptedPass, offset);

    let binary = "";
    for (let i = 0; i < buf.length; i++) {
      binary += String.fromCharCode(buf[i]);
    }
    return btoa(binary);
  } catch {
    return null;
  }
}

/**
 * Đăng nhập Facebook bằng UID, Mật khẩu, 2FA, Cookie qua Facebook Android API (b-graph)
 */
export async function facebookLogin(params: {
  email: string;
  password?: string;
  auth2fa?: string;
  cookie?: string;
  proxy?: string;
}): Promise<{
  success: boolean;
  token?: string;
  cookie?: string;
  uid?: string;
  error?: string;
}> {
  if (!params.email || !params.password) {
    return { success: false, error: "Thiếu tài khoản hoặc mật khẩu" };
  }

  const appToken = "350685531728|62f8ce9f74b12f84c123cc23437a4a32";
  const apiKey = "882a8490361da98702bf97a021ddc14d";
  const sig = "214049b9f17c38bd767de53752b53946";
  const url = "https://b-graph.facebook.com/auth/login";

  const deviceId = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    },
  );

  // Trích xuất datr từ cookie nếu có
  const datrMatch = params.cookie?.match(/datr=([^;]+)/);
  const datr = datrMatch ? datrMatch[1].trim() : undefined;
  const cookieHeader = datr ? `datr=${datr}` : params.cookie;

  // Thử mật khẩu đã mã hóa trước, sau đó thử mật khẩu thuần
  const encPass = await encryptPassword(params.password, params.proxy);
  const passwordsToTry = encPass
    ? [encPass, params.password]
    : [params.password];

  let lastError = "Đăng nhập thất bại";

  for (const pwd of passwordsToTry) {
    const bodyParams = new URLSearchParams({
      email: params.email.trim(),
      password: pwd.trim(),
      generate_session_cookies: "1",
      locale: "vi_VN",
      client_country_code: "VN",
      access_token: appToken,
      api_key: apiKey,
      adid: deviceId,
      machine_id: datr && datr.length >= 24 ? datr.substring(0, 24) : deviceId.substring(0, 24),
      jazoest: "22864",
      fb_api_req_friendly_name: "authenticate",
      sig,
    });

    try {
      const raw = await executeCurlRequest({
        url,
        method: "POST",
        body: bodyParams.toString(),
        cookie: cookieHeader,
        headers: ["Content-Type: application/x-www-form-urlencoded"],
        proxy: params.proxy,
      });

      let json: Record<string, unknown>;
      try {
        json = JSON.parse(raw);
      } catch {
        continue;
      }

      // Nếu yêu cầu 2FA
      if (
        json.error &&
        typeof json.error === "object" &&
        (json.error as Record<string, unknown>).error_data
      ) {
        const errorData = (json.error as Record<string, unknown>)
          .error_data as Record<string, string>;
        const factorUid = errorData.uid;
        const factor = errorData.login_first_factor;

        if (!params.auth2fa) {
          return {
            success: false,
            error: "Yêu cầu mã 2FA nhưng chưa cung cấp secret 2FA",
          };
        }

        let twoFactorCode = "";
        try {
          twoFactorCode = await generateTOTP(params.auth2fa);
        } catch (e) {
          return {
            success: false,
            error: `Lỗi tạo mã 2FA: ${e instanceof Error ? e.message : String(e)}`,
          };
        }

        const body2fa = new URLSearchParams({
          email: params.email.trim(),
          access_token: appToken,
          twofactor_code: twoFactorCode,
          password: pwd.trim(),
          userid: factorUid || params.email.trim(),
          machine_id: factor || deviceId.substring(0, 24),
          generate_session_cookies: "1",
        });

        const raw2fa = await executeCurlRequest({
          url,
          method: "POST",
          body: body2fa.toString(),
          cookie: cookieHeader,
          headers: ["Content-Type: application/x-www-form-urlencoded"],
          proxy: params.proxy,
        });

        try {
          json = JSON.parse(raw2fa);
        } catch {
          continue;
        }
      }

      if (json.access_token && typeof json.access_token === "string") {
        const accessToken = json.access_token;
        const eaaaaToken =
          (await convertTokenToEAAAA(accessToken, params.proxy)) || accessToken;

        let cookieStr = params.cookie || "";
        let foundUid = params.email.trim();
        if (Array.isArray(json.session_cookies)) {
          const parts: string[] = [];
          for (const c of json.session_cookies) {
            if (c && typeof c === "object" && "name" in c && "value" in c) {
              parts.push(`${c.name}=${c.value}`);
              if (c.name === "c_user") {
                foundUid = String(c.value);
              }
            }
          }
          if (parts.length > 0) {
            cookieStr = parts.join("; ");
          }
        }

        return {
          success: true,
          token: eaaaaToken,
          cookie: cookieStr,
          uid: foundUid,
        };
      }

      const errMsg =
        (json.error && typeof json.error === "object" && "message" in json.error
          ? String((json.error as Record<string, unknown>).message)
          : undefined) || "Đăng nhập thất bại";
      lastError = errMsg;
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Lỗi kết nối Facebook";
    }
  }

  return { success: false, error: lastError };
}

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
    new_app_id: "350685531728",
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
 * Lấy thông tin tài khoản Facebook từ Token (EAA...)
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
 * Lấy token EAAAA và thông tin tên/UID từ Cookie qua getSessionForApp
 */
export async function getTokenAndInfoFromCookie(
  cookieStr: string,
  proxy?: string,
): Promise<FacebookAccountInfo> {
  const cleanCookie = cookieStr.replace(/[\r\n]+/g, "").trim();

  // Tìm c_user từ cookie
  const cUserMatch = cleanCookie.match(/c_user=([^;]+)/);
  const uidFromCookie = cUserMatch ? cUserMatch[1].trim() : "";

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
      const rawToken = json.access_token;
      const eaaaa = (await convertTokenToEAAAA(rawToken, proxy)) || rawToken;
      let realUid = uidFromCookie || json.uid || "";

      // Tạo cookie hoàn chỉnh từ session_cookies nếu có
      let finalCookie = cleanCookie;
      if (Array.isArray(json.session_cookies)) {
        const parts = json.session_cookies.map(
          (c: { name: string; value: string }) => `${c.name}=${c.value}`,
        );
        if (parts.length > 0) {
          finalCookie = parts.join("; ");
        }
      }

      // Lấy tên thật và avatar bằng Graph API với token EAAAA
      let name = realUid || "Facebook User";
      let avatar = realUid
        ? `https://graph.facebook.com/${realUid}/picture?type=large`
        : undefined;
      let cover: string | undefined;
      let email: string | undefined;

      try {
        const info = await fetchAccountDetailsWithToken(eaaaa, proxy);
        if (info.name) name = info.name;
        if (info.avatar) avatar = info.avatar;
        if (info.cover) cover = info.cover;
        if (info.email) email = info.email;
        if (info.uid && !realUid) {
          realUid = info.uid;
        }
      } catch {
        // bỏ qua nếu lỗi gọi Graph API
      }

      return {
        uid: realUid || "N/A",
        name,
        token: eaaaa,
        cookie: finalCookie,
        avatar:
          avatar ||
          (realUid
            ? `https://graph.facebook.com/${realUid}/picture?type=large`
            : undefined),
        cover,
        email,
        isLive: true,
      };
    }

    const errorMsg = json.error?.message || "Không thể lấy token từ cookie";
    return {
      uid: uidFromCookie || "N/A",
      name: uidFromCookie || "N/A",
      cookie: cleanCookie,
      isLive: false,
      error: errorMsg,
    };
  } catch (err: unknown) {
    return {
      uid: uidFromCookie || "N/A",
      name: uidFromCookie || "N/A",
      cookie: cleanCookie,
      isLive: false,
      error: err instanceof Error ? err.message : "Lỗi xác thực cookie",
    };
  }
}
