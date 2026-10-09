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

export async function getGolikeUser(token: string): Promise<{
  success: boolean;
  user?: GolikeUser;
  error?: string;
}> {
  const trimmed = token.replace(/^Bearer\s+/i, "").trim();
  if (!trimmed) {
    return { success: false, error: "Vui lòng nhập Authorization Token GoLike" };
  }

  try {
    const res = await fetch("https://gateway.golike.net/api/users/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${trimmed}`,
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
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
    // Nếu token có dạng hợp lệ nhưng bị lỗi kết nối mạng, cho phép fallback dựa trên token
    return {
      success: false,
      error: `Lỗi kết nối máy chủ GoLike: ${msg}`,
    };
  }
}
