import { invoke } from "@tauri-apps/api/core";

export interface DolikeUser {
  id?: number | string;
  email: string;
  username?: string;
  balance: string;
  token?: string;
  status?: string;
}

export interface DolikeLoginResponse {
  success: boolean;
  user?: DolikeUser;
  sessionCookie?: string;
  token?: string;
  error?: string;
}

export interface DolikeWalletResponse {
  success: boolean;
  balance?: string;
  raw?: unknown;
  error?: string;
}

export const DOLIKE_BASE_URL = "https://congtingudolike.servehttp.com";
export const DOLIKE_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36";

export const DOLIKE_DEFAULT_HEADERS = [
  "accept: application/json",
  "accept-language: vi-VN,vi;q=0.9,ja-JP;q=0.8,ja;q=0.7,en-JP;q=0.6,en;q=0.5,es-ES;q=0.4,es;q=0.3,fr-FR;q=0.2,fr;q=0.1,en-US;q=0.1",
  "cache-control: no-cache",
  "pragma: no-cache",
  'sec-ch-ua: "Google Chrome";v="155", "Chromium";v="155", "Not(A:Brand";v="24"',
  "sec-ch-ua-mobile: ?0",
  'sec-ch-ua-platform: "Windows"',
  "sec-fetch-dest: empty",
  "sec-fetch-mode: cors",
  "sec-fetch-site: same-origin",
  `user-agent: ${DOLIKE_USER_AGENT}`,
];

export async function computeSha256(text: string): Promise<string> {
  if (!text) return "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    try {
      const msgUint8 = new TextEncoder().encode(text);
      const hashBuffer = await window.crypto.subtle.digest("SHA-256", msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      // fallback
    }
  }
  return "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
}

export async function runDolikeCurl(options: {
  url: string;
  method?: string;
  headers?: string[];
  body?: string;
  cookie?: string;
  includeHeaders?: boolean;
}): Promise<string> {
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
      proxy: null,
      includeHeaders: options.includeHeaders ?? false,
      timeoutSecs: 20,
      formFields: null,
    });
  }

  // Fallback nếu chạy ở trình duyệt web thông thường
  const headersObj: Record<string, string> = {};
  if (options.headers) {
    for (const h of options.headers) {
      const idx = h.indexOf(":");
      if (idx !== -1) {
        headersObj[h.slice(0, idx).trim()] = h.slice(idx + 1).trim();
      }
    }
  }
  if (options.cookie) {
    headersObj["cookie"] = options.cookie;
  }
  const res = await fetch(options.url, {
    method: options.method ?? "GET",
    headers: headersObj,
    body: options.body,
  });
  return await res.text();
}

/**
 * Đăng nhập DoLike theo curl:
 * POST https://congtingudolike.servehttp.com/api/account-auth.php
 * Body: {"action":"login","email":"...","password":"..."}
 */
export async function loginDolike(
  email: string,
  password: string,
): Promise<DolikeLoginResponse> {
  try {
    const rawOutput = await runDolikeCurl({
      url: `${DOLIKE_BASE_URL}/api/account-auth.php`,
      method: "POST",
      includeHeaders: true,
      headers: [
        ...DOLIKE_DEFAULT_HEADERS,
        "content-type: application/json",
        `origin: ${DOLIKE_BASE_URL}`,
      ],
      body: JSON.stringify({
        action: "login",
        email: email.trim(),
        password,
      }),
    });

    let headerText = "";
    let bodyText = rawOutput;

    const parts = rawOutput.split(/\r?\n\r?\n/);
    if (parts.length > 1) {
      bodyText = parts[parts.length - 1].trim();
      headerText = parts.slice(0, parts.length - 1).join("\n");
    }

    // Trích xuất PHPSESSID và mgauto_email_persist từ response Set-Cookie
    const phpSessMatch = headerText.match(/PHPSESSID=([^;\r\n]+)/);
    const persistMatch = headerText.match(/mgauto_email_persist=([^;\r\n]+)/);

    const cookies: string[] = [];
    if (phpSessMatch) cookies.push(`PHPSESSID=${phpSessMatch[1].trim()}`);
    if (persistMatch) cookies.push(`mgauto_email_persist=${persistMatch[1].trim()}`);
    const sessionCookie = cookies.join("; ");

    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(bodyText);
    } catch {
      // nếu body rỗng hoặc lỗi 401
      return {
        success: false,
        error: "Email hoặc mật khẩu DoLike không chính xác",
      };
    }

    if (data.status === "error" || data.error) {
      const errMsg =
        String(data.error || data.message || "Đăng nhập DoLike thất bại");
      return { success: false, error: errMsg };
    }

    // Trích xuất Bearer Token (nếu có trả về trong response)
    const token =
      (data.token as string) ||
      (data.access_token as string) ||
      (data?.data && typeof data.data === "object"
        ? ((data.data as Record<string, unknown>).token as string) ||
          ((data.data as Record<string, unknown>).access_token as string)
        : undefined);

    // Lấy thông tin số dư từ wallet.php nếu có sessionCookie
    let balance = "0 đ";
    if (sessionCookie) {
      const walletRes = await getDolikeWallet(sessionCookie);
      if (walletRes.success && walletRes.balance) {
        balance = walletRes.balance;
      }
    }

    const user: DolikeUser = {
      email: email.trim(),
      balance,
      token,
    };

    return {
      success: true,
      user,
      sessionCookie,
      token,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Lỗi kết nối máy chủ DoLike";
    return { success: false, error: msg };
  }
}

/**
 * Lấy số dư ví DoLike:
 * GET https://congtingudolike.servehttp.com/api/wallet.php
 */
export async function getDolikeWallet(
  cookie: string,
): Promise<DolikeWalletResponse> {
  try {
    const raw = await runDolikeCurl({
      url: `${DOLIKE_BASE_URL}/api/wallet.php`,
      method: "GET",
      cookie,
      headers: [
        "accept: application/json",
        "cache-control: no-cache",
        `user-agent: ${DOLIKE_USER_AGENT}`,
      ],
    });

    const parsed = JSON.parse(raw);
    const balanceNum =
      parsed?.data?.balance ??
      parsed?.data?.coins ??
      parsed?.balance ??
      parsed?.coins ??
      0;
    const formatted = `${Number(balanceNum).toLocaleString("vi-VN")} đ`;

    return {
      success: true,
      balance: formatted,
      raw: parsed,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Lỗi đọc ví DoLike";
    return { success: false, error: msg };
  }
}

/**
 * Kiểm tra trạng thái phiên DoLike:
 * GET https://congtingudolike.servehttp.com/api/account-auth.php
 */
export async function checkDolikeAuth(
  cookie: string,
  bearerToken?: string,
): Promise<boolean> {
  try {
    const headers = [...DOLIKE_DEFAULT_HEADERS];
    if (bearerToken) {
      headers.push(`authorization: Bearer ${bearerToken}`);
    }
    const raw = await runDolikeCurl({
      url: `${DOLIKE_BASE_URL}/api/account-auth.php`,
      method: "GET",
      cookie,
      headers,
    });
    const parsed = JSON.parse(raw);
    return !!(parsed?.data?.logged_in || parsed?.logged_in);
  } catch {
    return false;
  }
}

/**
 * Sinh x-api-token qua POST /api/session.php trước khi gọi API bảo vệ
 */
export async function getDolikeSessionToken(options: {
  path: string;
  method?: string;
  body?: string;
  cookie?: string;
  bearerToken?: string;
}): Promise<string | null> {
  try {
    const bodyHash = await computeSha256(options.body || "");
    const sessionPayload = {
      path: options.path,
      method: (options.method || "GET").toUpperCase(),
      body_hash: bodyHash,
    };
    const headers = [
      ...DOLIKE_DEFAULT_HEADERS,
      "content-type: application/json",
      `origin: ${DOLIKE_BASE_URL}`,
    ];
    if (options.bearerToken) {
      headers.push(`authorization: Bearer ${options.bearerToken}`);
    }

    const raw = await runDolikeCurl({
      url: `${DOLIKE_BASE_URL}/api/session.php`,
      method: "POST",
      cookie: options.cookie,
      headers,
      body: JSON.stringify(sessionPayload),
    });

    const parsed = JSON.parse(raw);
    return (
      (parsed?.token as string) ||
      (parsed?.["x-api-token"] as string) ||
      (parsed?.data?.token as string) ||
      (parsed?.data?.["x-api-token"] as string) ||
      null
    );
  } catch {
    return null;
  }
}

export interface DolikePlatformAccount {
  id?: string | number;
  platform?: string;
  account_url?: string;
  username?: string;
  account_name?: string;
  name?: string;
  uid?: string;
  status?: string;
  follower_count?: number;
  created_at?: string;
  [key: string]: unknown;
}

/**
 * Lấy danh sách tài khoản đã liên kết trên DoLike:
 * GET https://congtingudolike.servehttp.com/api/platform-accounts.php
 */
export async function getDolikePlatformAccounts(options: {
  cookie?: string;
  bearerToken?: string;
}): Promise<{
  success: boolean;
  accounts: DolikePlatformAccount[];
  error?: string;
}> {
  try {
    const headers = [...DOLIKE_DEFAULT_HEADERS];
    if (options.bearerToken) {
      headers.push(`authorization: Bearer ${options.bearerToken}`);
    }

    const raw = await runDolikeCurl({
      url: `${DOLIKE_BASE_URL}/api/platform-accounts.php`,
      method: "GET",
      cookie: options.cookie,
      headers,
    });

    const parsed = JSON.parse(raw);
    if (parsed.error && !Array.isArray(parsed)) {
      return { success: false, accounts: [], error: String(parsed.error) };
    }

    let list: DolikePlatformAccount[] = [];
    if (Array.isArray(parsed)) {
      list = parsed;
    } else if (Array.isArray(parsed?.data)) {
      list = parsed.data;
    } else if (Array.isArray(parsed?.accounts)) {
      list = parsed.accounts;
    }

    return { success: true, accounts: list };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Lỗi lấy danh sách tài khoản DoLike";
    return { success: false, accounts: [], error: msg };
  }
}

/**
 * Kiểm tra xem tài khoản có hợp lệ trên DoLike không (phân biệt acc đúng và acc sai):
 * POST https://congtingudolike.servehttp.com/api/platform-accounts.php
 * Body: {"action":"preview","platform":"instagram","account_url":"..."}
 */
export async function previewDolikePlatformAccount(options: {
  accountUrl: string;
  platform?: string;
  cookie?: string;
  bearerToken?: string;
}): Promise<{
  success: boolean;
  isValid: boolean;
  data?: unknown;
  error?: string;
}> {
  try {
    const headers = [
      ...DOLIKE_DEFAULT_HEADERS,
      "content-type: application/json",
      `origin: ${DOLIKE_BASE_URL}`,
    ];
    if (options.bearerToken) {
      headers.push(`authorization: Bearer ${options.bearerToken}`);
    }

    const cleanUrl = options.accountUrl.trim().replace(/^@/, "");
    const bodyObj = {
      action: "preview",
      platform: options.platform || "instagram",
      account_url: cleanUrl,
    };

    const raw = await runDolikeCurl({
      url: `${DOLIKE_BASE_URL}/api/platform-accounts.php`,
      method: "POST",
      cookie: options.cookie,
      headers,
      body: JSON.stringify(bodyObj),
    });

    const parsed = JSON.parse(raw);
    if (parsed.error || parsed.status === "error" || parsed.success === false) {
      const errMsg =
        parsed.error || parsed.message || "Tài khoản không hợp lệ trên DoLike";
      return { success: false, isValid: false, error: errMsg, data: parsed };
    }

    return { success: true, isValid: true, data: parsed };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Lỗi kiểm tra tài khoản DoLike";
    return { success: false, isValid: false, error: msg };
  }
}

/**
 * Thêm tài khoản vào DoLike:
 * POST https://congtingudolike.servehttp.com/api/platform-accounts.php
 * Body: {"action":"add","platform":"instagram","account_url":"..."}
 */
export async function addDolikePlatformAccount(options: {
  accountUrl: string;
  platform?: string;
  cookie?: string;
  bearerToken?: string;
  action?: string;
  extraData?: Record<string, unknown>;
}): Promise<{
  success: boolean;
  data?: unknown;
  error?: string;
}> {
  try {
    const headers = [
      ...DOLIKE_DEFAULT_HEADERS,
      "content-type: application/json",
      `origin: ${DOLIKE_BASE_URL}`,
    ];
    if (options.bearerToken) {
      headers.push(`authorization: Bearer ${options.bearerToken}`);
    }

    const cleanUrl = options.accountUrl.trim().replace(/^@/, "");
    const bodyObj = {
      action: options.action || "add",
      platform: options.platform || "instagram",
      account_url: cleanUrl,
      ...(options.extraData || {}),
    };

    const raw = await runDolikeCurl({
      url: `${DOLIKE_BASE_URL}/api/platform-accounts.php`,
      method: "POST",
      cookie: options.cookie,
      headers,
      body: JSON.stringify(bodyObj),
    });

    const parsed = JSON.parse(raw);
    if (parsed.error || parsed.status === "error" || parsed.success === false) {
      const errMsg =
        parsed.error || parsed.message || "Không thể thêm tài khoản vào DoLike";
      return { success: false, error: errMsg, data: parsed };
    }

    return { success: true, data: parsed };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Lỗi thêm tài khoản vào DoLike";
    return { success: false, error: msg };
  }
}

/**
 * Quy trình liên kết tài khoản trọn vẹn:
 * Bước 1: Preview để xác định acc đúng hay acc sai
 * Bước 2: Add tài khoản vào nền tảng DoLike
 */
export async function linkDolikeAccountFull(options: {
  accountUrl: string;
  platform?: string;
  cookie?: string;
  bearerToken?: string;
}): Promise<{
  success: boolean;
  username: string;
  error?: string;
}> {
  const cleanUrl = options.accountUrl.trim().replace(/^@/, "");
  if (!cleanUrl) {
    return {
      success: false,
      username: "",
      error: "Tên tài khoản không được để trống",
    };
  }

  // Bước 1: Preview để xác định acc đúng hay acc sai
  const prevRes = await previewDolikePlatformAccount({
    accountUrl: cleanUrl,
    platform: options.platform || "instagram",
    cookie: options.cookie,
    bearerToken: options.bearerToken,
  });

  if (!prevRes.isValid || !prevRes.success) {
    return {
      success: false,
      username: cleanUrl,
      error:
        prevRes.error ||
        "Tài khoản không hợp lệ (acc sai), vui lòng kiểm tra lại username Instagram",
    };
  }

  // Bước 2: Thêm acc vào DoLike
  const addRes = await addDolikePlatformAccount({
    accountUrl: cleanUrl,
    platform: options.platform || "instagram",
    cookie: options.cookie,
    bearerToken: options.bearerToken,
    action: "add",
    extraData:
      typeof prevRes.data === "object" && prevRes.data
        ? (prevRes.data as Record<string, unknown>)
        : undefined,
  });

  if (!addRes.success) {
    const errText = addRes.error || "";
    if (errText.includes("đã tồn tại") || errText.includes("already")) {
      return { success: true, username: cleanUrl };
    }
    return {
      success: false,
      username: cleanUrl,
      error: errText || "Không thể lưu tài khoản vào DoLike",
    };
  }

  return { success: true, username: cleanUrl };
}

/**
 * Lấy thống kê công việc nền tảng DoLike:
 * GET https://congtingudolike.servehttp.com/api/platform-job-stats.php
 */
export async function getDolikeJobStats(options: {
  cookie?: string;
  bearerToken?: string;
}): Promise<Record<string, unknown> | null> {
  try {
    const headers = [...DOLIKE_DEFAULT_HEADERS];
    if (options.bearerToken) {
      headers.push(`authorization: Bearer ${options.bearerToken}`);
    }
    const raw = await runDolikeCurl({
      url: `${DOLIKE_BASE_URL}/api/platform-job-stats.php`,
      method: "GET",
      cookie: options.cookie,
      headers,
    });
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Lấy thông tin cấu hình DoLike:
 * GET https://congtingudolike.servehttp.com/api/cauhinh.php
 */
export async function getDolikeCauHinh(options: {
  cookie?: string;
  bearerToken?: string;
}): Promise<Record<string, unknown> | null> {
  try {
    const headers = [...DOLIKE_DEFAULT_HEADERS];
    if (options.bearerToken) {
      headers.push(`authorization: Bearer ${options.bearerToken}`);
    }
    const raw = await runDolikeCurl({
      url: `${DOLIKE_BASE_URL}/api/cauhinh.php`,
      method: "GET",
      cookie: options.cookie,
      headers,
    });
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
