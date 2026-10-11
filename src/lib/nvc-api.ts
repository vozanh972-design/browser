import { invoke } from "@tauri-apps/api/core";

export interface NvcUser {
  id: number;
  username: string;
  displayName: string | null;
  coinBalance: string;
  lockedCoinBalance?: string;
  status?: string;
}

export interface NvcLoginResponse {
  success: boolean;
  user?: NvcUser;
  sessionCookie?: string;
  error?: string;
}

const NVC_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";

async function runNvcCurl(options: {
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

  // Fallback nếu chạy ở trình duyệt thông thường
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
 * Đăng nhập Nhiệm Vụ Chéo qua API chính thức (sử dụng curl_request native để tránh CORS)
 * POST https://nhiemvucheo.com/api/v1/auth/login
 */
export async function loginNvc(
  username: string,
  password: string,
): Promise<NvcLoginResponse> {
  try {
    const rawOutput = await runNvcCurl({
      url: "https://nhiemvucheo.com/api/v1/auth/login",
      method: "POST",
      includeHeaders: true,
      headers: [
        "accept: */*",
        "content-type: application/json",
        "origin: https://nhiemvucheo.com",
        "referer: https://nhiemvucheo.com/auth/login?returnUrl=%2Fhome",
        `user-agent: ${NVC_USER_AGENT}`,
      ],
      body: JSON.stringify({
        username: username.trim(),
        password,
      }),
    });

    // Tách headers và body nếu có includeHeaders (-i)
    let headerText = "";
    let bodyText = rawOutput;

    const parts = rawOutput.split(/\r?\n\r?\n/);
    if (parts.length > 1) {
      bodyText = parts[parts.length - 1].trim();
      headerText = parts.slice(0, parts.length - 1).join("\n");
    }

    let sessionCookie = "";
    const cookieMatch = headerText.match(/nvc_session=([^;\r\n]+)/);
    if (cookieMatch) {
      sessionCookie = cookieMatch[1].trim();
    }

    const data = JSON.parse(bodyText);

    if (!data?.success) {
      const errMsg =
        data?.error?.message ||
        data?.message ||
        "Tên tài khoản hoặc mật khẩu không chính xác";
      return { success: false, error: errMsg };
    }

    const user: NvcUser = {
      id: data.data?.user?.id ?? 0,
      username: data.data?.user?.username ?? username.trim(),
      displayName: data.data?.user?.displayName ?? null,
      coinBalance: String(data.data?.user?.coinBalance ?? "0"),
      lockedCoinBalance: String(data.data?.user?.lockedCoinBalance ?? "0"),
      status: data.data?.user?.status ?? "active",
    };

    return {
      success: true,
      user,
      sessionCookie,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Lỗi kết nối máy chủ NVC";
    return { success: false, error: msg };
  }
}

/**
 * Lấy thông tin tài khoản và số dư thực tế từ NVC
 * GET https://nhiemvucheo.com/api/v1/auth/me
 */
export async function getNvcMe(sessionCookie?: string): Promise<{
  success: boolean;
  user?: NvcUser;
  error?: string;
}> {
  try {
    const rawOutput = await runNvcCurl({
      url: "https://nhiemvucheo.com/api/v1/auth/me",
      method: "GET",
      cookie: sessionCookie ? `nvc_session=${sessionCookie}` : undefined,
      headers: [
        "accept: */*",
        "referer: https://nhiemvucheo.com/home",
        `user-agent: ${NVC_USER_AGENT}`,
      ],
    });

    const parts = rawOutput.split(/\r?\n\r?\n/);
    const bodyText = parts[parts.length - 1].trim();
    const data = JSON.parse(bodyText);

    if (!data?.success) {
      return {
        success: false,
        error: data?.error?.message || "Không thể lấy thông tin tài khoản NVC",
      };
    }

    const user: NvcUser = {
      id: data.data?.user?.id ?? 0,
      username: data.data?.user?.username ?? "",
      displayName: data.data?.user?.displayName ?? null,
      coinBalance: String(data.data?.user?.coinBalance ?? "0"),
      lockedCoinBalance: String(data.data?.user?.lockedCoinBalance ?? "0"),
      status: data.data?.user?.status ?? "active",
    };

    return { success: true, user };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Lỗi kết nối NVC";
    return { success: false, error: msg };
  }
}
