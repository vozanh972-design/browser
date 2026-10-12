/**
 * ============================================================================
 * FULL LOGIC DOLIKE INSTAGRAM - TRÍCH XUẤT 100% TỪ GOMAX 1.2.4 (CLASSES.DEX)
 * ============================================================================
 * 
 * Nguồn mã nguồn Smali:
 * - Lx/iq;                                              (DolikeApi Client)
 * - Lx/gu1;                                             (DolikeIgAutomation Runner)
 * - Lcom/hoanguyen/gomax/ui/dolike/DolikeWebLoginActivity; (WebView Đăng nhập chính chủ)
 * - Lx/n2;                                              (Dialog Cấu hình & Xác nhận Token)
 * 
 * Tuyệt đối không phụ thuộc vào bất kỳ logic bên ngoài hay module nào khác (XSMM, NVC, Facebook).
 */

export const DOLIKE_BASE_URL = "https://congtingudolike.servehttp.com";
export const DOLIKE_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36";

/**
 * Kho câu bình luận mẫu chuẩn 100% từ GoMax Lx/gu1;
 * Sử dụng khi DoLike không trả sẵn nội dung comment trong job
 */
export const GOMAX_DOLIKE_DEFAULT_COMMENTS = [
  "Thích quá ạ",
  "Dễ thương quá nè ❤️",
  "❤️",
  "Tuyệt vời quá!",
  "Xinh quá nè",
  "Đẹp quá",
];

// ============================================================================
// 1. PHẦN ĐĂNG NHẬP, GIẢI MÃ JWT & XÁC THỰC TOKEN (Lx/n2; & Lx/iq;->x)
// ============================================================================

export interface DolikeJwtPayload {
  isValid: boolean;
  userId?: string | number;
  email?: string;
  exp?: number;
  iss?: string;
}

/**
 * Giải mã an toàn payload JWT của DoLike
 * Token DoLike hợp lệ luôn có iss là "mgauto", chứa user_id và email.
 */
export function parseDolikeJwt(token: string): DolikeJwtPayload {
  try {
    const clean = token.trim().replace(/^Bearer\s+/i, "");
    const parts = clean.split(".");
    if (parts.length < 2) return { isValid: false };

    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    if (pad === 2) b64 += "==";
    else if (pad === 3) b64 += "=";

    const jsonStr = decodeURIComponent(
      atob(b64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    const payload = JSON.parse(jsonStr);

    const isDolike =
      payload.iss === "mgauto" ||
      payload.iss === "dolike" ||
      !!payload.user_id ||
      !!payload.email;

    return {
      isValid: isDolike,
      userId: payload.user_id || payload.id || payload.uid,
      email: payload.email,
      exp: payload.exp,
      iss: payload.iss,
    };
  } catch {
    return { isValid: false };
  }
}

/**
 * Hàm thực thi HTTP Request (sử dụng Tauri cURL hoặc Browser fetch)
 */
export async function executeDolikeRequest(options: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<string> {
  const isTauri =
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

  const headersList: string[] = [];
  if (options.headers) {
    for (const [k, v] of Object.entries(options.headers)) {
      headersList.push(`${k}: ${v}`);
    }
  }

  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<string>("curl_request", {
      url: options.url,
      method: options.method ?? "GET",
      headers: headersList.length > 0 ? headersList : null,
      body: options.body ?? null,
      cookie: null,
      proxy: null,
      includeHeaders: false,
      timeoutSecs: 20,
      formFields: null,
    });
  }

  const res = await fetch(options.url, {
    method: options.method ?? "GET",
    headers: options.headers,
    body: options.body,
  });
  return await res.text();
}

/**
 * Xác thực Authorization Token DoLike chuẩn GoMax Lx/n2;
 * Gọi kiểm tra qua /api/wallet.php và /api/users.php
 */
export async function verifyDolikeToken(token: string): Promise<{
  success: boolean;
  email?: string;
  displayName?: string;
  userId?: string | number;
  balance?: string;
  error?: string;
}> {
  const cleanToken = token.trim().replace(/^Bearer\s+/i, "");
  if (!cleanToken) {
    return { success: false, error: "Authorization Token DoLike không hợp lệ!" };
  }

  const jwt = parseDolikeJwt(cleanToken);
  let email = jwt.email || "dolike_user";
  let displayName = jwt.email ? jwt.email.split("@")[0] : "DoLike User";
  let balance = "0 đ";
  let isVerified = false;

  const headers: Record<string, string> = {
    accept: "application/json",
    authorization: `Bearer ${cleanToken}`,
    "x-api-token": cleanToken,
    origin: DOLIKE_BASE_URL,
    referer: `${DOLIKE_BASE_URL}/`,
    "user-agent": DOLIKE_USER_AGENT,
  };

  try {
    const rawWallet = await executeDolikeRequest({
      url: `${DOLIKE_BASE_URL}/api/wallet.php`,
      method: "GET",
      headers,
    });
    const parsedWallet = JSON.parse(rawWallet);
    if (parsedWallet && !parsedWallet.error && parsedWallet.status !== "error") {
      const balanceNum =
        parsedWallet?.data?.balance ??
        parsedWallet?.data?.coins ??
        parsedWallet?.balance ??
        0;
      balance = `${Number(balanceNum).toLocaleString("vi-VN")} đ`;
      isVerified = true;
    }
  } catch {
    // ignore
  }

  try {
    const rawUser = await executeDolikeRequest({
      url: `${DOLIKE_BASE_URL}/api/users.php`,
      method: "GET",
      headers,
    });
    const parsedUser = JSON.parse(rawUser);
    if (parsedUser && !parsedUser.error) {
      const uData = parsedUser.data || parsedUser.user || parsedUser;
      if (uData.email) email = String(uData.email);
      if (uData.username || uData.name) displayName = String(uData.username || uData.name);
      isVerified = true;
    }
  } catch {
    // ignore
  }

  if (isVerified || jwt.isValid) {
    return {
      success: true,
      email,
      displayName,
      userId: jwt.userId,
      balance,
    };
  }

  return { success: false, error: "Authorization Token DoLike không hợp lệ!" };
}

// ============================================================================
// 2. PHẦN KIỂM TRA & THÊM TÀI KHOẢN INSTAGRAM (Lx/iq;->e, Lx/iq;->h, Lx/iq;->m)
// ============================================================================

export interface DolikePlatformAccount {
  id?: string | number;
  platform?: string;
  account_url?: string;
  username?: string;
  status?: string;
  [key: string]: unknown;
}

/**
 * Lấy danh sách tài khoản DoLike hiện có (Lx/iq;->h)
 * GET https://congtingudolike.servehttp.com/api/platform-accounts.php
 */
export async function getDolikePlatformAccounts(token: string): Promise<{
  success: boolean;
  accounts: DolikePlatformAccount[];
  error?: string;
}> {
  try {
    const cleanToken = token.trim().replace(/^Bearer\s+/i, "");
    const raw = await executeDolikeRequest({
      url: `${DOLIKE_BASE_URL}/api/platform-accounts.php`,
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${cleanToken}`,
        "x-api-token": cleanToken,
        referer: `${DOLIKE_BASE_URL}/`,
        "user-agent": DOLIKE_USER_AGENT,
      },
    });

    const parsed = JSON.parse(raw);
    let list: DolikePlatformAccount[] = [];
    if (Array.isArray(parsed)) list = parsed;
    else if (Array.isArray(parsed?.data)) list = parsed.data;
    else if (Array.isArray(parsed?.accounts)) list = parsed.accounts;
    else if (parsed?.error) return { success: false, accounts: [], error: String(parsed.error) };

    return { success: true, accounts: list };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Lỗi lấy danh sách nick DoLike";
    return { success: false, accounts: [], error: msg };
  }
}

/**
 * Thêm nick Instagram mới lên DoLike (Lx/iq;->m)
 * POST https://congtingudolike.servehttp.com/api/platform-accounts.php
 * Body: {"platform":"instagram","account_url":cleanUrl,"account_type":"vn"}
 */
export async function addDolikePlatformAccount(
  accountUrl: string,
  token: string,
): Promise<{
  success: boolean;
  id?: string | number;
  error?: string;
}> {
  try {
    const cleanToken = token.trim().replace(/^Bearer\s+/i, "");
    const cleanUrl = accountUrl.trim().replace(/^@+/, "");

    const bodyStr = JSON.stringify({
      platform: "instagram",
      account_url: cleanUrl,
      account_type: "vn",
    });

    const raw = await executeDolikeRequest({
      url: `${DOLIKE_BASE_URL}/api/platform-accounts.php`,
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${cleanToken}`,
        "x-api-token": cleanToken,
        origin: DOLIKE_BASE_URL,
        referer: `${DOLIKE_BASE_URL}/`,
        "user-agent": DOLIKE_USER_AGENT,
      },
      body: bodyStr,
    });

    const parsed = JSON.parse(raw);

    // Xử lý khi server báo lỗi
    if (parsed.status === "error" || parsed.error) {
      const errMsg = String(parsed.error || parsed.message || parsed.msg || "Lỗi liên kết");
      // Nếu đã tồn tại -> coi như liên kết thành công (GoMax logic)
      if (
        errMsg.toLowerCase().includes("tồn tại") ||
        errMsg.toLowerCase().includes("already") ||
        errMsg.toLowerCase().includes("đã liên kết")
      ) {
        return { success: true };
      }
      return { success: false, error: errMsg };
    }

    const resData = parsed.data || parsed;
    const accountId = resData.id || resData.account_uid || resData.uid;

    return { success: true, id: accountId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Lỗi thêm nick DoLike";
    return { success: false, error: msg };
  }
}

/**
 * Quy trình kiểm tra & liên kết tài khoản chuẩn 100% GoMax (Lx/iq;->e):
 * Bước 1: Lấy danh sách tài khoản hiện có (Lx/iq;->h).
 * Bước 2: Nếu đã tồn tại -> Trả về thành công ngay, không liên kết lại.
 * Bước 3: Nếu chưa có -> Gửi POST liên kết (Lx/iq;->m). Phân biệt acc đúng vs acc sai.
 */
export async function linkDolikeAccountFull(
  accountUrl: string,
  token: string,
): Promise<{
  success: boolean;
  username: string;
  id?: string | number;
  alreadyLinked?: boolean;
  error?: string;
}> {
  const cleanUrl = accountUrl.trim().replace(/^@+/, "");
  if (!cleanUrl) {
    return { success: false, username: "", error: "Thiếu tên tài khoản DoLike" };
  }

  // Bước 1 & 2: Kiểm tra nick đã có trên DoLike chưa
  const listRes = await getDolikePlatformAccounts(token);
  if (listRes.success && Array.isArray(listRes.accounts)) {
    const existing = listRes.accounts.find((a) => {
      const u = String(a.username || a.account_url || "")
        .replace(/^@+/, "")
        .trim()
        .toLowerCase();
      return u === cleanUrl.toLowerCase();
    });

    if (existing) {
      return {
        success: true,
        username: cleanUrl,
        id: (existing.id || existing.uid) as string | number,
        alreadyLinked: true,
      };
    }
  }

  // Bước 3: Chưa có -> gửi yêu cầu liên kết mới
  const addRes = await addDolikePlatformAccount(cleanUrl, token);
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

// ============================================================================
// 3. PHẦN SINH X-API-TOKEN, NHẬN JOB, BÁO CÁO & BỎ QUA JOB (Lx/iq; & Lx/gu1;)
// ============================================================================

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
      // ignore
    }
  }
  return "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
}

/**
 * Ký token bảo mật x-api-token qua POST /api/session.php (Lx/iq;->l)
 */
export async function getDolikeSessionToken(options: {
  path: string;
  method?: string;
  body?: string;
  token?: string;
}): Promise<string | null> {
  try {
    const cleanToken = (options.token || "").trim().replace(/^Bearer\s+/i, "");
    const bodyHash = await computeSha256(options.body || "");
    const sessionPayload = JSON.stringify({
      path: options.path,
      method: (options.method || "GET").toUpperCase(),
      body_hash: bodyHash,
    });

    const raw = await executeDolikeRequest({
      url: `${DOLIKE_BASE_URL}/api/session.php`,
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${cleanToken}`,
        origin: DOLIKE_BASE_URL,
        referer: `${DOLIKE_BASE_URL}/`,
        "user-agent": DOLIKE_USER_AGENT,
      },
      body: sessionPayload,
    });

    const parsed = JSON.parse(raw);
    return parsed?.token || parsed?.["x-api-token"] || parsed?.data?.token || null;
  } catch {
    return null;
  }
}

/**
 * Nhận job DoLike Instagram chuẩn GoMax Lx/iq;->i
 * POST https://congtingudolike.servehttp.com/api/bot/users/nhan-instagram/ig-cudau.php
 */
export async function getDolikeJob(options: {
  accountId: string | number;
  accountUid?: string;
  token: string;
}): Promise<{
  success: boolean;
  job?: DolikeJob;
  retryAfter?: number;
  error?: string;
}> {
  try {
    const cleanToken = options.token.trim().replace(/^Bearer\s+/i, "");
    const payload = JSON.stringify({
      type: "get_jobs",
      job_type: "all",
      platform: "instagram",
      account_id: String(options.accountId),
      account_uid: options.accountUid || "",
    });

    const sessionToken = await getDolikeSessionToken({
      path: "/api/bot/users/nhan-instagram/ig-cudau.php",
      method: "POST",
      body: payload,
      token: cleanToken,
    });

    const headers: Record<string, string> = {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${cleanToken}`,
      "x-api-token": sessionToken || cleanToken,
      origin: DOLIKE_BASE_URL,
      referer: `${DOLIKE_BASE_URL}/`,
      "user-agent": DOLIKE_USER_AGENT,
    };

    const raw = await executeDolikeRequest({
      url: `${DOLIKE_BASE_URL}/api/bot/users/nhan-instagram/ig-cudau.php`,
      method: "POST",
      headers,
      body: payload,
    });

    const parsed = JSON.parse(raw);

    // Hết job hoặc server báo cooldown
    if (parsed.status === "error" || parsed.error) {
      return {
        success: false,
        error: String(parsed.error || parsed.message || "Hết job hoặc server bận"),
        retryAfter: parsed.retry_after,
      };
    }

    const jobData = parsed.data || parsed.job || parsed;
    if (jobData && (jobData.run_id || jobData.id || jobData.link)) {
      return { success: true, job: jobData as DolikeJob };
    }

    return { success: false, error: "Không tìm thấy dữ liệu job hợp lệ" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Lỗi nhận job DoLike";
    return { success: false, error: msg };
  }
}

/**
 * Báo cáo hoàn thành job DoLike chuẩn GoMax Lx/iq;->c
 * POST https://congtingudolike.servehttp.com/api/bot/users/nhan-instagram/ig-cudau.php
 * Body: {"type":"perform_job","run_id":run_id}
 */
export async function reportDolikeJob(options: {
  runId: string;
  token: string;
}): Promise<{
  success: boolean;
  coins?: number;
  error?: string;
}> {
  try {
    const cleanToken = options.token.trim().replace(/^Bearer\s+/i, "");
    const payload = JSON.stringify({
      type: "perform_job",
      run_id: options.runId,
    });

    const sessionToken = await getDolikeSessionToken({
      path: "/api/bot/users/nhan-instagram/ig-cudau.php",
      method: "POST",
      body: payload,
      token: cleanToken,
    });

    const raw = await executeDolikeRequest({
      url: `${DOLIKE_BASE_URL}/api/bot/users/nhan-instagram/ig-cudau.php`,
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${cleanToken}`,
        "x-api-token": sessionToken || cleanToken,
        origin: DOLIKE_BASE_URL,
        referer: `${DOLIKE_BASE_URL}/`,
        "user-agent": DOLIKE_USER_AGENT,
      },
      body: payload,
    });

    const parsed = JSON.parse(raw);
    if (parsed.status === "error" || parsed.error) {
      return {
        success: false,
        error: String(parsed.error || parsed.message || "Lỗi báo cáo job"),
      };
    }

    const coins = Number(
      parsed.coins || parsed.xu || parsed.data?.coins || parsed.data?.xu || 50,
    );
    return { success: true, coins };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Lỗi gửi báo cáo job DoLike";
    return { success: false, error: msg };
  }
}

/**
 * Bỏ qua job DoLike khi gặp lỗi tương tác chuẩn GoMax Lx/iq;->z
 * POST https://congtingudolike.servehttp.com/api/bot/users/nhan-instagram/ig-cudau.php
 * Body: {"type":"nopjobing","run_id":run_id,"report_type":"skip_unwanted","report_reason":"error","report_details":"error"}
 */
export async function skipDolikeJob(options: {
  runId: string;
  reportType?: string;
  token: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanToken = options.token.trim().replace(/^Bearer\s+/i, "");
    const payload = JSON.stringify({
      type: "nopjobing",
      run_id: options.runId,
      report_type: options.reportType || "skip_unwanted",
      report_reason: "error",
      report_details: "error",
    });

    await executeDolikeRequest({
      url: `${DOLIKE_BASE_URL}/api/bot/users/nhan-instagram/ig-cudau.php`,
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${cleanToken}`,
        "x-api-token": cleanToken,
        origin: DOLIKE_BASE_URL,
        referer: `${DOLIKE_BASE_URL}/`,
        "user-agent": DOLIKE_USER_AGENT,
      },
      body: payload,
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Lỗi bỏ qua job DoLike";
    return { success: false, error: msg };
  }
}
