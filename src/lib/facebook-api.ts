import { invoke } from "@tauri-apps/api/core";

export interface FacebookPageItem {
  pageId: string;
  pageName: string;
  pageToken?: string;
  additionalProfileId?: string;
  avatar?: string;
  category?: string;
  isLive?: boolean;
}

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
  pages?: FacebookPageItem[];
}

export function sanitizeProxy(proxy?: string | null): string | undefined {
  if (!proxy) return undefined;
  const p = proxy.trim();
  if (
    !p ||
    p === "Chưa chọn" ||
    p === "Chua chon" ||
    p === "—" ||
    p === "-" ||
    p === "none" ||
    p === "null" ||
    !p.includes(":")
  ) {
    return undefined;
  }
  return p;
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
  formFields?: string[];
}): Promise<string> {
  const timeoutLimit = options.timeoutSecs || 15;
  const validProxy = sanitizeProxy(options.proxy);

  const isTauri =
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

  if (isTauri) {
    return await invoke<string>("curl_request", {
      url: options.url,
      method: options.method ?? "GET",
      headers: options.headers ?? null,
      body: options.body ?? null,
      cookie: options.cookie ?? null,
      proxy: validProxy ?? null,
      includeHeaders: options.includeHeaders ?? false,
      timeoutSecs: timeoutLimit,
      formFields: options.formFields ?? null,
    });
  }

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
// Facebook Password Encryption (RSA PKCS#1 + AES-256-GCM)
// Chuẩn 100% từ FacebookToken.kt & pwd_key_fetch
// -------------------------------------------------------------
function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let res = 1n;
  base = base % mod;
  while (exp > 0n) {
    if (exp % 2n === 1n) res = (res * base) % mod;
    base = (base * base) % mod;
    exp = exp / 2n;
  }
  return res;
}

function parseRsaPublicKey(pem: string): { n: bigint; e: bigint } | null {
  try {
    const b64 = pem
      .replace(/-----BEGIN [^-]+-----/g, "")
      .replace(/-----END [^-]+-----/g, "")
      .replace(/\s+/g, "");
    const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

    let idx = 0;
    while (idx < der.length && der[idx] !== 0x03) idx++;
    if (idx >= der.length) return null;

    idx++; // past 0x03
    if (der[idx] & 0x80) {
      idx += (der[idx] & 0x7f) + 1;
    } else {
      idx++;
    }
    idx++; // skip unused bits byte (0x00)

    if (der[idx] !== 0x30) return null;
    idx++;
    if (der[idx] & 0x80) {
      idx += (der[idx] & 0x7f) + 1;
    } else {
      idx++;
    }

    if (der[idx] !== 0x02) return null;
    idx++;
    let nLen = der[idx];
    if (nLen & 0x80) {
      const lenBytes = nLen & 0x7f;
      nLen = 0;
      for (let i = 0; i < lenBytes; i++) {
        nLen = (nLen << 8) | der[++idx];
      }
      idx++;
    } else {
      idx++;
    }
    const nBytes = der.slice(idx, idx + nLen);
    idx += nLen;

    if (der[idx] !== 0x02) return null;
    idx++;
    let eLen = der[idx];
    if (eLen & 0x80) {
      const lenBytes = eLen & 0x7f;
      eLen = 0;
      for (let i = 0; i < lenBytes; i++) {
        eLen = (eLen << 8) | der[++idx];
      }
      idx++;
    } else {
      idx++;
    }
    const eBytes = der.slice(idx, idx + eLen);

    let nHex = "";
    for (const b of nBytes) nHex += b.toString(16).padStart(2, "0");
    let eHex = "";
    for (const b of eBytes) eHex += b.toString(16).padStart(2, "0");

    return { n: BigInt(`0x${nHex}`), e: BigInt(`0x${eHex}`) };
  } catch {
    return null;
  }
}

function rsaPkcs1Encrypt(
  messageBytes: Uint8Array,
  n: bigint,
  e: bigint,
): Uint8Array {
  const k = 256;
  const mLen = messageBytes.length;
  const psLen = k - 3 - mLen;

  const ps = new Uint8Array(psLen);
  crypto.getRandomValues(ps);
  for (let i = 0; i < ps.length; i++) {
    if (ps[i] === 0) {
      ps[i] = Math.floor(Math.random() * 255) + 1;
    }
  }

  const em = new Uint8Array(k);
  em[0] = 0x00;
  em[1] = 0x02;
  em.set(ps, 2);
  em[2 + psLen] = 0x00;
  em.set(messageBytes, 3 + psLen);

  let emHex = "";
  for (const b of em) emHex += b.toString(16).padStart(2, "0");
  const mBig = BigInt(`0x${emHex}`);

  const cBig = modPow(mBig, e, n);
  const cHex = cBig.toString(16).padStart(k * 2, "0");

  const out = new Uint8Array(k);
  for (let i = 0; i < k; i++) {
    out[i] = Number.parseInt(cHex.substring(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export async function encryptPassword(
  password: string,
  proxy?: string,
): Promise<string | null> {
  try {
    const url =
      "https://b-graph.facebook.com/pwd_key_fetch?version=2&flow=CONTROLLER_INITIALIZATION&method=GET&fb_api_req_friendly_name=pwdKeyFetch&fb_api_caller_class=com.facebook.auth.login.AuthOperations&access_token=438142079694454|fc0a7caa49b192f64f6f5a6d9643bb28";
    const raw = await executeCurlRequest({
      url,
      method: "GET",
      proxy,
      timeoutSecs: 15,
    });
    const data = JSON.parse(raw);
    if (!data.public_key) return null;

    const keyId = data.key_id ? Number(data.key_id) : 25;
    const rsaKeys = parseRsaPublicKey(data.public_key);
    if (!rsaKeys) return null;

    const aesKey = crypto.getRandomValues(new Uint8Array(32));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encryptedAesKey = rsaPkcs1Encrypt(aesKey, rsaKeys.n, rsaKeys.e);

    const currentTime = Math.floor(Date.now() / 1000);
    const aad = String(currentTime);

    const aesCryptoKey = await crypto.subtle.importKey(
      "raw",
      aesKey,
      { name: "AES-GCM" },
      false,
      ["encrypt"],
    );

    const cipherBuf = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: new TextEncoder().encode(aad),
        tagLength: 128,
      },
      aesCryptoKey,
      new TextEncoder().encode(password),
    );

    const cipherArray = new Uint8Array(cipherBuf);
    const tag = cipherArray.slice(cipherArray.length - 16);
    const encryptedPass = cipherArray.slice(0, cipherArray.length - 16);

    const encLen = encryptedAesKey.length;
    const bufLen = 1 + 1 + 12 + 2 + encLen + 16 + encryptedPass.length;
    const buf = new Uint8Array(bufLen);
    let offset = 0;
    buf[offset++] = 1;
    buf[offset++] = keyId & 0xff;
    buf.set(iv, offset);
    offset += 12;
    buf[offset++] = encLen & 0xff;
    buf[offset++] = (encLen >> 8) & 0xff;
    buf.set(encryptedAesKey, offset);
    offset += encLen;
    buf.set(tag, offset);
    offset += 16;
    buf.set(encryptedPass, offset);

    let bin = "";
    for (let i = 0; i < buf.length; i++) {
      bin += String.fromCharCode(buf[i]);
    }
    return btoa(bin);
  } catch {
    return null;
  }
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
  pages?: FacebookPageItem[];
  isLive: boolean;
  error?: string;
}> {
  const cleanToken = token.trim();
  const url = `https://graph.facebook.com/me?fields=id,name,email,picture.type(large),cover&access_token=${cleanToken}`;

  try {
    let raw = await executeCurlRequest({
      url,
      method: "GET",
      headers: [
        "User-Agent: [FBAN/FB4A;FBAV/548.1.0.51.64;FBBV/474618929;FBDM/{density=3.0,width=1080,height=2340};FBLC/vi_VN;FBRV/0;FBCR/Viettel;FBMF/samsung;FBBD/samsung;FBPN/com.facebook.katana;FBDV/SM-S928B;FBSV/14;FBOP/1;FBCA/arm64-v8a;]",
        `Authorization: OAuth ${cleanToken}`,
      ],
      proxy,
      timeoutSecs: 15,
    });

    interface GraphMeResponse {
      id?: string | number;
      name?: string;
      email?: string;
      picture?: { data?: { url?: string; is_silhouette?: boolean } };
      cover?: { source?: string; id?: string };
      error?: { message?: string };
    }

    let json: GraphMeResponse = {};
    try {
      json = JSON.parse(raw);
    } catch {
      // Fallback nếu chuỗi trả về lỗi parse
      json = {};
    }

    // Nếu /me với fields bị lỗi, thử fallback cơ bản /me?access_token
    if (!json.id) {
      try {
        const fallbackRaw = await executeCurlRequest({
          url: `https://graph.facebook.com/me?access_token=${cleanToken}`,
          method: "GET",
          headers: [`Authorization: OAuth ${cleanToken}`],
          proxy,
          timeoutSecs: 15,
        });
        const fallbackJson = JSON.parse(fallbackRaw);
        if (fallbackJson.id) {
          json = fallbackJson;
        }
      } catch {
        // ignore
      }
    }

    if (json.id) {
      const uidStr = String(json.id);

      // Bóc tách Avatar HD thật từ picture.data.url (chuẩn FacebookMediaEngine.kt)
      let avatarUrl: string | undefined;
      const picData = json.picture?.data;
      if (picData?.url && !picData.url.includes("84628273_176159830277856")) {
        avatarUrl = picData.url;
      }
      if (!avatarUrl) {
        avatarUrl = `https://graph.facebook.com/${uidStr}/picture?type=large`;
      }

      const coverUrl: string | undefined = json.cover?.source || undefined;

      // Lấy danh sách Pages con của tài khoản (chuẩn FacebookAccountManager.kt & FacebookPageEngine.kt)
      let pages: FacebookPageItem[] = [];
      try {
        const pagesUrl = `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,category,tasks,additional_profile_id,delegate_page_id,global_brand_root_id&limit=100&access_token=${cleanToken}`;
        const pagesRaw = await executeCurlRequest({
          url: pagesUrl,
          method: "GET",
          headers: [
            "User-Agent: [FBAN/FB4A;FBAV/548.1.0.51.64;FBBV/474618929;FBDM/{density=3.0,width=1080,height=2340};FBLC/vi_VN;FBRV/0;FBCR/Viettel;FBMF/samsung;FBBD/samsung;FBPN/com.facebook.katana;FBDV/SM-S928B;FBSV/14;FBOP/1;FBCA/arm64-v8a;]",
            `Authorization: OAuth ${cleanToken}`,
          ],
          proxy,
          timeoutSecs: 15,
        });
        const pagesJson = JSON.parse(pagesRaw);
        if (Array.isArray(pagesJson.data)) {
          pages = pagesJson.data.map(
            (item: {
              id?: string | number;
              name?: string;
              access_token?: string;
              additional_profile_id?: string;
              delegate_page_id?: string;
              category?: string;
            }) => {
              const pid = String(item.id || "");
              const pname = String(item.name || "");
              const ptoken = String(item.access_token || "");
              const addId = String(item.additional_profile_id || "").trim();
              const delegate = String(item.delegate_page_id || "").trim();
              let uid615 = "";
              if (addId.startsWith("615")) uid615 = addId;
              else if (delegate.startsWith("615")) uid615 = delegate;
              else if (pid.startsWith("615")) uid615 = pid;
              else uid615 = addId || delegate || pid;

              const pAvatar = `https://graph.facebook.com/${pid}/picture?type=large`;

              return {
                pageId: pid,
                pageName: pname,
                pageToken: ptoken,
                additionalProfileId: uid615,
                avatar: pAvatar,
                category: item.category || "",
                isLive: true,
              };
            },
          );
        }
      } catch {
        // ignore
      }

      return {
        uid: uidStr,
        name: json.name || uidStr,
        email: json.email || undefined,
        avatar: avatarUrl,
        cover: coverUrl,
        pages,
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
  cover?: string;
  pages?: FacebookPageItem[];
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
        ? `https://graph.facebook.com/v21.0/me/picture?type=large&access_token=${eaaaaToken}`
        : undefined;
      let coverUrl: string | undefined;
      let pages: FacebookPageItem[] = [];

      try {
        const details = await fetchAccountDetailsWithToken(eaaaaToken, proxy);
        if (details.isLive) {
          if (details.name) name = details.name;
          if (details.avatar) avatarUrl = details.avatar;
          if (details.uid) uid = details.uid;
          if (details.cover) coverUrl = details.cover;
          if (details.pages) pages = details.pages;
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
        cover: coverUrl,
        pages,
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
  cover?: string;
  pages?: FacebookPageItem[];
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

  const encPass = await encryptPassword(cleanPass, proxy);
  const passwords: string[] = [];
  if (encPass) passwords.push(encPass);
  passwords.push(cleanPass); // fallback plaintext

  for (let i = 0; i < passwords.length; i++) {
    const pwd = passwords[i];
    const loginParams = new URLSearchParams({
      email: cleanEmail,
      password: pwd,
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

      let json: {
        access_token?: string;
        session_cookies?: Array<{ name: string; value: string }>;
        uid?: string;
        error?: {
          message?: string;
          error_data?: { login_first_factor?: string; uid?: string };
        };
      };
      try {
        json = JSON.parse(raw);
      } catch {
        continue;
      }

      // Xử lý 2FA (chuẩn FacebookToken.kt dòng 324 & PHP)
      const errorData = json.error?.error_data;
      if (errorData?.login_first_factor && errorData?.uid) {
        const factor = errorData.login_first_factor;
        const uidFromError = errorData.uid;

        if (!twofaSecret) {
          return {
            isSuccess: false,
            error: "Yêu cầu nhập mã 2FA thủ công (thiếu secret)",
          };
        }

        let otpCode = twofaSecret.trim();
        if (!/^\d{6}$/.test(otpCode)) {
          otpCode = await generateTOTP(twofaSecret);
        }

        if (!otpCode) {
          return {
            isSuccess: false,
            error: "Lỗi tạo mã 2FA từ secret",
          };
        }

        const data2fa = new URLSearchParams({
          email: cleanEmail,
          access_token: FB_APP_TOKEN,
          twofactor_code: otpCode,
          password: pwd,
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

        try {
          json = JSON.parse(raw);
        } catch {
          continue;
        }
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
        let avatar = eaaaaToken
          ? `https://graph.facebook.com/v21.0/me/picture?type=large&access_token=${eaaaaToken}`
          : `https://graph.facebook.com/${finalUid}/picture?type=large`;
        let cover: string | undefined;
        let pages: FacebookPageItem[] = [];

        try {
          const details = await fetchAccountDetailsWithToken(eaaaaToken, proxy);
          if (details.isLive) {
            if (details.name) name = details.name;
            if (details.avatar) avatar = details.avatar;
            if (details.cover) cover = details.cover;
            if (details.uid) uid = details.uid;
            if (details.pages) pages = details.pages;
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
          cover,
          pages,
        };
      }

      const errorMsg = json.error?.message || "Đăng nhập Facebook thất bại";
      if (
        errorMsg.includes("Invalid username or password") &&
        i < passwords.length - 1
      ) {
        continue;
      }
      return { isSuccess: false, error: errorMsg };
    } catch (err: unknown) {
      if (i < passwords.length - 1) continue;
      return {
        isSuccess: false,
        error:
          err instanceof Error ? err.message : "Lỗi kết nối Facebook login",
      };
    }
  }

  return {
    isSuccess: false,
    error: "Đăng nhập Facebook thất bại sau khi thử tất cả biến thể mật khẩu",
  };
}

/**
 * Kiểm tra UID trực tiếp bằng Facebook Graph API v21.0
 * Không cần token, không cần cookie, không bị chặn.
 * Trả về 302 Found kèm CDN avatar nếu tài khoản đang LIVE.
 * Trả về 400 Bad Request kèm "Object with ID does not exist" nếu tài khoản đã DIE / bị xóa.
 */
export async function checkUidLiveGraph(
  uid: string,
  proxy?: string,
): Promise<{
  isLive: boolean;
  avatar?: string;
  error?: string;
}> {
  const cleanUid = uid.trim();
  if (!cleanUid || !/^\d+$/.test(cleanUid)) {
    return { isLive: false, error: "UID không hợp lệ" };
  }

  try {
    const raw = await executeCurlRequest({
      url: `https://graph.facebook.com/v21.0/${cleanUid}/picture?type=large`,
      method: "GET",
      includeHeaders: true,
      proxy,
      timeoutSecs: 12,
    });

    if (
      raw.includes("302 Found") ||
      raw.includes("fbcdn.net") ||
      raw.includes("image/jpeg")
    ) {
      const locMatch = raw.match(/location:\s*(\S+)/i);
      const avatar =
        locMatch?.[1] ||
        `https://graph.facebook.com/v21.0/${cleanUid}/picture?type=large`;
      return { isLive: true, avatar };
    }

    if (
      raw.includes("does not exist") ||
      raw.includes("Unsupported head request") ||
      raw.includes("400 Bad Request")
    ) {
      return { isLive: false, error: "Tài khoản không tồn tại (Die)" };
    }
  } catch {
    // fallback
  }

  return {
    isLive: true,
    avatar: `https://graph.facebook.com/v21.0/${cleanUid}/picture?type=large`,
  };
}

function unescapeUnicode(str: string): string {
  try {
    return str.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
  } catch {
    return str;
  }
}

/**
 * Trích xuất Tên, Avatar HD và trạng thái Live/Checkpoint từ HTML www.facebook.com
 * Chuẩn 100% từ FacebookAccountManager.kt (USER_NAME_REGEX, <title>) và FacebookLiveChecker.kt
 */
export function extractFacebookInfoFromHtml(
  html: string,
  cUser?: string,
): {
  name?: string;
  avatar?: string;
  isLive: boolean;
  isCheckpoint: boolean;
  isDie: boolean;
} {
  if (!html) return { isLive: false, isCheckpoint: false, isDie: false };

  // 1. Trích xuất tên (Name) chuẩn 100% cloneexe (USER_NAME_REGEX + Desktop SSR + <title>)
  let extractedName: string | undefined;

  // Pattern 1: USER_NAME_REGEX chuẩn FacebookAccountManager.kt
  const nameMatch1 = html.match(
    /"__typename"\s*:\s*"User"[^}]*?"name"\s*:\s*"((?:\\.|[^"])*)"/,
  );
  if (nameMatch1?.[1]) {
    const raw = unescapeUnicode(
      nameMatch1[1].replace(/\\"/g, '"').replace(/\\\//g, "/"),
    );
    if (raw.trim()) extractedName = raw.trim();
  }

  // Pattern 2: "NAME":"..." / "SHORT_NAME":"..." trong Desktop SSR script
  if (!extractedName) {
    const nameMatch2 = html.match(/"NAME"\s*:\s*"((?:\\.|[^"])*)"/);
    if (nameMatch2?.[1]) {
      const raw = unescapeUnicode(
        nameMatch2[1].replace(/\\"/g, '"').replace(/\\\//g, "/"),
      );
      if (raw.trim()) extractedName = raw.trim();
    }
  }

  // Pattern 3: <title> chuẩn FacebookAccountManager.kt & FacebookLiveChecker.kt
  if (!extractedName) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch?.[1]) {
      let title = titleMatch[1]
        .replace(/&amp;/g, "&")
        .replace(/&#039;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim();
      title = title.split(" | ")[0].split(" - ")[0].trim();
      title = title.replace(/^\(\d+\)\s*/, "").trim(); // Bỏ số thông báo (3) Tên
      const lower = title.toLowerCase();
      if (
        title &&
        !lower.includes("facebook") &&
        !lower.includes("log in") &&
        !lower.includes("đăng nhập") &&
        !lower.includes("checkpoint") &&
        !lower.includes("xác minh") &&
        !lower.includes("error") &&
        !lower.includes("không tìm thấy")
      ) {
        extractedName = title;
      }
    }
  }

  // 2. Trích xuất Avatar HD thật (FacebookLiveChecker.kt & FacebookMediaEngine.kt)
  let extractedAvatar: string | undefined;

  const avatarPatterns = [
    // Relay store profile_picture
    /"profile_picture"\s*:\s*\{\s*"uri"\s*:\s*"([^"]+)"/,
    // SVG image xlink:href
    /<image[^>]+xlink:href="([^"]*fbcdn\.net[^"]*)"/i,
    /xlink:href="([^"]*fbcdn\.net[^"]*)"/i,
    // Desktop img
    /<img[^>]+src="([^"]*fbcdn\.net[^"]*)"[^>]*role="img"/i,
    // data-profile-pic-url (FacebookLiveChecker.kt)
    /data-profile-pic-url="([^"]+)"/i,
    // class profilePic (FacebookLiveChecker.kt)
    /<img[^>]*class="[^"]*profilePic[^"]*"[^>]*src="([^"]+)"/i,
    // class rounded gray-border (FacebookLiveChecker.kt extractAvatarUrlV2)
    /<img[^>]+src="([^"]+)"[^>]*class="[^"]*rounded gray-border[^"]*"/i,
    // Direct fbcdn profile image link
    /(https:\\?\/\\?\/scontent[^"'\s\\]+\.fbcdn\.net\\?\/[^"'\s\\]+_n\.(?:jpg|png|gif|webp)[^"'\s\\]*)/,
  ];

  for (const pat of avatarPatterns) {
    const match = html.match(pat);
    if (match?.[1]) {
      const cand = match[1]
        .replace(/\\\//g, "/")
        .replace(/&amp;/g, "&")
        .replace(/\\u0025/g, "%");
      // Loại bỏ ảnh silhouette / placeholder
      if (
        !cand.includes("84628273_176159830277856") &&
        !cand.includes("silhouette") &&
        !cand.includes("default_avatar") &&
        !cand.includes("static.xx.fbcdn") &&
        !cand.includes("rsrc.php")
      ) {
        extractedAvatar = cand;
        break;
      }
    }
  }

  // Fallback avatar nếu không bắt được URL HD trực tiếp trong HTML
  if (!extractedAvatar && cUser && /^\d+$/.test(cUser)) {
    extractedAvatar = `https://graph.facebook.com/v21.0/${cUser}/picture?type=large`;
  }

  // 3. Phán đoán Live vs Checkpoint vs Die chuẩn xác
  // Nếu đã bắt được tên thật HOẶC avatar thật -> CHẮC CHẮN 100% LIVE!
  if (extractedName || (extractedAvatar && !extractedAvatar.includes("silhouette"))) {
    return {
      name: extractedName,
      avatar: extractedAvatar,
      isLive: true,
      isCheckpoint: false,
      isDie: false,
    };
  }

  // Kiểm tra Checkpoint thực sự (chỉ khi KHÔNG lấy được tên profile)
  const isCheckpoint = Boolean(
    html.includes("checkpointSubmitButton") ||
    html.includes('action="/checkpoint/') ||
    html.includes('name="submit[Continue]"') ||
    /<title>[^<]*(checkpoint|xác minh|security check)[^<]*<\/title>/i.test(html)
  );

  // Kiểm tra Die thực sự
  const isDie = Boolean(
    html.includes("login_form") ||
    html.includes('id="loginbutton"') ||
    /<title>[^<]*(log in|đăng nhập)[^<]*<\/title>/i.test(html)
  );

  return {
    name: undefined,
    avatar: extractedAvatar,
    isLive: !isCheckpoint && !isDie,
    isCheckpoint,
    isDie,
  };
}

/**
 * Xác thực cookie trực tiếp bằng www.facebook.com/me (chuẩn 100% FacebookAccountManager.kt: verifyCookieAndGetInfo)
 * Kiểm tra tài khoản có bị checkpoint / login_required hay không và bóc tách Tên từ USER_NAME_REGEX hoặc <title>
 */
export async function verifyCookieLive(
  cookie: string,
  proxy?: string,
): Promise<{
  isLive: boolean;
  uid?: string;
  name?: string;
  avatar?: string;
  error?: string;
}> {
  const cleanCookie = cookie.replace(/[\r\n]+/g, "").trim();
  const cUser = extractUidFromCookie(cleanCookie);

  try {
    const raw = await executeCurlRequest({
      url: "https://www.facebook.com/me",
      method: "GET",
      cookie: cleanCookie,
      headers: [
        "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language: vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        "Sec-Fetch-Site: same-origin",
      ],
      proxy,
      timeoutSecs: 15,
    });

    let info = extractFacebookInfoFromHtml(raw, cUser || undefined);

    // Nếu /me chưa bắt được Tên và cUser có sẵn, thử lấy trực tiếp từ trang cá nhân https://www.facebook.com/${cUser}
    if (!info.name && cUser && !info.isCheckpoint && !info.isDie) {
      try {
        const profileRaw = await executeCurlRequest({
          url: `https://www.facebook.com/${cUser}`,
          method: "GET",
          cookie: cleanCookie,
          headers: [
            "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language: vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
            "Sec-Fetch-Site: same-origin",
          ],
          proxy,
          timeoutSecs: 15,
        });
        const profileInfo = extractFacebookInfoFromHtml(profileRaw, cUser);
        if (profileInfo.name) {
          info = profileInfo;
        } else if (profileInfo.avatar && !info.avatar) {
          info.avatar = profileInfo.avatar;
        }
      } catch {
        // ignore
      }
    }

    if (info.isLive) {
      return {
        isLive: true,
        uid: cUser || undefined,
        name: info.name || cUser || "Facebook User",
        avatar: info.avatar,
      };
    }

    if (info.isCheckpoint) {
      return {
        isLive: false,
        uid: cUser || undefined,
        name: cUser || undefined,
        avatar: info.avatar,
        error: "Tài khoản bị Checkpoint",
      };
    }

    return {
      isLive: false,
      uid: cUser || undefined,
      error: "Cookie đã hết hạn (Die)",
    };
  } catch (err: unknown) {
    return {
      isLive: false,
      uid: cUser || undefined,
      error: err instanceof Error ? err.message : "Lỗi kiểm tra cookie",
    };
  }
}

/**
 * 5. KIỂM TRA TÀI KHOẢN THEO CHUẨN 100% FacebookAccountManager.kt:
 * 1. Ưu tiên: Nếu dòng bắt đầu bằng EAA hoặc có Token -> gọi fetchAccountDetailsWithToken
 * 2. Nếu có Cookie -> kiểm tra live qua www.facebook.com/me + lấy avatar & tên thật
 * 3. Nếu có UID & Pass -> đăng nhập qua facebookLogin
 * 4. Nếu có UID -> kiểm tra tồn tại trực tiếp qua Graph API (/picture)
 */

export async function checkFacebookAccountFull(params: {
  uid?: string;
  pass?: string;
  twoFactor?: string;
  cookie?: string;
  token?: string;
  datr?: string;
  proxy?: string;
}): Promise<FacebookAccountInfo> {
  const {
    uid: inputUid,
    pass,
    twoFactor,
    cookie: inputCookie,
    token: inputToken,
    datr: inputDatr,
    proxy,
  } = params;

  let activeToken = inputToken?.trim();
  let activeCookie = inputCookie?.trim();
  let activeUid = inputUid?.trim() || "";
  let activeDatr = inputDatr?.trim();

  // Trích xuất datr nếu nằm trong cookie
  if (!activeDatr && activeCookie?.includes("datr=")) {
    const dm = activeCookie.match(/datr=([^;]+)/);
    if (dm) activeDatr = dm[1];
  }

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
            `https://graph.facebook.com/v21.0/me/picture?type=large&access_token=${activeToken}`,
          cover: details.cover,
          email: details.email,
          token: activeToken,
          cookie: activeCookie,
          pages: details.pages,
          proxy,
          isLive: true,
        };
      }
    } catch {
      // ignore
    }
  }

  // 2. Thử lấy Token EAAAA từ Cookie trước nếu có (chuẩn FacebookToken.kt dòng 534)
  if (
    activeCookie &&
    (activeCookie.includes("c_user=") || activeCookie.includes("xs="))
  ) {
    const cUser = extractUidFromCookie(activeCookie);
    if (cUser && !activeUid) activeUid = cUser;

    try {
      const tokenRes = await getTokenFromCookie(activeCookie, proxy);
      if (tokenRes.isLive && tokenRes.eaaaaToken) {
        activeToken = tokenRes.eaaaaToken;
        if (tokenRes.cookie) activeCookie = tokenRes.cookie;
        if (tokenRes.uid) activeUid = tokenRes.uid;

        return {
          uid: activeUid,
          name: tokenRes.name || activeUid,
          avatar:
            tokenRes.avatar ||
            `https://graph.facebook.com/v21.0/me/picture?type=large&access_token=${activeToken}`,
          cover: tokenRes.cover,
          token: activeToken,
          cookie: activeCookie,
          pages: tokenRes.pages,
          proxy,
          isLive: true,
        };
      }
    } catch {
      // ignore
    }

    // Nếu chưa lấy được EAAAA, kiểm tra xác thực Cookie qua verifyCookieLive (chuẩn 100% FacebookAccountManager.kt: verifyCookieAndGetInfo)
    try {
      const liveCheck = await verifyCookieLive(activeCookie, proxy);
      if (liveCheck.isLive) {
        return {
          uid: activeUid || liveCheck.uid || "N/A",
          name: liveCheck.name || activeUid,
          avatar:
            liveCheck.avatar ||
            `https://graph.facebook.com/v21.0/${activeUid}/picture?type=large`,
          token: activeToken,
          cookie: activeCookie,
          proxy,
          isLive: true,
        };
      }
      if (liveCheck.error?.toLowerCase().includes("checkpoint")) {
        return {
          uid: activeUid || liveCheck.uid || "N/A",
          name: liveCheck.name || activeUid,
          token: activeToken,
          cookie: activeCookie,
          avatar:
            liveCheck.avatar ||
            `https://graph.facebook.com/v21.0/${activeUid}/picture?type=large`,
          proxy,
          isLive: false,
          error: "Tài khoản bị Checkpoint",
        };
      }
      return {
        uid: activeUid || liveCheck.uid || "N/A",
        name: liveCheck.name || activeUid,
        token: activeToken,
        cookie: activeCookie,
        avatar:
          liveCheck.avatar ||
          `https://graph.facebook.com/v21.0/${activeUid}/picture?type=large`,
        proxy,
        isLive: false,
        error: liveCheck.error || "Cookie die",
      };
    } catch {
      // ignore
    }
  }

  // 3. Nếu chưa lấy được từ cookie, chạy luồng login qua API với pass & 2FA (chuẩn FacebookToken.kt dòng 545)
  if (activeUid && pass) {
    try {
      const loginRes = await facebookLogin(
        activeUid,
        pass,
        twoFactor,
        activeDatr,
        proxy,
      );
      if (loginRes.isSuccess && loginRes.eaaaaToken) {
        activeToken = loginRes.eaaaaToken;
        if (loginRes.cookie) activeCookie = loginRes.cookie;
        if (loginRes.uid) activeUid = loginRes.uid;

        return {
          uid: activeUid,
          name: loginRes.name || activeUid,
          token: activeToken,
          cookie: activeCookie,
          avatar:
            loginRes.avatar ||
            `https://graph.facebook.com/v21.0/me/picture?type=large&access_token=${activeToken}`,
          cover: loginRes.cover,
          pages: loginRes.pages,
          proxy,
          isLive: true,
        };
      }

      if (loginRes.error?.toLowerCase().includes("checkpoint")) {
        return {
          uid: activeUid,
          name: activeUid,
          token: activeToken,
          cookie: activeCookie,
          avatar: `https://graph.facebook.com/v21.0/${activeUid}/picture?type=large`,
          proxy,
          isLive: false,
          error: "Tài khoản bị Checkpoint",
        };
      }
    } catch {
      // ignore
    }
  }

  // 4. CHUẨN CLONEEXE: Nếu không có Token/Cookie sống hoặc đăng nhập thất bại -> BẮT BUỘC isLive: false!
  // Tuyệt đối không auto gán isLive: true bằng link ảnh public Graph API.
  let fallbackAvatar: string | undefined;
  if (activeUid && /^\d+$/.test(activeUid)) {
    try {
      const uidCheck = await checkUidLiveGraph(activeUid, proxy);
      fallbackAvatar =
        uidCheck.avatar ||
        `https://graph.facebook.com/v21.0/${activeUid}/picture?type=large`;
    } catch {
      // ignore
    }
  }

  const fallbackUid =
    (activeCookie ? extractUidFromCookie(activeCookie) : null) ||
    activeUid ||
    "N/A";

  return {
    uid: fallbackUid,
    name: fallbackUid,
    token: activeToken,
    cookie: activeCookie,
    avatar:
      fallbackAvatar ||
      (fallbackUid !== "N/A"
        ? `https://graph.facebook.com/v21.0/${fallbackUid}/picture?type=large`
        : undefined),
    proxy,
    isLive: false,
    error:
      activeCookie || activeToken
        ? "Cookie/Token hết hạn hoặc tài khoản Die"
        : "Chưa có Token hoặc Cookie đăng nhập hợp lệ (Die)",
  };
}

export async function getTokenAndInfoFromCookie(
  cookieStr: string,
  proxy?: string,
): Promise<FacebookAccountInfo> {
  return checkFacebookAccountFull({ cookie: cookieStr, proxy });
}

export interface UploadMediaResult {
  success: boolean;
  photoId?: string;
  mediaUrl?: string;
  message?: string;
  rawResponse?: string;
}

function safeJsonParse<T = any>(str: string): T | null {
  if (!str || !str.trim()) return null;
  try {
    return JSON.parse(str) as T;
  } catch {
    return null;
  }
}

/**
 * Lấy direct CDN URL từ Photo ID đã upload qua Graph API (chuẩn FacebookMediaEngine.kt)
 */
export async function getPhotoDirectUrl(
  photoId: string,
  token: string,
  proxy?: string,
): Promise<string | null> {
  const cleanToken = token.replace(/^(OAuth|Bearer)\s+/i, "").trim();
  if (!cleanToken || !photoId) return null;
  try {
    const raw = await executeCurlRequest({
      url: `https://graph.facebook.com/v21.0/${photoId}?fields=id,source,images&access_token=${cleanToken}`,
      method: "GET",
      headers: [
        "User-Agent: [FBAN/FB4A;FBAV/548.1.0.51.64;FBBV/474618929;FBDM/{density=3.0,width=1080,height=2340};FBLC/vi_VN;FBRV/0;FBCR/Viettel;FBMF/samsung;FBBD/samsung;FBPN/com.facebook.katana;FBDV/SM-S928B;FBSV/14;FBOP/1;FBCA/arm64-v8a;]",
        `Authorization: OAuth ${cleanToken}`,
      ],
      proxy,
    });
    const json = safeJsonParse(raw);
    if (!json) return null;
    if (json.source) return json.source;
    if (Array.isArray(json.images) && json.images.length > 0) {
      return json.images[0].source || null;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Lấy Real Graph Page ID và Page Access Token đối ứng cho UID 615
 * Chuẩn 100% từ QuanLyPageEngine.kt (resolveGraphPageId + resolvePageAccessToken)
 */
export async function resolvePageInfo615(params: {
  pageUidOrId: string;
  token: string;
  proxy?: string;
}): Promise<{ realPageId: string; pageToken: string }> {
  const { pageUidOrId, token, proxy } = params;
  const cleanId = pageUidOrId.trim();
  const cleanToken = token.replace(/^(OAuth|Bearer)\s+/i, "").trim();

  let realPageId = cleanId;
  let pageToken = cleanToken;

  if (cleanToken) {
    // 1. Thử truy vấn direct UID nếu là 615 để lấy delegate_page_id
    if (cleanId.startsWith("615")) {
      try {
        const rawDirect = await executeCurlRequest({
          url: `https://graph.facebook.com/v21.0/${cleanId}?fields=id,name,delegate_page_id&access_token=${cleanToken}`,
          method: "GET",
          headers: [
            "User-Agent: [FBAN/FB4A;FBAV/548.1.0.51.64;FBBV/474618929;FBDM/{density=3.0,width=1080,height=2340};FBLC/vi_VN;FBRV/0;FBCR/Viettel;FBMF/samsung;FBBD/samsung;FBPN/com.facebook.katana;FBDV/SM-S928B;FBSV/14;FBOP/1;FBCA/arm64-v8a;]",
            `Authorization: OAuth ${cleanToken}`,
          ],
          proxy,
          timeoutSecs: 10,
        });
        const jsonDirect = safeJsonParse(rawDirect);
        const delId = String(jsonDirect?.delegate_page_id || "").trim();
        const dirId = String(jsonDirect?.id || "").trim();
        if (delId && !delId.startsWith("615")) {
          realPageId = delId;
        } else if (dirId && !dirId.startsWith("615")) {
          realPageId = dirId;
        }
      } catch {
        // ignore
      }
    }

    // 2. Truy vấn /me/accounts để tìm Page Token và Real Page ID
    try {
      const raw = await executeCurlRequest({
        url: `https://graph.facebook.com/v21.0/me/accounts?fields=id,access_token,additional_profile_id,delegate_page_id&limit=100&access_token=${cleanToken}`,
        method: "GET",
        headers: [
          "User-Agent: [FBAN/FB4A;FBAV/548.1.0.51.64;FBBV/474618929;FBDM/{density=3.0,width=1080,height=2340};FBLC/vi_VN;FBRV/0;FBCR/Viettel;FBMF/samsung;FBBD/samsung;FBPN/com.facebook.katana;FBDV/SM-S928B;FBSV/14;FBOP/1;FBCA/arm64-v8a;]",
          `Authorization: OAuth ${cleanToken}`,
        ],
        proxy,
        timeoutSecs: 15,
      });

      const json = safeJsonParse(raw);
      if (Array.isArray(json?.data)) {
        for (const item of json.data) {
          const pid = String(item.id || "").trim();
          const addId = String(item.additional_profile_id || "").trim();
          const delId = String(item.delegate_page_id || "").trim();
          const tok = String(item.access_token || "").trim();

          const isMatch =
            cleanId === pid ||
            cleanId === addId ||
            cleanId === delId ||
            (realPageId && realPageId === pid) ||
            (realPageId && realPageId === delId) ||
            (!cleanId.startsWith("615") && cleanId === pid);

          if (isMatch) {
            if (delId && !delId.startsWith("615")) {
              realPageId = delId;
            } else if (pid && !pid.startsWith("615")) {
              realPageId = pid;
            } else {
              realPageId = pid || cleanId;
            }
            if (tok) {
              pageToken = tok;
            }
            break;
          }
        }
      }
    } catch {
      // ignore
    }

    // 3. Fallback: Nếu chưa lấy được pageToken riêng và realPageId khác 615
    if (
      pageToken === cleanToken &&
      realPageId &&
      !realPageId.startsWith("615") &&
      realPageId !== "me"
    ) {
      try {
        const rawTok = await executeCurlRequest({
          url: `https://graph.facebook.com/v21.0/${realPageId}?fields=access_token&access_token=${cleanToken}`,
          method: "GET",
          headers: [
            "User-Agent: [FBAN/FB4A;FBAV/548.1.0.51.64;FBBV/474618929;FBDM/{density=3.0,width=1080,height=2340};FBLC/vi_VN;FBRV/0;FBCR/Viettel;FBMF/samsung;FBBD/samsung;FBPN/com.facebook.katana;FBDV/SM-S928B;FBSV/14;FBOP/1;FBCA/arm64-v8a;]",
            `Authorization: OAuth ${cleanToken}`,
          ],
          proxy,
          timeoutSecs: 10,
        });
        const jsonTok = safeJsonParse(rawTok);
        if (jsonTok?.access_token) {
          pageToken = String(jsonTok.access_token).trim();
        }
      } catch {
        // ignore
      }
    }
  }

  return { realPageId, pageToken };
}

/**
 * Cập nhật Avatar cho Page 615 / Fanpage qua Graph API
 * Chuẩn 100% logic từ FacebookMediaEngine.kt & QuanLyPageEngine.kt
 */
export async function uploadFacebookPageAvatar(params: {
  pageId: string;
  token: string;
  filePath?: string;
  imageUrl?: string;
  proxy?: string;
}): Promise<UploadMediaResult> {
  const { pageId, token, filePath, imageUrl, proxy } = params;
  const cleanToken = token.replace(/^(OAuth|Bearer)\s+/i, "").trim();
  if (!cleanToken) {
    return { success: false, message: "Cần có Access Token để đổi avatar" };
  }
  if (!filePath && !imageUrl) {
    return { success: false, message: "Cần cung cấp file ảnh hoặc link ảnh" };
  }

  // Tự động phân giải ID và Token chính xác của Page từ /me/accounts nếu là Page 615
  const { realPageId, pageToken: resolvedToken } = await resolvePageInfo615({
    pageUidOrId: pageId,
    token: cleanToken,
    proxy,
  });

  const activeToken = resolvedToken || cleanToken;
  // Chuẩn hóa đường dẫn file trên Windows: đổi \ thành / để curl đọc không bị lỗi escape / port syntax
  const cleanPath = filePath ? filePath.replace(/\\/g, "/") : "";

  const headers = [
    "User-Agent: [FBAN/FB4A;FBAV/548.1.0.51.64;FBBV/474618929;FBDM/{density=3.0,width=1080,height=2340};FBLC/vi_VN;FBRV/0;FBCR/Viettel;FBMF/samsung;FBBD/samsung;FBPN/com.facebook.katana;FBDV/SM-S928B;FBSV/14;FBOP/1;FBCA/arm64-v8a;]",
    `Authorization: OAuth ${activeToken}`,
  ];

  // Danh sách endpoint thử nghiệm:
  const candidateEndpoints: string[] = [];
  if (pageId && pageId !== "me") {
    candidateEndpoints.push(pageId);
  }
  if (realPageId && realPageId !== "me" && realPageId !== pageId) {
    candidateEndpoints.push(realPageId);
  }
  candidateEndpoints.push("me");

  let photoId = "";
  let errMsg = "";
  let successfulEndpoint = "";

  for (const ep of candidateEndpoints) {
    try {
      let rawRes = "";
      if (cleanPath) {
        // Cách 1: Upload vào /{ep}/photos rồi gán photo_id sau (chuẩn FacebookMediaEngine.kt)
        rawRes = await executeCurlRequest({
          url: `https://graph.facebook.com/v21.0/${ep}/photos`,
          method: "POST",
          headers,
          formFields: [
            `access_token=${activeToken}`,
            "published=true",
            `source=@${cleanPath}`,
          ],
          proxy,
          timeoutSecs: 30,
        });

        const json = safeJsonParse<any>(rawRes);
        if (json?.id) {
          photoId = json.id;
          successfulEndpoint = ep;
          break;
        }

        // Cách 2: Direct upload vào /{ep}/picture
        const directRes = await executeCurlRequest({
          url: `https://graph.facebook.com/v21.0/${ep}/picture`,
          method: "POST",
          headers,
          formFields: [
            `access_token=${activeToken}`,
            `source=@${cleanPath}`,
          ],
          proxy,
          timeoutSecs: 30,
        });

        const jsonDirect = safeJsonParse<any>(directRes);
        if (jsonDirect && !jsonDirect.error) {
          const directId = jsonDirect.id || "";
          const directUrl = directId
            ? await getPhotoDirectUrl(directId, activeToken, proxy)
            : null;
          return {
            success: true,
            photoId: directId,
            mediaUrl:
              directUrl ||
              `https://graph.facebook.com/v21.0/${ep}/picture?type=large&access_token=${activeToken}`,
            message: "Cập nhật ảnh đại diện Page thành công",
            rawResponse: directRes,
          };
        }
      } else if (imageUrl) {
        const formBody = new URLSearchParams({
          access_token: activeToken,
          published: "true",
          url: imageUrl,
        }).toString();
        rawRes = await executeCurlRequest({
          url: `https://graph.facebook.com/v21.0/${ep}/photos`,
          method: "POST",
          headers: [
            ...headers,
            "Content-Type: application/x-www-form-urlencoded",
          ],
          body: formBody,
          proxy,
          timeoutSecs: 30,
        });
      }

      const json = safeJsonParse<any>(rawRes);
      if (json?.id) {
        photoId = json.id;
        successfulEndpoint = ep;
        break;
      }
      if (json?.error?.message) {
        errMsg = json.error.message;
      } else if (rawRes && !rawRes.includes("<html>")) {
        errMsg = rawRes;
      }
    } catch (e: unknown) {
      errMsg =
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : JSON.stringify(e);
    }
  }

  const targetForPic = successfulEndpoint || pageId || realPageId || "me";

  // Bước 2: Gán photoId làm Avatar qua /{target}/picture
  if (photoId) {
    try {
      const setPicBody = new URLSearchParams({
        access_token: activeToken,
        photo_id: photoId,
        photo: photoId,
        picture: photoId,
      }).toString();

      const picRes = await executeCurlRequest({
        url: `https://graph.facebook.com/v21.0/${targetForPic}/picture`,
        method: "POST",
        headers: [
          ...headers,
          "Content-Type: application/x-www-form-urlencoded",
        ],
        body: setPicBody,
        proxy,
        timeoutSecs: 20,
      });

      const picJson = safeJsonParse<any>(picRes);
      if (
        picRes?.trim() === "true" ||
        picJson === true ||
        (picJson && !picJson.error)
      ) {
        const directUrl = await getPhotoDirectUrl(photoId, activeToken, proxy);
        return {
          success: true,
          photoId,
          mediaUrl:
            directUrl ||
            `https://graph.facebook.com/v21.0/${targetForPic}/picture?type=large&access_token=${activeToken}`,
          message: "Cập nhật ảnh đại diện Page thành công",
          rawResponse: picRes,
        };
      }
      if (picJson?.error?.message) {
        errMsg = picJson.error.message;
      }
    } catch {
      // fallback
    }

    // Fallback: Nếu targetForPic khác "me", thử gán qua "me"
    if (targetForPic !== "me") {
      try {
        const setPicBodyMe = new URLSearchParams({
          access_token: activeToken,
          photo_id: photoId,
          photo: photoId,
          picture: photoId,
        }).toString();

        const picResMe = await executeCurlRequest({
          url: `https://graph.facebook.com/v21.0/me/picture`,
          method: "POST",
          headers: [
            ...headers,
            "Content-Type: application/x-www-form-urlencoded",
          ],
          body: setPicBodyMe,
          proxy,
          timeoutSecs: 20,
        });

        const picJsonMe = safeJsonParse<any>(picResMe);
        if (
          picResMe?.trim() === "true" ||
          picJsonMe === true ||
          (picJsonMe && !picJsonMe.error)
        ) {
          const directUrl = await getPhotoDirectUrl(photoId, activeToken, proxy);
          return {
            success: true,
            photoId,
            mediaUrl:
              directUrl ||
              `https://graph.facebook.com/v21.0/me/picture?type=large&access_token=${activeToken}`,
            message: "Cập nhật ảnh đại diện Page thành công",
            rawResponse: picResMe,
          };
        }
      } catch {
        // ignore
      }
    }
  }

  return {
    success: false,
    message: errMsg
      ? `Lỗi tải ảnh đại diện: ${errMsg}`
      : "Lỗi cập nhật ảnh đại diện Page",
  };
}

/**
 * Cập nhật Ảnh Bìa (Cover Photo) cho Page 615 / Fanpage qua Graph API
 * Chuẩn 100% logic từ FacebookMediaEngine.kt & QuanLyPageEngine.kt
 */
export async function uploadFacebookPageCover(params: {
  pageId: string;
  token: string;
  filePath?: string;
  imageUrl?: string;
  proxy?: string;
}): Promise<UploadMediaResult> {
  const { pageId, token, filePath, imageUrl, proxy } = params;
  const cleanToken = token.replace(/^(OAuth|Bearer)\s+/i, "").trim();
  if (!cleanToken) {
    return { success: false, message: "Cần có Access Token để đổi ảnh bìa" };
  }
  if (!filePath && !imageUrl) {
    return { success: false, message: "Cần cung cấp file ảnh hoặc link ảnh" };
  }

  // Tự động phân giải ID và Token chính xác của Page từ /me/accounts nếu là Page 615
  const { realPageId, pageToken: resolvedToken } = await resolvePageInfo615({
    pageUidOrId: pageId,
    token: cleanToken,
    proxy,
  });

  const activeToken = resolvedToken || cleanToken;
  // Chuẩn hóa đường dẫn file trên Windows: đổi \ thành / để curl đọc không bị lỗi escape / port syntax
  const cleanPath = filePath ? filePath.replace(/\\/g, "/") : "";

  const headers = [
    "User-Agent: [FBAN/FB4A;FBAV/548.1.0.51.64;FBBV/474618929;FBDM/{density=3.0,width=1080,height=2340};FBLC/vi_VN;FBRV/0;FBCR/Viettel;FBMF/samsung;FBBD/samsung;FBPN/com.facebook.katana;FBDV/SM-S928B;FBSV/14;FBOP/1;FBCA/arm64-v8a;]",
    `Authorization: OAuth ${activeToken}`,
  ];

  let resolvedRealPageId = realPageId;
  if (!resolvedRealPageId || resolvedRealPageId.startsWith("615")) {
    try {
      const meInfo = await executeCurlRequest({
        url: `https://graph.facebook.com/v21.0/me?fields=id&access_token=${activeToken}`,
        method: "GET",
        headers,
        proxy,
        timeoutSecs: 10,
      });
      const meJson = safeJsonParse<any>(meInfo);
      if (meJson?.id && !String(meJson.id).startsWith("615")) {
        resolvedRealPageId = String(meJson.id).trim();
      }
    } catch {
      // ignore
    }
  }

  const candidateEndpoints: string[] = [];
  if (resolvedRealPageId && resolvedRealPageId !== "me" && !resolvedRealPageId.startsWith("615")) {
    candidateEndpoints.push(resolvedRealPageId);
  }
  if (pageId && pageId !== "me" && !candidateEndpoints.includes(pageId)) {
    candidateEndpoints.push(pageId);
  }
  if (!candidateEndpoints.includes("me")) {
    candidateEndpoints.push("me");
  }

  let photoId = "";
  let errMsg = "";
  let successfulEndpoint = "";

  // Bước 1: Upload ảnh vào /{endpoint}/photos
  for (const ep of candidateEndpoints) {
    try {
      let rawRes = "";
      if (cleanPath) {
        // Cách 1: Upload chuẩn không có cờ is_profile_cover (chuẩn cho Page)
        rawRes = await executeCurlRequest({
          url: `https://graph.facebook.com/v21.0/${ep}/photos`,
          method: "POST",
          headers,
          formFields: [
            `access_token=${activeToken}`,
            "published=true",
            `source=@${cleanPath}`,
          ],
          proxy,
          timeoutSecs: 30,
        });

        const json = safeJsonParse<any>(rawRes);
        if (json?.id) {
          photoId = json.id;
          successfulEndpoint = ep;
          break;
        }

        // Cách 2: Thử thêm cờ is_profile_cover (chuẩn FacebookMediaEngine.kt)
        const rawCover = await executeCurlRequest({
          url: `https://graph.facebook.com/v21.0/${ep}/photos`,
          method: "POST",
          headers,
          formFields: [
            `access_token=${activeToken}`,
            "published=true",
            "is_profile_cover=true",
            `source=@${cleanPath}`,
          ],
          proxy,
          timeoutSecs: 30,
        });
        const jsonCover = safeJsonParse<any>(rawCover);
        if (jsonCover?.id) {
          photoId = jsonCover.id;
          successfulEndpoint = ep;
          break;
        }
      } else if (imageUrl) {
        const formBody = new URLSearchParams({
          access_token: activeToken,
          published: "true",
          url: imageUrl,
        }).toString();
        rawRes = await executeCurlRequest({
          url: `https://graph.facebook.com/v21.0/${ep}/photos`,
          method: "POST",
          headers: [
            ...headers,
            "Content-Type: application/x-www-form-urlencoded",
          ],
          body: formBody,
          proxy,
          timeoutSecs: 25,
        });
      }

      const json = safeJsonParse<any>(rawRes);
      if (json?.id) {
        photoId = json.id;
        successfulEndpoint = ep;
        break;
      }
      if (json?.error?.message) {
        errMsg = json.error.message;
      } else if (rawRes && !rawRes.includes("<html>")) {
        errMsg = rawRes;
      }
    } catch (e: unknown) {
      errMsg =
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : JSON.stringify(e);
    }
  }

  if (!photoId) {
    return {
      success: false,
      message: errMsg
        ? `Lỗi tải ảnh bìa lên: ${errMsg}`
        : "Lỗi tải ảnh bìa lên Facebook",
    };
  }

  // Bước 2: Set photo này làm cover qua POST /{endpoint}
  const candidateCoverTargets: string[] = [];
  if (resolvedRealPageId && !resolvedRealPageId.startsWith("615") && resolvedRealPageId !== "me") {
    candidateCoverTargets.push(resolvedRealPageId);
  }
  if (!candidateCoverTargets.includes("me")) {
    candidateCoverTargets.push("me");
  }
  if (successfulEndpoint && !successfulEndpoint.startsWith("615") && !candidateCoverTargets.includes(successfulEndpoint)) {
    candidateCoverTargets.push(successfulEndpoint);
  }
  if (pageId && !pageId.startsWith("615") && !candidateCoverTargets.includes(pageId)) {
    candidateCoverTargets.push(pageId);
  }

  let step2Err = "";

  for (const target of candidateCoverTargets) {
    // Định dạng 1: cover={"cover_id":"<photoId>","offset_x":0,"offset_y":0}
    try {
      const coverJson = JSON.stringify({
        cover_id: photoId,
        offset_x: 0,
        offset_y: 0,
      });
      const formBody1 = new URLSearchParams({
        access_token: activeToken,
        cover: coverJson,
      }).toString();

      const res1 = await executeCurlRequest({
        url: `https://graph.facebook.com/v21.0/${target}`,
        method: "POST",
        headers: [
          ...headers,
          "Content-Type: application/x-www-form-urlencoded",
        ],
        body: formBody1,
        proxy,
        timeoutSecs: 20,
      });

      const json1 = safeJsonParse<any>(res1);
      if (
        res1?.trim() === "true" ||
        json1 === true ||
        (json1 && !json1.error)
      ) {
        const directUrl = await getPhotoDirectUrl(photoId, activeToken, proxy);
        return {
          success: true,
          photoId,
          mediaUrl: directUrl || undefined,
          message: "Cập nhật ảnh bìa thành công",
          rawResponse: res1,
        };
      }
      if (json1?.error?.message) {
        step2Err = json1.error.message;
      }
    } catch (e: unknown) {
      step2Err =
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : JSON.stringify(e);
    }

    // Định dạng 2: cover_id=<photoId> (chuẩn Graph API Page cover update)
    try {
      const formBody2 = new URLSearchParams({
        access_token: activeToken,
        cover_id: photoId,
        offset_x: "0",
        offset_y: "0",
      }).toString();

      const res2 = await executeCurlRequest({
        url: `https://graph.facebook.com/v21.0/${target}`,
        method: "POST",
        headers: [
          ...headers,
          "Content-Type: application/x-www-form-urlencoded",
        ],
        body: formBody2,
        proxy,
        timeoutSecs: 20,
      });

      const json2 = safeJsonParse<any>(res2);
      if (
        res2?.trim() === "true" ||
        json2 === true ||
        (json2 && !json2.error)
      ) {
        const directUrl = await getPhotoDirectUrl(photoId, activeToken, proxy);
        return {
          success: true,
          photoId,
          mediaUrl: directUrl || undefined,
          message: "Cập nhật ảnh bìa thành công",
          rawResponse: res2,
        };
      }
      if (json2?.error?.message) {
        step2Err = json2.error.message;
      }
    } catch {
      // ignore
    }

    // Định dạng 3: cover=<photoId> string đơn giản
    try {
      const formBody3 = new URLSearchParams({
        access_token: activeToken,
        cover: photoId,
        offset_x: "0",
        offset_y: "0",
      }).toString();

      const res3 = await executeCurlRequest({
        url: `https://graph.facebook.com/v21.0/${target}`,
        method: "POST",
        headers: [
          ...headers,
          "Content-Type: application/x-www-form-urlencoded",
        ],
        body: formBody3,
        proxy,
        timeoutSecs: 20,
      });

      const json3 = safeJsonParse<any>(res3);
      if (
        res3?.trim() === "true" ||
        json3 === true ||
        (json3 && !json3.error)
      ) {
        const directUrl = await getPhotoDirectUrl(photoId, activeToken, proxy);
        return {
          success: true,
          photoId,
          mediaUrl: directUrl || undefined,
          message: "Cập nhật ảnh bìa thành công",
          rawResponse: res3,
        };
      }
      if (json3?.error?.message) {
        step2Err = json3.error.message;
      }
    } catch {
      // ignore
    }

    // Định dạng 4: photo_id=<photoId>
    try {
      const formBody4 = new URLSearchParams({
        access_token: activeToken,
        photo_id: photoId,
      }).toString();

      const res4 = await executeCurlRequest({
        url: `https://graph.facebook.com/v21.0/${target}`,
        method: "POST",
        headers: [
          ...headers,
          "Content-Type: application/x-www-form-urlencoded",
        ],
        body: formBody4,
        proxy,
        timeoutSecs: 20,
      });

      const json4 = safeJsonParse<any>(res4);
      if (
        res4?.trim() === "true" ||
        json4 === true ||
        (json4 && !json4.error)
      ) {
        const directUrl = await getPhotoDirectUrl(photoId, activeToken, proxy);
        return {
          success: true,
          photoId,
          mediaUrl: directUrl || undefined,
          message: "Cập nhật ảnh bìa thành công",
          rawResponse: res4,
        };
      }
      if (json4?.error?.message) {
        step2Err = json4.error.message;
      }
    } catch {
      // ignore
    }
  }

  return {
    success: false,
    message: step2Err
      ? `Lỗi cập nhật ảnh bìa Page: ${step2Err}`
      : "Lỗi cập nhật ảnh bìa Page",
  };
}
