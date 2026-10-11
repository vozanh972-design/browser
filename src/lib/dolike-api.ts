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
        "accept: application/json",
        "content-type: application/json",
        `origin: ${DOLIKE_BASE_URL}`,
        "cache-control: no-cache",
        "pragma: no-cache",
        `user-agent: ${DOLIKE_USER_AGENT}`,
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
    };

    return {
      success: true,
      user,
      sessionCookie,
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
export async function checkDolikeAuth(cookie: string): Promise<boolean> {
  try {
    const raw = await runDolikeCurl({
      url: `${DOLIKE_BASE_URL}/api/account-auth.php`,
      method: "GET",
      cookie,
      headers: [
        "accept: application/json",
        "cache-control: no-cache",
        `user-agent: ${DOLIKE_USER_AGENT}`,
      ],
    });
    const parsed = JSON.parse(raw);
    return !!parsed?.data?.logged_in;
  } catch {
    return false;
  }
}
