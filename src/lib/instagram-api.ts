import { executeCurlRequest } from "./facebook-api";

// -------------------------------------------------------------
// GoMax Instagram Engine Constants (Chuẩn 100% GoMaxInstagramEngine.kt)
// -------------------------------------------------------------
const GRAPHQL_URL = "https://www.instagram.com/graphql/query";
const APP_ID = "936619743392459";
const ASBD_ID = "359341";
const BLOKS_VER =
  "61fc9465e13b77eaa110f317859102ba7fb93a0a2bcc08c46473da6713640739";
const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

// Doc IDs chính xác từ GoMax
const DOC_FOLLOW = "9740159112729312";
const DOC_FOLLOW_FALLBACK = "9663809173698092";
const DOC_LIKE = "9595477160535898";
const _DOC_LIKE_CMT = "7358156687612196";
const DOC_COMMENT = "7755358241198424";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const NATIVE_APP_UA =
  "Instagram 447.0.0.55.81 Android (34/14; 420dpi; 1080x2340; samsung; SM-A556B; a55xq; qcom; vi_VN; 385311890)";

export interface IgCookieInfo {
  isLive: boolean;
  username: string;
  userId: string;
  fullName?: string;
  avatar?: string;
  fbDtsg?: string;
  lsd?: string;
}

export interface IgPageTokens {
  dtsg: string;
  lsd: string;
  jazoest: string;
}

export interface IgActionResult {
  isSuccess: boolean;
  httpCode: number;
  rawBody: string;
  errorMessage?: string;
}

/**
 * Thuật toán GoMax: Giải mã shortcode sang Media ID bằng BigInt (GoMaxInstagramEngine.kt)
 */
export function shortcodeToMediaId(shortcode: string): string | null {
  if (!shortcode?.trim()) return null;
  let id = 0n;
  const base = 64n;
  for (let i = 0; i < shortcode.length; i++) {
    const c = shortcode[i];
    const idx = ALPHABET.indexOf(c);
    if (idx === -1) return null;
    id = id * base + BigInt(idx);
  }
  return id.toString();
}

/**
 * Trích xuất shortcode từ link bài viết / reel / tv
 */
export function extractShortcode(url: string): string | null {
  const match = url.match(/\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return match?.[1] ?? null;
}

/**
 * Chuẩn hóa cookie sang định dạng chuẩn Instagram (normalizeToIosCookie)
 */
export function normalizeCookie(rawCookie: string): string {
  if (!rawCookie?.trim()) return "";
  let cleaned = rawCookie.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.substring(1, cleaned.length - 1).trim();
  }

  const pairs = cleaned
    .split(";")
    .map((p) => p.trim())
    .filter((p) => p.includes("="));

  const map = new Map<string, string>();
  for (const pair of pairs) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx > 0) {
      const k = pair.substring(0, eqIdx).trim();
      const v = pair.substring(eqIdx + 1).trim();
      map.set(k, v);
    }
  }

  // Tự động bổ sung ds_user_id từ sessionid nếu thiếu
  if (!map.has("ds_user_id") && map.has("sessionid")) {
    const sVal = map.get("sessionid") || "";
    const potentialUid = sVal.split("%3A")[0].split(":")[0];
    if (potentialUid && /^\d+$/.test(potentialUid)) {
      map.set("ds_user_id", potentialUid);
    }
  }

  const result: string[] = [];
  for (const [k, v] of map.entries()) {
    result.push(`${k}=${v}`);
  }
  return result.join("; ");
}

/**
 * Trích xuất các cookie con
 */
export function parseCookie(cookie: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const part of cookie.split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0) {
      const k = part.substring(0, idx).trim();
      const v = part.substring(idx + 1).trim();
      if (k) map[k] = v;
    }
  }
  return map;
}

export const extractTokensFromCookie = parseCookie;

export function getCsrfToken(cookie: string): string {
  const map = parseCookie(cookie);
  return map.csrftoken || "";
}

export function getActorId(cookie: string): string {
  const map = parseCookie(cookie);
  return map.ds_user_id || "0";
}

/**
 * Trích xuất dtsg, lsd, jazoest từ trang Instagram
 */
export async function extractPageTokens(
  cookie: string,
  targetUrl = "https://www.instagram.com/",
  proxy?: string,
  cachedDtsg?: string,
  cachedLsd?: string,
): Promise<IgPageTokens> {
  let fbDtsg = cachedDtsg?.trim() || "";
  let lsd = cachedLsd?.trim() || "";
  let jazoest = "26328";

  try {
    const html = await executeCurlRequest({
      url: targetUrl || "https://www.instagram.com/",
      method: "GET",
      cookie,
      proxy,
      headers: [
        `User-Agent: ${BROWSER_UA}`,
        'sec-ch-ua: "Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "sec-ch-ua-mobile: ?0",
        'sec-ch-ua-platform: "Windows"',
      ],
    });

    const lsdPatterns = [
      /\["LSD",\s*\[\],\s*\{"token":"([^"]+)"/,
      /"LSD",\s*\[\],\s*\{"token":"([^"]+)"/,
      /name="lsd"\s+value="([^"]+)"/,
      /"lsd":\s*\{"token":"([^"]+)"/,
    ];
    for (const p of lsdPatterns) {
      const m = html.match(p);
      if (m?.[1]) {
        lsd = m[1];
        break;
      }
    }

    const dtsgPatterns = [
      /\["DTSGInitialData",\s*\[\],\s*\{"token":"([^"]+)"/,
      /"DTSGInitData":\s*\{"token":"([^"]+)"/,
      /"dtsg":\s*\{"token":"([^"]+)"/,
      /name="fb_dtsg"\s+value="([^"]+)"/,
      /"token":"(AQ[^"]+)"/,
    ];
    for (const p of dtsgPatterns) {
      const m = html.match(p);
      if (m?.[1]) {
        fbDtsg = m[1];
        break;
      }
    }

    const jazoestMatch = html.match(/name="jazoest"\s+value="(\d+)"/);
    if (jazoestMatch?.[1]) {
      jazoest = jazoestMatch[1];
    } else if (fbDtsg) {
      jazoest = computeJazoest(fbDtsg);
    }
  } catch {
    // ignore
  }

  return { dtsg: fbDtsg, lsd, jazoest };
}

/**
 * Tính toán jazoest từ fb_dtsg (GoMax computeJazoest)
 */
export function computeJazoest(fbDtsg?: string | null): string {
  if (!fbDtsg) return "26738";
  let sum = 0;
  for (let i = 0; i < fbDtsg.length; i++) {
    sum += fbDtsg.charCodeAt(i);
  }
  return `2${sum}`;
}

/**
 * 1. CHECK LIVE & TỰ ĐỘNG LẤY USERNAME/ID/AVATAR TỪ COOKIE (GoMaxInstagramEngine.kt + InstagramApiClient.kt)
 */
export async function checkCookieIg(
  cookieStr: string,
  proxy?: string,
): Promise<IgCookieInfo> {
  const cookie = normalizeCookie(cookieStr);
  const cookies = parseCookie(cookie);

  const uid = cookies.ds_user_id || "";
  const csrf = cookies.csrftoken || "";
  const sessionid = cookies.sessionid || "";

  if (!uid || !csrf || !sessionid) {
    return { isLive: false, username: "", userId: uid };
  }

  try {
    const html = await executeCurlRequest({
      url: "https://www.instagram.com/",
      method: "GET",
      cookie,
      proxy,
      headers: [
        `User-Agent: ${BROWSER_UA}`,
        "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language: vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
      ],
      timeoutSecs: 15,
    });

    const lower = html.toLowerCase();
    // Kiểm tra die / checkpoint (GoMax checkLiveCookie)
    if (
      lower.includes("login_required") ||
      lower.includes("checkpoint_required") ||
      lower.includes("challenge_required") ||
      lower.includes('"is_logged_in":false') ||
      lower.includes("accounts/suspended") ||
      lower.includes("1357031")
    ) {
      return { isLive: false, username: "", userId: uid };
    }

    // Bóc username bằng regex
    let usernameMatch = html.match(/"username"\s*:\s*"([^"]+)"/);
    if (!usernameMatch) {
      usernameMatch = html.match(/username":"([^"]+)"/);
    }
    let username = usernameMatch?.[1] || "";

    // Fallback bóc username qua REST API
    if (!username || /^\d+$/.test(username)) {
      try {
        const restRes = await executeCurlRequest({
          url: "https://www.instagram.com/api/v1/accounts/current_user/?edit=true",
          method: "GET",
          cookie,
          proxy,
          headers: [`User-Agent: ${BROWSER_UA}`, `X-IG-App-ID: ${APP_ID}`],
          timeoutSecs: 8,
        });
        const restJson = JSON.parse(restRes);
        if (restJson.user?.username) {
          username = String(restJson.user.username).trim();
        }
      } catch {
        // ignore
      }
    }

    // Bóc fb_dtsg và lsd
    let fbDtsgMatch = html.match(/"fb_dtsg":"([^"]+)"/);
    if (!fbDtsgMatch) {
      fbDtsgMatch = html.match(/DTSGInitialData[^"]*"token":"([^"]+)"/);
    }
    const fbDtsg = fbDtsgMatch?.[1] || "";

    const lsdMatch = html.match(/"lsd":"([^"]+)"/);
    const lsd = lsdMatch?.[1] || "";

    // Lấy thông tin chi tiết qua App Native REST API (/api/v1/users/{actorId}/info/)
    let fullName = "";
    let avatarUrl = "";
    if (uid && uid !== "0") {
      try {
        const userRes = await executeCurlRequest({
          url: `https://i.instagram.com/api/v1/users/${uid}/info/`,
          method: "GET",
          cookie,
          proxy,
          headers: [
            `User-Agent: ${NATIVE_APP_UA}`,
            `X-IG-App-ID: ${APP_ID}`,
            "X-IG-Connection-Type: WIFI",
            "X-IG-Capabilities: 3brBvw==",
          ],
          timeoutSecs: 10,
        });
        const userJson = JSON.parse(userRes);
        const userObj = userJson.user;
        if (userObj) {
          if (!username) username = userObj.username || "";
          fullName = userObj.full_name || "";
          const hdPic = userObj.hd_profile_pic_url_info?.url;
          const regPic = userObj.profile_pic_url;
          avatarUrl = hdPic || regPic || "";
        }
      } catch {
        // ignore
      }
    }

    return {
      isLive: true,
      username: username || uid,
      userId: uid,
      fullName: fullName || undefined,
      avatar: avatarUrl || undefined,
      fbDtsg: fbDtsg || undefined,
      lsd: lsd || undefined,
    };
  } catch {
    return { isLive: false, username: "", userId: uid };
  }
}

/**
 * Lấy thông tin user qua Native App API
 */
export async function fetchIgUserInfo(
  uidOrUsername: string,
  proxy?: string,
): Promise<{ isLive: boolean; username: string; avatar?: string }> {
  const clean = uidOrUsername.trim().replace(/^@/, "");
  if (!clean) return { isLive: false, username: "" };

  try {
    const endpoint = /^\d+$/.test(clean)
      ? `https://i.instagram.com/api/v1/users/${clean}/info/`
      : `https://i.instagram.com/api/v1/users/web_profile_info/?username=${clean}`;

    const raw = await executeCurlRequest({
      url: endpoint,
      method: "GET",
      proxy,
      headers: [
        `User-Agent: ${NATIVE_APP_UA}`,
        `X-IG-App-ID: ${APP_ID}`,
        "X-IG-Connection-Type: WIFI",
        "X-IG-Capabilities: 3brBvw==",
      ],
      timeoutSecs: 8,
    });

    const json = JSON.parse(raw);
    const user = json.user || json.data?.user;
    if (user?.username) {
      const hdPic = user.hd_profile_pic_url_info?.url;
      const regPic = user.profile_pic_url || user.profile_pic_url_hd;
      return {
        isLive: true,
        username: String(user.username).trim(),
        avatar: hdPic || regPic || undefined,
      };
    }
  } catch {
    // ignore
  }
  return { isLive: false, username: "" };
}

/**
 * Phân giải UID người dùng từ username / link
 */
export async function resolveTargetUserId(
  linkOrUsername: string,
  proxy?: string,
): Promise<string | null> {
  const clean = linkOrUsername.trim();
  if (!clean) return null;

  let usernameCandidate = clean;
  if (clean.startsWith("http")) {
    const m = clean.match(/instagram\.com\/([a-zA-Z0-9._]+)/);
    if (m?.[1] && m[1] !== "p" && m[1] !== "reel") {
      usernameCandidate = m[1];
    }
  } else {
    usernameCandidate = clean.replace(/^@/, "");
  }

  if (
    usernameCandidate &&
    usernameCandidate !== "p" &&
    usernameCandidate !== "reel"
  ) {
    try {
      const raw = await executeCurlRequest({
        url: `https://i.instagram.com/api/v1/users/web_profile_info/?username=${usernameCandidate}`,
        method: "GET",
        proxy,
        headers: [`User-Agent: ${NATIVE_APP_UA}`, `X-IG-App-ID: ${APP_ID}`],
        timeoutSecs: 8,
      });
      const json = JSON.parse(raw);
      const uid = json.data?.user?.id;
      if (uid) return String(uid);
    } catch {
      // ignore
    }
  }

  return null;
}

/**
 * Phân giải Media ID từ link bài viết / reel (GoMax)
 */
export function resolveMediaId(linkJob: string): string | null {
  if (!linkJob?.trim()) return null;
  const shortcode = extractShortcode(linkJob);
  if (shortcode) {
    const decoded = shortcodeToMediaId(shortcode);
    if (decoded) return decoded;
  }
  return null;
}

/**
 * Helper kiểm tra kết quả GraphQL của GoMax (parseMethodU)
 */
function isGraphQLSuccess(response: string): boolean {
  if (!response?.trim()) return false;
  try {
    const root = JSON.parse(response);
    const data = root.data;
    const friendship = data?.xdt_create_friendship;
    const statusObj = friendship?.friendship_status;

    if (
      statusObj?.following === true ||
      statusObj?.outgoing_request === true ||
      root.status?.toLowerCase() === "ok"
    ) {
      return true;
    }

    const errors = root.errors;
    if (Array.isArray(errors) && errors.length > 0) {
      const msg = (errors[0]?.message || "").toLowerCase();
      if (msg.includes("already")) return true;
    }
    return false;
  } catch {
    return (
      response.includes('"following":true') ||
      response.includes('"outgoing_request":true') ||
      response.includes("already") ||
      response.includes('"status":"ok"')
    );
  }
}

/**
 * 2. FOLLOW INSTAGRAM (Chuẩn GoMaxInstagramEngine.kt - DOC_FOLLOW = 9740159112729312)
 */
export async function doFollow(options: {
  cookie: string;
  targetNumericId: string;
  targetUsername?: string;
  targetUrl?: string;
  proxy?: string;
  tokens?: IgPageTokens;
  userId?: string;
}): Promise<IgActionResult> {
  const {
    cookie: rawCookie,
    targetNumericId,
    targetUsername = "",
    targetUrl,
    proxy,
    tokens: inputTokens,
  } = options;

  const cookie = normalizeCookie(rawCookie);
  let uid = targetNumericId.trim();

  // Nếu targetNumericId chưa phải là số, phân giải UID
  if (!/^\d+$/.test(uid)) {
    const candidate = targetUsername || targetUrl || targetNumericId;
    const resolved = await resolveTargetUserId(candidate, proxy);
    if (resolved) {
      uid = resolved;
    }
  }

  if (!uid || !/^\d+$/.test(uid)) {
    return {
      isSuccess: false,
      httpCode: 400,
      rawBody: "",
      errorMessage: "Lỗi Target ID đối tượng",
    };
  }

  const csrf = getCsrfToken(cookie);
  const actorId = getActorId(cookie);
  const avActor = actorId && actorId !== "0" ? `178414${actorId}` : "178414";

  // Lấy hoặc trích xuất fbDtsg / lsd
  let fbDtsg = inputTokens?.dtsg || "";
  let lsd = inputTokens?.lsd || "";
  if (!fbDtsg || !lsd) {
    const check = await checkCookieIg(cookie, proxy);
    if (check.fbDtsg) fbDtsg = check.fbDtsg;
    if (check.lsd) lsd = check.lsd;
  }

  const realJazoest = computeJazoest(fbDtsg);
  const referer = targetUsername
    ? targetUsername.startsWith("http")
      ? targetUsername
      : `https://www.instagram.com/${targetUsername}/`
    : "https://www.instagram.com/";

  const vars = JSON.stringify({
    target_user_id: uid,
    container_module: "profile",
    nav_chain:
      "PolarisProfilePostsTabRoot:profilePage:1:via_cold_start,PolarisProfilePostsTabRoot:profilePage:3:unexpected",
  });

  const baseHeaders = [
    "Accept: */*",
    "Accept-Language: vi,en;q=0.9",
    "Cache-Control: no-cache",
    "Content-Type: application/x-www-form-urlencoded",
    "Origin: https://www.instagram.com",
    "Pragma: no-cache",
    `Referer: ${referer}`,
    'Sec-Ch-Ua: "Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
    "Sec-Ch-Ua-Mobile: ?0",
    'Sec-Ch-Ua-Platform: "Windows"',
    "Sec-Fetch-Dest: empty",
    "Sec-Fetch-Mode: cors",
    "Sec-Fetch-Site: same-origin",
    `User-Agent: ${BROWSER_UA}`,
    `X-ASBD-ID: ${ASBD_ID}`,
    `X-Bloks-Version-Id: ${BLOKS_VER}`,
    `X-CSRFToken: ${csrf}`,
    "X-FB-Friendly-Name: usePolarisFollowMutation",
    `X-IG-App-ID: ${APP_ID}`,
    "X-Root-Field-Name: xdt_create_friendship",
  ];
  if (fbDtsg) baseHeaders.push(`X-FB-DTSG: ${fbDtsg}`);
  if (lsd) baseHeaders.push(`X-FB-LSD: ${lsd}`);

  const buildBody = (docId: string, reqParam: string) => {
    const bodyParams = new URLSearchParams({
      av: avActor,
      __d: "www",
      __user: "0",
      __a: "1",
      __req: reqParam,
      __hs: "20519.HYP:instagram_web_pkg.2.1...0",
      dpr: "1",
      __ccg: "EXCELLENT",
      __hsi: Date.now().toString(),
      __comet_req: "7",
      jazoest: realJazoest,
      fb_api_caller_class: "RelayModern",
      fb_api_req_friendly_name: "usePolarisFollowMutation",
      variables: vars,
      server_timestamps: "true",
      doc_id: docId,
    });
    if (fbDtsg) bodyParams.append("fb_dtsg", fbDtsg);
    if (lsd) bodyParams.append("lsd", lsd);
    return bodyParams.toString();
  };

  // 1. Thử GraphQL chính (GoMax Doc ID 9740159112729312)
  try {
    const res1 = await executeCurlRequest({
      url: GRAPHQL_URL,
      method: "POST",
      body: buildBody(DOC_FOLLOW, "1j"),
      cookie,
      headers: baseHeaders,
      proxy,
      timeoutSecs: 20,
    });

    if (isGraphQLSuccess(res1)) {
      return { isSuccess: true, httpCode: 200, rawBody: res1 };
    }
  } catch {
    // thử tiếp fallback
  }

  // 2. Fallback GraphQL dự phòng (GoMax Doc ID 9663809173698092)
  try {
    const res2 = await executeCurlRequest({
      url: GRAPHQL_URL,
      method: "POST",
      body: buildBody(DOC_FOLLOW_FALLBACK, "15"),
      cookie,
      headers: baseHeaders,
      proxy,
      timeoutSecs: 20,
    });

    if (isGraphQLSuccess(res2)) {
      return { isSuccess: true, httpCode: 200, rawBody: res2 };
    }

    return {
      isSuccess: false,
      httpCode: 400,
      rawBody: res2,
      errorMessage: "Follow thất bại từ Instagram",
    };
  } catch (err: unknown) {
    return {
      isSuccess: false,
      httpCode: 0,
      rawBody: "",
      errorMessage: err instanceof Error ? err.message : "Lỗi kết nối",
    };
  }
}

/**
 * 3. LIKE MEDIA INSTAGRAM (Chuẩn GoMaxInstagramEngine.kt - DOC_LIKE = 9595477160535898 + REST Fallback)
 */
export async function doLike(options: {
  cookie: string;
  mediaIdOrUrl: string;
  linkJob?: string;
  proxy?: string;
  tokens?: IgPageTokens;
}): Promise<IgActionResult> {
  const {
    cookie: rawCookie,
    mediaIdOrUrl,
    linkJob = "",
    proxy,
    tokens: inputTokens,
  } = options;

  const cookie = normalizeCookie(rawCookie);
  let mediaId = mediaIdOrUrl.trim();

  // Giải mã shortcode bằng BigInt nếu chưa phải số
  if (!/^\d+$/.test(mediaId)) {
    const targetLink = linkJob || mediaIdOrUrl;
    const shortcode = extractShortcode(targetLink);
    if (shortcode) {
      const decoded = shortcodeToMediaId(shortcode);
      if (decoded) mediaId = decoded;
    }
  }

  if (!mediaId || !/^\d+$/.test(mediaId)) {
    return {
      isSuccess: false,
      httpCode: 400,
      rawBody: "",
      errorMessage: "Lỗi Media ID đối tượng",
    };
  }

  const csrf = getCsrfToken(cookie);
  let fbDtsg = inputTokens?.dtsg || "";
  let lsd = inputTokens?.lsd || "";

  if (!fbDtsg || !lsd) {
    const check = await checkCookieIg(cookie, proxy);
    if (check.fbDtsg) fbDtsg = check.fbDtsg;
    if (check.lsd) lsd = check.lsd;
  }

  const realJazoest = computeJazoest(fbDtsg);

  // 1. Thử GraphQL chính (GoMax Doc ID 9595477160535898)
  const vars = JSON.stringify({
    media_id: mediaId,
    container_module: "feed_timeline",
  });

  const headers = [
    "Accept: */*",
    "Accept-Language: vi,en;q=0.9",
    "Content-Type: application/x-www-form-urlencoded",
    "Origin: https://www.instagram.com",
    `Referer: ${linkJob || "https://www.instagram.com/"}`,
    'Sec-Ch-Ua: "Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
    "Sec-Ch-Ua-Mobile: ?0",
    'Sec-Ch-Ua-Platform: "Windows"',
    "Sec-Fetch-Dest: empty",
    "Sec-Fetch-Mode: cors",
    "Sec-Fetch-Site: same-origin",
    `User-Agent: ${BROWSER_UA}`,
    `X-ASBD-ID: ${ASBD_ID}`,
    `X-Bloks-Version-Id: ${BLOKS_VER}`,
    `X-CSRFToken: ${csrf}`,
    `X-IG-App-ID: ${APP_ID}`,
    "X-FB-Friendly-Name: usePolarisLikeMediaLikeMutation",
  ];
  if (fbDtsg) headers.push(`X-FB-DTSG: ${fbDtsg}`);
  if (lsd) headers.push(`X-FB-LSD: ${lsd}`);

  const bodyParams = new URLSearchParams({
    av: "178414",
    __d: "www",
    __user: "0",
    __a: "1",
    __req: "1j",
    __hs: "20519.HYP:instagram_web_pkg.2.1...0",
    dpr: "1",
    __ccg: "EXCELLENT",
    __comet_req: "7",
    jazoest: realJazoest,
    fb_api_caller_class: "RelayModern",
    fb_api_req_friendly_name: "usePolarisLikeMediaLikeMutation",
    variables: vars,
    server_timestamps: "true",
    doc_id: DOC_LIKE,
  });
  if (fbDtsg) bodyParams.append("fb_dtsg", fbDtsg);
  if (lsd) bodyParams.append("lsd", lsd);

  try {
    const res = await executeCurlRequest({
      url: GRAPHQL_URL,
      method: "POST",
      body: bodyParams.toString(),
      cookie,
      headers,
      proxy,
      timeoutSecs: 20,
    });

    if (
      res &&
      (res.includes('"status":"ok"') ||
        res.includes('"viewer_has_liked":true') ||
        res.includes('"success":true') ||
        res.includes("xdt_like_media"))
    ) {
      return { isSuccess: true, httpCode: 200, rawBody: res };
    }
  } catch {
    // fallback sang REST
  }

  // 2. Fallback REST API đúng chuẩn GoMax
  try {
    const restRes = await executeCurlRequest({
      url: `https://www.instagram.com/api/v1/web/likes/${mediaId}/like/`,
      method: "POST",
      cookie,
      proxy,
      headers: [
        `User-Agent: ${BROWSER_UA}`,
        `X-CSRFToken: ${csrf}`,
        "X-Instagram-AJAX: 1006309104",
        "X-Requested-With: XMLHttpRequest",
        `X-IG-App-ID: ${APP_ID}`,
      ],
      timeoutSecs: 15,
    });

    if (
      restRes &&
      (restRes.includes('"status":"ok"') || restRes.includes('"success":true'))
    ) {
      return { isSuccess: true, httpCode: 200, rawBody: restRes };
    }

    return {
      isSuccess: false,
      httpCode: 400,
      rawBody: restRes,
      errorMessage: "Like thất bại từ Instagram",
    };
  } catch (err: unknown) {
    return {
      isSuccess: false,
      httpCode: 0,
      rawBody: "",
      errorMessage: err instanceof Error ? err.message : "Lỗi kết nối",
    };
  }
}

/**
 * 4. COMMENT INSTAGRAM (Chuẩn GoMaxInstagramEngine.kt - DOC_COMMENT = 7755358241198424)
 */
export async function doComment(options: {
  cookie: string;
  mediaIdOrUrl: string;
  text: string;
  linkJob?: string;
  proxy?: string;
  tokens?: IgPageTokens;
}): Promise<IgActionResult> {
  const {
    cookie: rawCookie,
    mediaIdOrUrl,
    text,
    linkJob = "",
    proxy,
    tokens: inputTokens,
  } = options;

  const cookie = normalizeCookie(rawCookie);
  let mediaId = mediaIdOrUrl.trim();

  if (!/^\d+$/.test(mediaId)) {
    const targetLink = linkJob || mediaIdOrUrl;
    const shortcode = extractShortcode(targetLink);
    if (shortcode) {
      const decoded = shortcodeToMediaId(shortcode);
      if (decoded) mediaId = decoded;
    }
  }

  if (!mediaId || !/^\d+$/.test(mediaId)) {
    return {
      isSuccess: false,
      httpCode: 400,
      rawBody: "",
      errorMessage: "Lỗi Media ID đối tượng",
    };
  }

  const csrf = getCsrfToken(cookie);
  let fbDtsg = inputTokens?.dtsg || "";
  let lsd = inputTokens?.lsd || "";

  if (!fbDtsg || !lsd) {
    const check = await checkCookieIg(cookie, proxy);
    if (check.fbDtsg) fbDtsg = check.fbDtsg;
    if (check.lsd) lsd = check.lsd;
  }

  const vars = JSON.stringify({
    id: mediaId,
    comment_text: text,
    container_module: "self_comments_v2",
  });

  const headers = [
    "Accept: */*",
    "Accept-Language: vi,en;q=0.9",
    "Content-Type: application/x-www-form-urlencoded",
    "Origin: https://www.instagram.com",
    `Referer: ${linkJob || "https://www.instagram.com/"}`,
    `User-Agent: ${BROWSER_UA}`,
    `X-ASBD-ID: ${ASBD_ID}`,
    `X-Bloks-Version-Id: ${BLOKS_VER}`,
    `X-CSRFToken: ${csrf}`,
    `X-IG-App-ID: ${APP_ID}`,
    "X-FB-Friendly-Name: usePolarisCommentDirectMutation",
  ];
  if (fbDtsg) headers.push(`X-FB-DTSG: ${fbDtsg}`);
  if (lsd) headers.push(`X-FB-LSD: ${lsd}`);

  const bodyParams = new URLSearchParams({
    av: "178414",
    __d: "www",
    __user: "0",
    __a: "1",
    __req: "1j",
    __hs: "20519.HYP:instagram_web_pkg.2.1...0",
    dpr: "1",
    __ccg: "EXCELLENT",
    __comet_req: "7",
    jazoest: computeJazoest(fbDtsg),
    fb_api_caller_class: "RelayModern",
    fb_api_req_friendly_name: "usePolarisCommentDirectMutation",
    variables: vars,
    server_timestamps: "true",
    doc_id: DOC_COMMENT,
  });
  if (fbDtsg) bodyParams.append("fb_dtsg", fbDtsg);
  if (lsd) bodyParams.append("lsd", lsd);

  try {
    const res = await executeCurlRequest({
      url: GRAPHQL_URL,
      method: "POST",
      body: bodyParams.toString(),
      cookie,
      headers,
      proxy,
      timeoutSecs: 20,
    });

    if (res && !res.includes('"errors":') && res.includes('"id":')) {
      return { isSuccess: true, httpCode: 200, rawBody: res };
    }

    return {
      isSuccess: false,
      httpCode: 400,
      rawBody: res,
      errorMessage: "Bình luận thất bại",
    };
  } catch (err: unknown) {
    return {
      isSuccess: false,
      httpCode: 0,
      rawBody: "",
      errorMessage: err instanceof Error ? err.message : "Lỗi kết nối",
    };
  }
}
