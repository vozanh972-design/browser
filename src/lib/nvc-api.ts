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

/**
 * Đăng nhập Nhiệm Vụ Chéo qua API chính thức
 * POST https://nhiemvucheo.com/api/v1/auth/login
 */
export async function loginNvc(
  username: string,
  password: string,
): Promise<NvcLoginResponse> {
  try {
    const res = await fetch("https://nhiemvucheo.com/api/v1/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "*/*",
        origin: "https://nhiemvucheo.com",
        referer: "https://nhiemvucheo.com/auth/login?returnUrl=%2Fhome",
        "user-agent": NVC_USER_AGENT,
      },
      body: JSON.stringify({
        username: username.trim(),
        password,
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.success) {
      const errMsg =
        data?.error?.message ||
        data?.message ||
        `Đăng nhập thất bại (HTTP ${res.status})`;
      return { success: false, error: errMsg };
    }

    // Lấy cookie session nếu có trong response headers
    let sessionCookie = "";
    const rawSetCookie = res.headers.get("set-cookie");
    if (rawSetCookie) {
      const match = rawSetCookie.match(/nvc_session=([^;]+)/);
      if (match) {
        sessionCookie = match[1];
      }
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
    const headers: Record<string, string> = {
      accept: "*/*",
      referer: "https://nhiemvucheo.com/home",
      "user-agent": NVC_USER_AGENT,
    };

    if (sessionCookie) {
      headers["cookie"] = `nvc_session=${sessionCookie}`;
    }

    const res = await fetch("https://nhiemvucheo.com/api/v1/auth/me", {
      headers,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.success) {
      return {
        success: false,
        error: data?.error?.message || `HTTP ${res.status}`,
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
