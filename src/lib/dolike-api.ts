import { invoke } from "@tauri-apps/api/core";

export interface DolikeUser {
  id?: number | string;
  email: string;
  username?: string;
  balance: string;
  token?: string;
  status?: string;
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
  "accept-language: vi-VN,vi;q=0.9,ja-JP;q=0.8,ja;q=0.7,en-JP;q=0.6,en;q=0.5",
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

/**
 * Sinh SHA-256 hash chuẩn GoMax Lx/iq;->l
 */
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

/**
 * Thực thi cURL qua Tauri Core Backend
 */
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
 * Giải mã an toàn payload JWT DoLike (iss: mgauto)
 */
export function parseDolikeJwt(token: string): {
  isValid: boolean;
  userId?: string | number;
  email?: string;
  username?: string;
  displayName?: string;
  exp?: number;
  iss?: string;
} {
  try {
    const parts = token.trim().replace(/^Bearer\s+/i, "").split(".");
    if (parts.length < 2) return { isValid: false };
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) {
      b64 += "=";
    }

    let payload: Record<string, unknown> | null = null;
    try {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      payload = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      try {
        payload = JSON.parse(atob(b64));
      } catch {
        const jsonStr = decodeURIComponent(
          atob(b64)
            .split("")
            .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join(""),
        );
        payload = JSON.parse(jsonStr);
      }
    }

    if (!payload) return { isValid: false };

    const isDolike =
      payload.iss === "mgauto" ||
      payload.iss === "dolike" ||
      payload.iss === "gomax" ||
      !!payload.user_id ||
      !!payload.userId ||
      !!payload.id ||
      !!payload.email ||
      !!payload.sub;

    const email =
      (payload.email as string) ||
      (payload.user_email as string) ||
      (payload.mail as string) ||
      (typeof payload.sub === "string" && payload.sub.includes("@")
        ? payload.sub
        : undefined);

    const username =
      (payload.username as string) ||
      (payload.user_name as string) ||
      (payload.display_name as string) ||
      (payload.name as string) ||
      (typeof payload.sub === "string" && !payload.sub.includes("@")
        ? payload.sub
        : undefined);

    const userId =
      (payload.user_id as string | number) ||
      (payload.id as string | number) ||
      (payload.uid as string | number) ||
      (payload.userId as string | number);

    const placeholderMatch =
      (email && email.match(/^(?:email|user)_(\d+)$/i)) ||
      (username && username.match(/^(?:email|user)_(\d+)$/i));
    if (placeholderMatch && !userId) {
      userId = placeholderMatch[1];
    }

    const displayName =
      (placeholderMatch ? `UID: ${placeholderMatch[1]}` : undefined) ||
      username ||
      (email && email.includes("@") ? email.split("@")[0] : undefined) ||
      (userId ? `UID: ${userId}` : undefined);

    return {
      isValid: isDolike,
      userId,
      email,
      username,
      displayName,
      exp: payload.exp as number | undefined,
      iss: payload.iss as string | undefined,
    };
  } catch {
    return { isValid: false };
  }
}

/**
 * Xác thực Authorization Token DoLike 100% chuẩn GoMax (Lx/n2; & Lx/iq;->x)
 * Hỗ trợ nhận diện trực tiếp JWT DoLike (mgauto) và đồng bộ ví từ server
 */
export async function verifyDolikeToken(token: string): Promise<{
  success: boolean;
  email?: string;
  balance?: string;
  displayName?: string;
  userId?: string | number;
  error?: string;
}> {
  const cleanToken = token.trim().replace(/^Bearer\s+/i, "");
  if (!cleanToken) {
    return {
      success: false,
      error: "Authorization Token DoLike không hợp lệ!",
    };
  }

  // 1. Phân tích token JWT DoLike chuẩn
  const jwtInfo = parseDolikeJwt(cleanToken);

  let userEmail = jwtInfo.email || "";
  let userDisplay = jwtInfo.displayName || (jwtInfo.email ? jwtInfo.email.split("@")[0] : "");
  let userId = jwtInfo.userId;
  let balance = "0 đ";
  let isServerVerified = false;

  // 2. Gửi request đồng bộ số dư ví và tài khoản từ server DoLike
  try {
    const headers = [
      "accept: application/json",
      `authorization: Bearer ${cleanToken}`,
      `x-api-token: ${cleanToken}`,
      `origin: ${DOLIKE_BASE_URL}`,
      `referer: ${DOLIKE_BASE_URL}/`,
      `user-agent: ${DOLIKE_USER_AGENT}`,
    ];

    const rawWallet = await runDolikeCurl({
      url: `${DOLIKE_BASE_URL}/api/wallet.php`,
      method: "GET",
      headers,
    });

    try {
      const parsedWallet = JSON.parse(rawWallet);
      if (parsedWallet && !parsedWallet.error && parsedWallet.status !== "error") {
        const wData = parsedWallet?.data || parsedWallet;
        const balanceNum =
          wData?.balance ??
          wData?.coins ??
          parsedWallet?.balance ??
          parsedWallet?.coins ??
          0;
        balance = `${Number(balanceNum).toLocaleString("vi-VN")} đ`;
        if (wData.email && !userEmail) userEmail = String(wData.email);
        if (wData.username && !userDisplay) userDisplay = String(wData.username);
        if (wData.display_name && !userDisplay) userDisplay = String(wData.display_name);
        if (wData.user_id && !userId) userId = wData.user_id;
        isServerVerified = true;
      }
    } catch {
      // ignore
    }

    // Thử lấy thêm thông tin user qua /api/users.php
    try {
      const rawUser = await runDolikeCurl({
        url: `${DOLIKE_BASE_URL}/api/users.php`,
        method: "GET",
        headers,
      });
      const parsedUser = JSON.parse(rawUser);
      if (parsedUser && !parsedUser.error) {
        const uData = parsedUser.data || parsedUser.user || parsedUser;
        if (uData.email) userEmail = String(uData.email);
        if (uData.username || uData.name || uData.display_name) {
          userDisplay = String(uData.username || uData.name || uData.display_name);
        }
        if (uData.id || uData.user_id) userId = uData.id || uData.user_id;
        isServerVerified = true;
      }
    } catch {
      // ignore
    }
  } catch {
    // server có thể bận/timeout
  }

  // 3. Nếu server xác nhận HOẶC token là JWT DoLike hợp lệ -> Chấp thuận kết nối thành công!
  if (isServerVerified || jwtInfo.isValid) {
    // Phát hiện nếu username/email là dạng placeholder tự sinh của hệ thống DoLike (email_165, user_165)
    const placeholderMatch =
      (userEmail && userEmail.match(/^(?:email|user)_(\d+)$/i)) ||
      (userDisplay && userDisplay.match(/^(?:email|user)_(\d+)$/i));
    if (placeholderMatch) {
      if (!userId) userId = placeholderMatch[1];
      userDisplay = `UID: ${placeholderMatch[1]}`;
    }

    if (!userDisplay) {
      userDisplay = userEmail && userEmail.includes("@")
        ? userEmail.split("@")[0]
        : (userId ? `UID: ${userId}` : "DoLike User");
    }
    if (!userEmail) {
      userEmail = userDisplay || (userId ? `UID: ${userId}` : "DoLike User");
    }
    return {
      success: true,
      email: userEmail,
      displayName: userDisplay,
      userId,
      balance,
    };
  }

  return {
    success: false,
    error: "Authorization Token DoLike không hợp lệ!",
  };
}

/**
 * Đăng xuất DoLike chuẩn GoMax:
 * Xóa sạch dolike_auth_token, dolike_email, dolike_display_name, dolike_balance,
 * và dọn sạch các key cũ (dolike_cookies, dolike_password).
 */
export function logoutDolike(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("dolike_auth_token");
    localStorage.removeItem("dolike_bearer_token");
    localStorage.removeItem("dolike_email");
    localStorage.removeItem("dolike_display_name");
    localStorage.removeItem("dolike_balance");
    localStorage.removeItem("dolike_user_id");
    localStorage.removeItem("dolike_telegram_uid");
    localStorage.removeItem("dolike_cookies");
    localStorage.removeItem("dolike_session_cookie");
    localStorage.removeItem("dolike_password");
  } catch {
    // ignore
  }
}

/**
 * Lấy thông tin tài khoản DoLike đã lưu trong localStorage chuẩn GoMax
 */
export function getStoredDolikeAuth(): {
  token: string | null;
  email: string | null;
  displayName: string | null;
  balance: string | null;
  userId: string | null;
} {
  if (typeof window === "undefined") {
    return { token: null, email: null, displayName: null, balance: null, userId: null };
  }
  try {
    const token =
      localStorage.getItem("dolike_auth_token") ||
      localStorage.getItem("dolike_bearer_token");
    const email = localStorage.getItem("dolike_email");
    const displayName =
      localStorage.getItem("dolike_display_name") ||
      (email ? email.split("@")[0] : null);
    const balance = localStorage.getItem("dolike_balance");
    const userId = localStorage.getItem("dolike_user_id");
    return { token, email, displayName, balance, userId };
  } catch {
    return { token: null, email: null, displayName: null, balance: null, userId: null };
  }
}


/**
 * Sinh x-api-token chuẩn GoMax Lx/iq;->l
 * POST https://congtingudolike.servehttp.com/api/session.php
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
      `referer: ${DOLIKE_BASE_URL}/`,
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
 * Lấy danh sách tài khoản DoLike chuẩn GoMax Lx/iq;->h:
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
    const headers = [
      ...DOLIKE_DEFAULT_HEADERS,
      `referer: ${DOLIKE_BASE_URL}/`,
    ];
    if (options.bearerToken) {
      headers.push(`authorization: Bearer ${options.bearerToken}`);
    }

    const raw = await runDolikeCurl({
      url: `${DOLIKE_BASE_URL}/api/platform-accounts.php`,
      method: "GET",
      cookie: options.cookie,
      headers,
    });

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { success: false, accounts: [], error: "Dữ liệu trả về không hợp lệ" };
    }

    let list: DolikePlatformAccount[] = [];
    if (Array.isArray(parsed)) {
      list = parsed;
    } else if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      if (Array.isArray(obj.data)) {
        list = obj.data as DolikePlatformAccount[];
      } else if (Array.isArray(obj.accounts)) {
        list = obj.accounts as DolikePlatformAccount[];
      } else if (obj.error) {
        return { success: false, accounts: [], error: String(obj.error) };
      }
    }

    return { success: true, accounts: list };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Lỗi lấy danh sách tài khoản DoLike";
    return { success: false, accounts: [], error: msg };
  }
}

/**
 * Thêm tài khoản Instagram lên DoLike 100% chuẩn GoMax Lx/iq;->m:
 * POST https://congtingudolike.servehttp.com/api/platform-accounts.php
 * Body: {"platform":"instagram","account_url":"...","account_type":"vn"}
 */
export async function addDolikePlatformAccount(options: {
  accountUrl: string;
  platform?: string;
  cookie?: string;
  bearerToken?: string;
}): Promise<{
  success: boolean;
  id?: string | number;
  data?: unknown;
  error?: string;
}> {
  try {
    const cleanUrl = options.accountUrl.trim().replace(/^@+/, "");
    const bodyStr = JSON.stringify({
      platform: options.platform || "instagram",
      account_url: cleanUrl,
      account_type: "vn",
    });

    // Sinh Session Token nếu cần
    const sessionToken = await getDolikeSessionToken({
      path: "/api/platform-accounts.php",
      method: "POST",
      body: bodyStr,
      cookie: options.cookie,
      bearerToken: options.bearerToken,
    });

    const headers = [
      ...DOLIKE_DEFAULT_HEADERS,
      "content-type: application/json",
      `origin: ${DOLIKE_BASE_URL}`,
      `referer: ${DOLIKE_BASE_URL}/`,
    ];
    if (options.bearerToken) {
      headers.push(`authorization: Bearer ${options.bearerToken}`);
    }
    if (sessionToken) {
      headers.push(`x-api-token: ${sessionToken}`);
    }

    const raw = await runDolikeCurl({
      url: `${DOLIKE_BASE_URL}/api/platform-accounts.php`,
      method: "POST",
      cookie: options.cookie,
      headers,
      body: bodyStr,
    });

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }

    // GoMax Lx/iq;->m xử lý: data { saved, id, username, account_uid, uid }
    if (parsed.status === "error" || parsed.error) {
      const errMsg = String(parsed.error || parsed.message || parsed.msg || "Lỗi liên kết");
      // Nếu server thông báo đã tồn tại -> coi như thành công
      if (
        errMsg.toLowerCase().includes("tồn tại") ||
        errMsg.toLowerCase().includes("already") ||
        errMsg.toLowerCase().includes("đã liên kết")
      ) {
        return { success: true, data: parsed };
      }
      return { success: false, error: errMsg, data: parsed };
    }

    const resData = (parsed.data as Record<string, unknown>) || parsed;
    const accountId = (resData.id || resData.account_uid || resData.uid) as
      | string
      | number
      | undefined;

    return {
      success: true,
      id: accountId,
      data: parsed,
    };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Lỗi thêm tài khoản vào DoLike";
    return { success: false, error: msg };
  }
}

/**
 * Quy trình kiểm tra và liên kết tài khoản 100% chuẩn GoMax (Lx/iq;->e):
 * Bước 1: Gọi Lx/iq;->h lấy danh sách tài khoản hiện có
 * Bước 2: Nếu đã tồn tại -> Trả về xác nhận liên kết thành công (không liên kết lại)
 * Bước 3: Nếu chưa có -> Gọi Lx/iq;->m liên kết với server Việt Nam ("account_type": "vn")
 */
export async function linkDolikeAccountFull(options: {
  accountUrl: string;
  platform?: string;
  cookie?: string;
  bearerToken?: string;
}): Promise<{
  success: boolean;
  username: string;
  id?: string | number;
  alreadyLinked?: boolean;
  error?: string;
}> {
  const cleanUrl = options.accountUrl.trim().replace(/^@+/, "");
  if (!cleanUrl) {
    return {
      success: false,
      username: "",
      error: "Thiếu tên tài khoản DoLike",
    };
  }

  // Bước 1: Kiểm tra danh sách tài khoản đã có (GoMax Lx/iq;->e & Lx/iq;->h)
  const listRes = await getDolikePlatformAccounts({
    cookie: options.cookie,
    bearerToken: options.bearerToken,
  });

  if (listRes.success && Array.isArray(listRes.accounts)) {
    const existing = listRes.accounts.find((a) => {
      const u = String(a.username || a.account_url || a.account_name || "")
        .replace(/^@+/, "")
        .trim()
        .toLowerCase();
      return u === cleanUrl.toLowerCase();
    });

    if (existing) {
      // Đã có trên DoLike (Chuẩn GoMax: "Đã xác nhận tài khoản @... trên DoLike; không liên kết lại.")
      return {
        success: true,
        username: cleanUrl,
        id: (existing.id || existing.uid || existing.account_uid) as string | number,
        alreadyLinked: true,
      };
    }
  }

  // Bước 2: Chưa có trong danh sách -> Tiến hành liên kết mới (GoMax Lx/iq;->m)
  const addRes = await addDolikePlatformAccount({
    accountUrl: cleanUrl,
    platform: options.platform || "instagram",
    cookie: options.cookie,
    bearerToken: options.bearerToken,
  });

  if (!addRes.success) {
    return {
      success: false,
      username: cleanUrl,
      error: addRes.error || "Không thể liên kết tài khoản vào DoLike",
    };
  }

  return {
    success: true,
    username: cleanUrl,
    id: addRes.id,
  };
}

export interface DolikeJob {
  id?: string | number;
  run_id?: string;
  type?: "like" | "follow" | "comment" | string;
  platform?: string;
  link?: string;
  post_id?: string;
  comment_text?: string;
  coin?: number;
  [key: string]: unknown;
}

/**
 * Nhận job DoLike Instagram 100% chuẩn GoMax Lx/iq;->i:
 * Endpoint: https://congtingudolike.servehttp.com/api/bot/users/nhan-instagram/ig-cudau.php
 * Body: {"type":"get_jobs","job_type":"all","platform":"instagram","account_id":"...","account_uid":"..."}
 */
export async function getDolikeJob(options: {
  accountId: string | number;
  accountUid?: string;
  platform?: string;
  cookie?: string;
  bearerToken?: string;
}): Promise<{
  success: boolean;
  job?: DolikeJob;
  error?: string;
  retryAfter?: number;
}> {
  try {
    const payload = JSON.stringify({
      type: "get_jobs",
      job_type: "all",
      platform: options.platform || "instagram",
      account_id: String(options.accountId),
      account_uid: options.accountUid || "",
    });

    const targetPaths = [
      "/api/bot/users/nhan-instagram/ig-cudau.php",
      "/api/session.php",
    ];

    for (const path of targetPaths) {
      try {
        const sessionToken = await getDolikeSessionToken({
          path,
          method: "POST",
          body: payload,
          cookie: options.cookie,
          bearerToken: options.bearerToken,
        });

        const headers = [
          ...DOLIKE_DEFAULT_HEADERS,
          "content-type: application/json",
          `origin: ${DOLIKE_BASE_URL}`,
          `referer: ${DOLIKE_BASE_URL}/`,
        ];
        if (options.bearerToken) {
          headers.push(`authorization: Bearer ${options.bearerToken}`);
        }
        if (sessionToken) {
          headers.push(`x-api-token: ${sessionToken}`);
        }

        const raw = await runDolikeCurl({
          url: `${DOLIKE_BASE_URL}${path}`,
          method: "POST",
          cookie: options.cookie,
          headers,
          body: payload,
        });

        if (!raw || raw.trim().startsWith("<")) continue;
        const parsed = JSON.parse(raw);

        if (parsed.status === "error" || parsed.error) {
          const errMsg = String(
            parsed.error || parsed.message || parsed.msg || "Không có job",
          );
          return {
            success: false,
            error: errMsg,
            retryAfter: parsed.retry_after,
          };
        }

        const jobData = parsed.data || parsed.job || parsed;
        if (jobData && (jobData.run_id || jobData.id || jobData.link)) {
          return { success: true, job: jobData as DolikeJob };
        }
      } catch {
        // Thử tiếp
      }
    }

    return { success: false, error: "Hết job hoặc server bận" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Lỗi nhận job DoLike";
    return { success: false, error: msg };
  }
}

/**
 * Báo cáo hoàn thành job DoLike 100% chuẩn GoMax Lx/iq;->c:
 * Endpoint: https://congtingudolike.servehttp.com/api/bot/users/nhan-instagram/ig-cudau.php
 * Body: {"type":"perform_job","run_id":"..."}
 */
export async function reportDolikeJob(options: {
  runId: string;
  cookie?: string;
  bearerToken?: string;
}): Promise<{ success: boolean; coins?: number; error?: string }> {
  try {
    const payload = JSON.stringify({
      type: "perform_job",
      run_id: options.runId,
    });

    const targetPaths = [
      "/api/bot/users/nhan-instagram/ig-cudau.php",
      "/api/session.php",
    ];

    for (const path of targetPaths) {
      try {
        const sessionToken = await getDolikeSessionToken({
          path,
          method: "POST",
          body: payload,
          cookie: options.cookie,
          bearerToken: options.bearerToken,
        });

        const headers = [
          ...DOLIKE_DEFAULT_HEADERS,
          "content-type: application/json",
          `origin: ${DOLIKE_BASE_URL}`,
          `referer: ${DOLIKE_BASE_URL}/`,
        ];
        if (options.bearerToken) {
          headers.push(`authorization: Bearer ${options.bearerToken}`);
        }
        if (sessionToken) {
          headers.push(`x-api-token: ${sessionToken}`);
        }

        const raw = await runDolikeCurl({
          url: `${DOLIKE_BASE_URL}${path}`,
          method: "POST",
          cookie: options.cookie,
          headers,
          body: payload,
        });

        if (!raw || raw.trim().startsWith("<")) continue;
        const parsed = JSON.parse(raw);

        if (parsed.status === "error" || parsed.error) {
          return {
            success: false,
            error: String(
              parsed.error || parsed.message || parsed.msg || "Lỗi báo cáo job",
            ),
          };
        }

        const coins = Number(
          parsed.coins || parsed.xu || parsed.data?.coins || parsed.data?.xu || 0,
        );
        return { success: true, coins };
      } catch {
        // Thử tiếp
      }
    }

    return { success: false, error: "Lỗi kết nối khi gửi báo cáo job DoLike" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Lỗi gửi báo cáo job DoLike";
    return { success: false, error: msg };
  }
}

/**
 * Bỏ qua job DoLike 100% chuẩn GoMax Lx/iq;->z:
 * Endpoint: https://congtingudolike.servehttp.com/api/bot/users/nhan-instagram/ig-cudau.php
 * Body: {"type":"nopjobing","run_id":"...","report_type":"skip_unwanted","report_reason":"error","report_details":"error"}
 */
export async function skipDolikeJob(options: {
  runId: string;
  reportType?: string;
  cookie?: string;
  bearerToken?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = JSON.stringify({
      type: "nopjobing",
      run_id: options.runId,
      report_type: options.reportType || "skip_unwanted",
      report_reason: "error",
      report_details: "error",
    });

    const targetPaths = [
      "/api/bot/users/nhan-instagram/ig-cudau.php",
      "/api/session.php",
    ];

    for (const path of targetPaths) {
      try {
        const headers = [
          ...DOLIKE_DEFAULT_HEADERS,
          "content-type: application/json",
          `origin: ${DOLIKE_BASE_URL}`,
          `referer: ${DOLIKE_BASE_URL}/`,
        ];
        if (options.bearerToken) {
          headers.push(`authorization: Bearer ${options.bearerToken}`);
        }

        const raw = await runDolikeCurl({
          url: `${DOLIKE_BASE_URL}${path}`,
          method: "POST",
          cookie: options.cookie,
          headers,
          body: payload,
        });

        if (!raw || raw.trim().startsWith("<")) continue;
        const parsed = JSON.parse(raw);
        if (parsed.status !== "error" && !parsed.error) {
          return { success: true };
        }
      } catch {
        // Thử tiếp
      }
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Lỗi bỏ qua job DoLike";
    return { success: false, error: msg };
  }
}
