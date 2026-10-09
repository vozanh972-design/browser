import {
  buildGolikeHeaders,
  loadGolikeSession,
  type GolikeSessionData,
} from "./golike-session";

export interface GolikeUser {
  username: string;
  coin: number;
}

export interface GolikeUserResponse {
  status?: number;
  success?: boolean;
  data?: {
    username?: string;
    name?: string;
    coin?: number;
    coins?: number;
    star?: number;
  };
  message?: string;
  error?: string;
}

export async function getGolikeUser(tokenOrSession?: string | GolikeSessionData): Promise<{
  success: boolean;
  user?: GolikeUser;
  error?: string;
}> {
  try {
    let headers: Record<string, string>;

    if (tokenOrSession && typeof tokenOrSession === "object") {
      headers = buildGolikeHeaders(tokenOrSession);
    } else {
      const savedSession = loadGolikeSession();
      if (savedSession && savedSession.golike_token) {
        headers = buildGolikeHeaders(savedSession);
        if (typeof tokenOrSession === "string" && tokenOrSession.trim()) {
          const cleanToken = tokenOrSession.replace(/^Bearer\s+/i, "").trim();
          headers.Authorization = `Bearer ${cleanToken}`;
        }
      } else {
        const raw = typeof tokenOrSession === "string" ? tokenOrSession.trim() : "";
        if (!raw) {
          return { success: false, error: "Vui lòng nhập Authorization Token GoLike" };
        }
        const cleanToken = raw.replace(/^Bearer\s+/i, "").trim();
        headers = {
          Authorization: `Bearer ${cleanToken}`,
          "g-client": "web",
          "g-scheme": "https",
          "g-version": "26.09.17.1",
          "Content-Type": "application/json;charset=utf-8",
          Accept: "application/json, text/plain, */*",
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
          Origin: "https://app.golike.net",
          Referer: "https://app.golike.net/",
        };
      }
    }

    const res = await fetch("https://gateway.golike.net/api/users/me", {
      method: "GET",
      headers,
    });

    const data = (await res.json()) as GolikeUserResponse;

    if (data?.status === 200 && data.data) {
      return {
        success: true,
        user: {
          username: data.data.username || data.data.name || "GoLike User",
          coin: Number(data.data.coin || data.data.coins || 0),
        },
      };
    }

    if (data?.message) {
      return {
        success: false,
        error: data.message,
      };
    }

    if (data?.error) {
      return {
        success: false,
        error: typeof data.error === "string" ? data.error : "Token GoLike không hợp lệ",
      };
    }

    return {
      success: false,
      error: "Không thể xác thực tài khoản GoLike. Vui lòng kiểm tra lại token.",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Lỗi kết nối máy chủ GoLike: ${msg}`,
    };
  }
}
