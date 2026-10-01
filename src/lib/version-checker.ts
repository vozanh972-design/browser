import { invoke } from "@tauri-apps/api/core";

export const CURRENT_APP_VERSION = "1.0.2";

export interface RemoteVersionConfig {
  version: string;
  min_version: string;
  force_update: boolean;
  download_url: string;
  title?: string;
  message?: string;
  release_notes?: string[];
}

export interface AppVersionCheckResult {
  isOutdated: boolean;
  currentVersion: string;
  latestVersion: string;
  minVersion: string;
  forceUpdate: boolean;
  downloadUrl: string;
  title: string;
  message: string;
  releaseNotes: string[];
}

/**
 * So sánh 2 chuỗi phiên bản semver (ví dụ "1.0.0" và "1.0.1", "v1.2.3")
 * Trả về:
 *   1  nếu v1 > v2
 *  -1  nếu v1 < v2
 *   0  nếu v1 == v2
 */
export function compareSemver(v1: string, v2: string): number {
  const clean1 = (v1 || "").replace(/^v/i, "").trim();
  const clean2 = (v2 || "").replace(/^v/i, "").trim();

  const parts1 = clean1.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const parts2 = clean2.split(".").map((n) => Number.parseInt(n, 10) || 0);

  const maxLen = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLen; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

const GITHUB_TARGET_REPO = "theanh39/lunexexe";

const REMOTE_VERSION_ENDPOINTS = [
  // 1. Repo mục tiêu https://github.com/theanh39/lunexexe (version.json trên main branch)
  `https://raw.githubusercontent.com/${GITHUB_TARGET_REPO}/main/version.json`,
  // 2. GitHub Contents API của repo theanh39/lunexexe (tránh Fastly CDN cache của raw)
  `https://api.github.com/repos/${GITHUB_TARGET_REPO}/contents/version.json`,
  // 3. GitHub Releases API của theanh39/lunexexe
  `https://api.github.com/repos/${GITHUB_TARGET_REPO}/releases/latest`,
];

async function fetchRemoteJsonText(url: string): Promise<string | null> {
  // Thử gọi qua lệnh Rust tauri để miễn nhiễm hoàn toàn với CORS / Webview restrictions
  try {
    const isTauri =
      typeof window !== "undefined" &&
      ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

    if (isTauri) {
      const res = await invoke<string>("fetch_remote_version_json", { url });
      if (res && (res.trim().startsWith("{") || res.trim().startsWith("["))) {
        return res.trim();
      }
    }
  } catch {
    // Tiếp tục thử webview fetch
  }

  // Webview fetch — TUYỆT ĐỐI không gửi custom headers để tránh bị CORS preflight 403 Forbidden từ GitHub
  try {
    const response = await fetch(url, {
      method: "GET",
    });
    if (response.ok) {
      return await response.text();
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Kiểm tra ngầm xem phiên bản hiện tại có bản cập nhật bắt buộc không.
 * Đọc duy nhất từ https://github.com/theanh39/lunexexe.
 * CHỈ HIỆN CẬP NHẬT KHI THỰC SỰ CÓ BẢN MỚI HƠN TRÊN SERVER.
 */
export async function checkAppVersion(): Promise<AppVersionCheckResult> {
  let currentVersion = CURRENT_APP_VERSION;

  // Lấy chính xác phiên bản của file binary đang chạy
  try {
    const isTauri =
      typeof window !== "undefined" &&
      ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
    if (isTauri) {
      const info = await invoke<{ app_version?: string }>("get_system_info");
      if (info?.app_version?.trim()) {
        currentVersion = info.app_version.trim();
      }
    }
  } catch {
    // fallback to CURRENT_APP_VERSION
  }

  let remoteConfig: RemoteVersionConfig | null = null;

  // Thử các endpoint với cache-busting timestamp
  for (const endpoint of REMOTE_VERSION_ENDPOINTS) {
    try {
      const url = `${endpoint}${endpoint.includes("?") ? "&" : "?"}_t=${Date.now()}`;
      const text = await fetchRemoteJsonText(url);
      if (!text) continue;

      let data: Record<string, unknown> | null = null;
      try {
        data = JSON.parse(text) as Record<string, unknown>;
      } catch {
        // Tự động sửa lỗi cú pháp nếu có thừa dấu ngoặc kép ""
        try {
          const sanitized = text
            .replace(/""([^"]+)":\s*"([^"]+)""/g, '"$1": "$2"')
            .replace(/""([^"]+)""/g, '"$1"');
          data = JSON.parse(sanitized) as Record<string, unknown>;
        } catch {
          // Trích xuất regex an toàn
          const versionMatch = text.match(/"version"\s*:\s*"([^"]+)"/i);
          const downloadMatch = text.match(/"download_url"\s*:\s*"([^"]+)"/i);
          if (versionMatch?.[1]) {
            data = {
              version: versionMatch[1],
              min_version: versionMatch[1],
              force_update: true,
              download_url:
                downloadMatch?.[1] ||
                `https://raw.githubusercontent.com/${GITHUB_TARGET_REPO}/main/AutoLunex.exe`,
            };
          }
        }
      }

      // Trường hợp: GitHub Contents API (/repos/theanh39/lunexexe/contents/version.json)
      if (
        data &&
        typeof data.content === "string" &&
        data.encoding === "base64"
      ) {
        try {
          const decoded = atob(data.content.replace(/\s+/g, ""));
          data = JSON.parse(decoded) as Record<string, unknown>;
        } catch {
          // ignore
        }
      }

      // Trường hợp 1: File version.json
      if (data && typeof data.version === "string") {
        remoteConfig = data as unknown as RemoteVersionConfig;
        if (!remoteConfig.download_url) {
          remoteConfig.download_url = `https://raw.githubusercontent.com/${GITHUB_TARGET_REPO}/main/AutoLunex.exe`;
        }
        break;
      }

      // Trường hợp 2: GitHub Releases API (/repos/theanh39/lunexexe/releases/latest)
      if (data && typeof data.tag_name === "string") {
        const rawTag = data.tag_name.replace(/^v/i, "").trim();
        if (rawTag) {
          interface ReleaseAsset {
            name?: string;
            browser_download_url?: string;
          }
          const assets = Array.isArray(data.assets)
            ? (data.assets as ReleaseAsset[])
            : [];
          const exeAsset = assets.find(
            (a) =>
              typeof a?.name === "string" &&
              a.name.toLowerCase().endsWith(".exe"),
          );
          const downloadUrl =
            exeAsset?.browser_download_url ||
            `https://raw.githubusercontent.com/${GITHUB_TARGET_REPO}/main/AutoLunex.exe`;

          const releaseNotes =
            typeof data.body === "string"
              ? data.body
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [];

          remoteConfig = {
            version: rawTag,
            min_version: rawTag,
            force_update: true,
            download_url: downloadUrl,
            title:
              typeof data.name === "string" && data.name
                ? data.name
                : "Yêu cầu cập nhật phiên bản mới",
            message:
              "Đã có phiên bản cập nhật mới trên hệ thống. Ứng dụng sẽ tự động tải ngầm và nâng cấp.",
            release_notes: releaseNotes,
          };
          break;
        }
      }
    } catch {
      // Thử endpoint tiếp theo
    }
  }

  // Nếu không tải được thông tin phiên bản từ theanh39/lunexexe:
  // TUYỆT ĐỐI KHÔNG BÁO CẬP NHẬT (Không có bằng chứng cập nhật thật)
  if (!remoteConfig?.version) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("autolunex_is_outdated");
      localStorage.removeItem("autolunex_latest_version");
      localStorage.removeItem("autolunex_download_url");
    }
    return {
      isOutdated: false,
      currentVersion,
      latestVersion: currentVersion,
      minVersion: currentVersion,
      forceUpdate: false,
      downloadUrl: "",
      title: "",
      message: "",
      releaseNotes: [],
    };
  }

  const latestVersion = (remoteConfig.version || "").trim();
  const minVersion = (remoteConfig.min_version || latestVersion).trim();

  // ĐIỀU KIỆN TIÊN QUYẾT BẮT BUỘC ĐỂ CÓ CẬP NHẬT THẬT:
  // Phiên bản trên server (latestVersion) PHẢI LỚN HƠN phiên bản hiện tại (currentVersion)
  const isTrulyNewer = compareSemver(currentVersion, latestVersion) < 0;

  if (!isTrulyNewer) {
    // Nếu bản trên server <= bản đang chạy: CHẮC CHẮN ĐÃ LÀ BẢN MỚI NHẤT -> KHÔNG HIỆN POPUP!
    if (typeof window !== "undefined") {
      localStorage.removeItem("autolunex_is_outdated");
      localStorage.removeItem("autolunex_latest_version");
      localStorage.removeItem("autolunex_download_url");
    }
    return {
      isOutdated: false,
      currentVersion,
      latestVersion,
      minVersion,
      forceUpdate: false,
      downloadUrl: "",
      title: "",
      message: "",
      releaseNotes: [],
    };
  }

  // Chỉ khi phiên bản server THỰC SỰ LỚN HƠN thì mới xem xét cập nhật
  const downloadUrl =
    remoteConfig.download_url ||
    `https://raw.githubusercontent.com/${GITHUB_TARGET_REPO}/main/AutoLunex.exe`;

  const isLowerThanMin = compareSemver(currentVersion, minVersion) < 0;
  const isOutdated =
    isTrulyNewer && (isLowerThanMin || !!remoteConfig.force_update);

  if (typeof window !== "undefined") {
    if (isOutdated) {
      localStorage.setItem("autolunex_is_outdated", "true");
      localStorage.setItem("autolunex_latest_version", latestVersion);
      localStorage.setItem("autolunex_download_url", downloadUrl);
    } else {
      localStorage.removeItem("autolunex_is_outdated");
      localStorage.removeItem("autolunex_latest_version");
      localStorage.removeItem("autolunex_download_url");
    }
  }

  return {
    isOutdated,
    currentVersion,
    latestVersion,
    minVersion,
    forceUpdate: remoteConfig.force_update ?? isOutdated,
    downloadUrl,
    title: remoteConfig.title || "Yêu cầu cập nhật phiên bản mới",
    message:
      remoteConfig.message ||
      `Phiên bản v${currentVersion} đã cũ. Vui lòng cập nhật lên v${latestVersion} để tiếp tục sử dụng.`,
    releaseNotes: remoteConfig.release_notes || [],
  };
}
