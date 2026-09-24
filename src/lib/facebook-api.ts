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
}): Promise<string> {
  try {
    return await invoke<string>("curl_request", {
      url: options.url,
      method: options.method ?? "GET",
      headers: options.headers ?? null,
      body: options.body ?? null,
      cookie: options.cookie ?? null,
      proxy: options.proxy ?? null,
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
