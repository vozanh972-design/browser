export const CURRENT_APP_VERSION = "1.0.1";

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
  // 2. GitHub Releases API của theanh39/lunexexe
  `https://api.github.com/repos/${GITHUB_TARGET_REPO}/releases/latest`,
  // 3. Fallback endpoints
  "https://raw.githubusercontent.com/vozanh972-design/browser/main/version.json",
  "https://lunex.io.vn/api/version.json",
];

/**
 * Kiểm tra ngầm xem phiên bản hiện tại có bản cập nhật bắt buộc không.
 * Đọc từ https://github.com/theanh39/lunexexe.
 * Nếu phiên bản trên server lớn hơn hoặc phiên bản hiện tại nhỏ hơn min_version,
 * tool sẽ bị vô hiệu hóa hoàn toàn và bắt buộc cập nhật.
 */
export async function checkAppVersion(): Promise<AppVersionCheckResult> {
  const currentVersion = CURRENT_APP_VERSION;

  // Kiểm tra cờ đã bị đánh dấu vô hiệu hóa trong cache trước đó
  const cachedOutdated =
    typeof window !== "undefined" &&
    localStorage.getItem("autolunex_is_outdated") === "true";
  const cachedLatest =
    typeof window !== "undefined"
      ? localStorage.getItem("autolunex_latest_version") || currentVersion
      : currentVersion;
  const cachedDownloadUrl =
    typeof window !== "undefined"
      ? localStorage.getItem("autolunex_download_url") ||
        `https://github.com/${GITHUB_TARGET_REPO}/releases/latest`
      : `https://github.com/${GITHUB_TARGET_REPO}/releases/latest`;

  let remoteConfig: RemoteVersionConfig | null = null;

  // Thử các endpoint với cache-busting timestamp
  for (const endpoint of REMOTE_VERSION_ENDPOINTS) {
    try {
      const url = `${endpoint}${endpoint.includes("?") ? "&" : "?"}_t=${Date.now()}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-cache",
        },
      });

      if (response.ok) {
        const data = (await response.json()) as Record<string, unknown>;

        // Trường hợp 1: File version.json
        if (data && typeof data.version === "string") {
          remoteConfig = data as unknown as RemoteVersionConfig;
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
              `https://github.com/${GITHUB_TARGET_REPO}/releases/download/v${rawTag}/AutoLunex.exe`;

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
      }
    } catch {
      // Thử endpoint tiếp theo
    }
  }

  // Nếu không gọi được server nhưng trước đó máy đã ghi nhận bị vô hiệu hóa
  if (!remoteConfig) {
    if (cachedOutdated) {
      return {
        isOutdated: true,
        currentVersion,
        latestVersion: cachedLatest,
        minVersion: cachedLatest,
        forceUpdate: true,
        downloadUrl: cachedDownloadUrl,
        title: "Yêu cầu cập nhật bắt buộc",
        message:
          "Phiên bản này đã bị vô hiệu hóa vì đã có bản cập nhật mới. Vui lòng tải phiên bản mới nhất để tiếp tục sử dụng.",
        releaseNotes: [],
      };
    }
    return {
      isOutdated: false,
      currentVersion,
      latestVersion: currentVersion,
      minVersion: currentVersion,
      forceUpdate: false,
      downloadUrl: cachedDownloadUrl,
      title: "",
      message: "",
      releaseNotes: [],
    };
  }

  const latestVersion = remoteConfig.version || currentVersion;
  const minVersion = remoteConfig.min_version || latestVersion;
  const downloadUrl =
    remoteConfig.download_url ||
    `https://github.com/${GITHUB_TARGET_REPO}/releases/latest`;

  // Điều kiện vô hiệu hóa phiên bản cũ:
  // 1. Bản hiện tại < min_version được phép chạy
  // 2. Server bật cờ force_update và bản hiện tại < version mới nhất
  const isLowerThanMin = compareSemver(currentVersion, minVersion) < 0;
  const isLowerThanLatest = compareSemver(currentVersion, latestVersion) < 0;
  const isOutdated =
    isLowerThanMin || (remoteConfig.force_update && isLowerThanLatest);

  if (typeof window !== "undefined") {
    if (isOutdated) {
      localStorage.setItem("autolunex_is_outdated", "true");
      localStorage.setItem("autolunex_latest_version", latestVersion);
      localStorage.setItem("autolunex_download_url", downloadUrl);
    } else {
      localStorage.removeItem("autolunex_is_outdated");
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
      `Phiên bản v${currentVersion} đã cũ và không còn được hỗ trợ. Vui lòng cập nhật lên v${latestVersion} để tiếp tục sử dụng.`,
    releaseNotes: remoteConfig.release_notes || [],
  };
}
