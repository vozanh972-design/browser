import { executeCurlRequest } from "./facebook-api";

// -------------------------------------------------------------
// Instagram API V2 Engine Constants (Chuẩn 100% TA Tool V2 Python)
// -------------------------------------------------------------
export const GRAPHQL_URL = "https://www.instagram.com/api/graphql";
export const APP_ID = "936619743392459";
export const ASBD_ID = "129477";
const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

// Doc IDs chính xác 100% từ TA Tool Instagram Auto Jobs
export const DOC_FOLLOW = "26508036048874888";
export const DOC_LIKE = "27182485238052618";
export const DOC_COMMENT = "27261905640092552";

export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
export const SEC_CH_UA_120 =
  '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"';
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
  isCheckpoint?: boolean;
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
 * 1. CHECK LIVE & TỰ ĐỘNG LẤY USERNAME/ID/AVATAR TỪ COOKIE CHUẨN TA TOOL / XSMM
 * Endpoint: https://www.instagram.com/api/v1/accounts/edit/web_form_data/
 */
export async function checkCookieIg(
  cookieStr: string,
  proxy?: string,
): Promise<IgCookieInfo> {
  const cookie = normalizeCookie(cookieStr);
  if (!cookie.trim()) {
    return { isLive: false, username: "", userId: "" };
  }

  const cookies = parseCookie(cookie);
  const dsMatch = cookie.match(/ds_user_id=(\d+)/);
  let userId = dsMatch?.[1] || cookies.ds_user_id || "";

  try {
    const raw = await executeCurlRequest({
      url: "https://www.instagram.com/api/v1/accounts/edit/web_form_data/",
      method: "GET",
      cookie,
      proxy,
      headers: [
        `User-Agent: ${BROWSER_UA}`,
        `X-IG-App-ID: ${APP_ID}`,
        "X-Requested-With: XMLHttpRequest",
        "Referer: https://www.instagram.com/accounts/edit/",
        'sec-ch-ua: "Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "sec-ch-ua-mobile: ?0",
        'sec-ch-ua-platform: "Windows"',
        "Accept: */*",
        "Accept-Language: vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
      ],
      timeoutSecs: 25,
    });

    let isLive = false;
    let username = "";
    let isCheckpoint = false;
    let fullName = "";
    let avatarUrl = "";

    try {
      const configdata = JSON.parse(raw);
      if (
        configdata &&
        typeof configdata === "object" &&
        configdata.form_data &&
        configdata.form_data.username
      ) {
        isLive = true;
        username = String(configdata.form_data.username).trim();
        fullName =
          configdata.form_data.first_name ||
          configdata.form_data.full_name ||
          "";
        if (configdata.form_data.id) {
          userId = String(configdata.form_data.id);
        }
      } else {
        const msg = String(configdata?.message || "").toLowerCase();
        const errType = String(configdata?.error_type || "").toLowerCase();
        if (
          msg.includes("checkpoint") ||
          msg.includes("challenge") ||
          errType.includes("checkpoint") ||
          configdata?.checkpoint_url
        ) {
          isCheckpoint = true;
        }
      }
    } catch {
      const lower = raw.toLowerCase();
      if (
        lower.includes("checkpoint_required") ||
        lower.includes("challenge_required") ||
        lower.includes("accounts/suspended") ||
        lower.includes("1357031")
      ) {
        isCheckpoint = true;
      }
    }

    // Fallback: Nếu web_form_data chưa xác nhận Live và không bị checkpoint, kiểm tra trực tiếp qua endpoint Native API
    if (!isLive && !isCheckpoint && userId && userId !== "0") {
      try {
        const userRes = await executeCurlRequest({
          url: `https://i.instagram.com/api/v1/users/${userId}/info/`,
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
          isLive = true;
          if (!username) username = userObj.username || "";
          if (!fullName) fullName = userObj.full_name || "";
          const hdPic = userObj.hd_profile_pic_url_info?.url;
          const regPic = userObj.profile_pic_url;
          avatarUrl = hdPic || regPic || "";
        }
      } catch {
        // ignore
      }
    }

    if (!isLive) {
      return {
        isLive: false,
        isCheckpoint,
        username: "",
        userId,
      };
    }

    // Nếu Live, lấy thêm avatar từ API /api/v1/users/{userId}/info/ nếu có userId và chưa có avatar
    if (userId && userId !== "0" && !avatarUrl) {
      try {
        const userRes = await executeCurlRequest({
          url: `https://i.instagram.com/api/v1/users/${userId}/info/`,
          method: "GET",
          cookie,
          proxy,
          headers: [
            `User-Agent: ${NATIVE_APP_UA}`,
            `X-IG-App-ID: ${APP_ID}`,
            "X-IG-Connection-Type: WIFI",
            "X-IG-Capabilities: 3brBvw==",
          ],
          timeoutSecs: 8,
        });
        const userJson = JSON.parse(userRes);
        const userObj = userJson.user;
        if (userObj) {
          if (!username) username = userObj.username || "";
          if (!fullName) fullName = userObj.full_name || "";
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
      isCheckpoint: false,
      username: username || userId,
      userId,
      fullName: fullName || undefined,
      avatar: avatarUrl || undefined,
    };
  } catch {
    return { isLive: false, username: "", userId };
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
 * 2. FOLLOW INSTAGRAM (Chuẩn 100% TA Tool V2 - DOC_FOLLOW = 26508036048874888)
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

  const profileUrl =
    targetUrl ||
    (targetUsername
      ? `https://www.instagram.com/${targetUsername.replace(/^@/, "")}/`
      : "https://www.instagram.com/");

  // Trích xuất lsd, fb_dtsg, jazoest chuẩn TA Tool
  let fbDtsg = inputTokens?.dtsg || "";
  let lsd = inputTokens?.lsd || "Jfq8VQNmkkkJufHSbEE9bf";
  let jazoest = inputTokens?.jazoest || "26328";

  if (!fbDtsg || !inputTokens?.lsd) {
    try {
      const homeRes = await executeCurlRequest({
        url: profileUrl,
        method: "GET",
        cookie,
        proxy,
        headers: [
          `User-Agent: ${BROWSER_UA}`,
          `sec-ch-ua: ${SEC_CH_UA_120}`,
          "sec-ch-ua-mobile: ?0",
          'sec-ch-ua-platform: "Windows"',
        ],
        timeoutSecs: 10,
      });

      const lsdM = homeRes.match(/"LSD",\[\],\{"token":"([^"]+)"\}/);
      if (lsdM?.[1]) lsd = lsdM[1];

      const dtsgM =
        homeRes.match(/"dtsg":\{"token":"([^"]+)"/) ||
        homeRes.match(/name="fb_dtsg" value="([^"]+)"/);
      if (dtsgM?.[1]) fbDtsg = dtsgM[1];

      const jazoestM = homeRes.match(/name="jazoest" value="(\d+)"/);
      if (jazoestM?.[1]) jazoest = jazoestM[1];
    } catch {
      // ignore
    }
  }

  const csrf = getCsrfToken(cookie) || "missing";
  const actorId = getActorId(cookie) || "0";

  const variables = {
    target_user_id: uid,
    container_module: "profile",
    nav_chain:
      "PolarisFeedRoot:feedPage:5:topnav-link,PolarisProfileRoot:profilePage:6:unexpected",
  };

  const bodyParams = new URLSearchParams({
    av: actorId,
    __d: "www",
    __user: "0",
    __a: "1",
    __req: "s",
    __hs: "20702.HYP:instagram_web_pkg.2.1...0",
    dpr: "1",
    __ccg: "EXCELLENT",
    __rev: "1046917461",
    __comet_req: "7",
    fb_dtsg: fbDtsg,
    jazoest: jazoest,
    lsd: lsd,
    fb_api_caller_class: "RelayModern",
    fb_api_req_friendly_name: "usePolarisFollowMutation",
    server_timestamps: "true",
    doc_id: DOC_FOLLOW,
    variables: JSON.stringify(variables),
  });

  const headers = [
    "accept: */*",
    "accept-language: vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
    "content-type: application/x-www-form-urlencoded",
    "origin: https://www.instagram.com",
    "priority: u=1, i",
    `referer: ${profileUrl}`,
    `sec-ch-ua: ${SEC_CH_UA_120}`,
    "sec-ch-ua-mobile: ?0",
    'sec-ch-ua-platform: "Windows"',
    "sec-fetch-dest: empty",
    "sec-fetch-mode: cors",
    "sec-fetch-site: same-origin",
    `user-agent: ${BROWSER_UA}`,
    `x-asbd-id: ${ASBD_ID}`,
    `x-csrftoken: ${csrf}`,
    `x-ig-app-id: ${APP_ID}`,
    "x-ig-www-claim: 0",
    "x-requested-with: XMLHttpRequest",
  ];

  try {
    const res = await executeCurlRequest({
      url: GRAPHQL_URL,
      method: "POST",
      body: bodyParams.toString(),
      cookie,
      headers,
      proxy,
      timeoutSecs: 15,
    });

    try {
      const g = JSON.parse(res);
      if (g.data || g.status === "ok" || g.status === "success") {
        return { isSuccess: true, httpCode: 200, rawBody: res };
      }
      return {
        isSuccess: false,
        httpCode: 400,
        rawBody: res,
        errorMessage: g.message || "Bị IG chặn thao tác",
      };
    } catch {
      if (
        res.includes('"status":"ok"') ||
        res.includes('"following":true') ||
        res.includes('"outgoing_request":true')
      ) {
        return { isSuccess: true, httpCode: 200, rawBody: res };
      }
      return {
        isSuccess: false,
        httpCode: 400,
        rawBody: res,
        errorMessage: "Lỗi phản hồi JSON",
      };
    }
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
 * 3. LIKE / TYM MEDIA INSTAGRAM (Chuẩn 100% TA Tool V2 - DOC_LIKE = 27182485238052618)
 */
export async function doLike(options: {
  cookie: string;
  mediaIdOrUrl: string;
  linkJob?: string;
  proxy?: string;
  tokens?: IgPageTokens;
  userId?: string;
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

  const referer = linkJob || "https://www.instagram.com/";

  // Trích xuất lsd, fb_dtsg, jazoest, tracking_token chuẩn TA Tool
  let fbDtsg = inputTokens?.dtsg || "";
  let lsd = inputTokens?.lsd || "GyeZl-huflHZ0K5L3-pzBi";
  let jazoest = inputTokens?.jazoest || "26492";
  let trackingToken = "";

  try {
    const pageRes = await executeCurlRequest({
      url: referer,
      method: "GET",
      cookie,
      proxy,
      headers: [
        `User-Agent: ${BROWSER_UA}`,
        `sec-ch-ua: ${SEC_CH_UA_120}`,
        "sec-ch-ua-mobile: ?0",
        'sec-ch-ua-platform: "Windows"',
      ],
      timeoutSecs: 10,
    });

    const lsdM = pageRes.match(/"LSD",\[\],\{"token":"([^"]+)"\}/);
    if (lsdM?.[1]) lsd = lsdM[1];

    const dtsgM =
      pageRes.match(/"dtsg":\{"token":"([^"]+)"/) ||
      pageRes.match(/name="fb_dtsg" value="([^"]+)"/);
    if (dtsgM?.[1]) fbDtsg = dtsgM[1];

    const jazoestM = pageRes.match(/name="jazoest" value="(\d+)"/);
    if (jazoestM?.[1]) jazoest = jazoestM[1];

    const ttM = pageRes.match(/"tracking_token":"([^"]+)"/);
    if (ttM?.[1]) trackingToken = ttM[1];
  } catch {
    // ignore
  }

  const csrf = getCsrfToken(cookie) || "missing";
  const actorId = getActorId(cookie) || "0";

  const variables: Record<string, unknown> = {
    input: {
      actor_id: actorId,
      client_mutation_id: String(
        Math.floor(Math.random() * 9000000) + 1000000,
      ),
      container_module: "single_post",
      media_id: String(mediaId),
    },
  };
  if (trackingToken) {
    (variables.input as Record<string, unknown>).tracking_token = trackingToken;
  }

  const bodyParams = new URLSearchParams({
    av: actorId,
    __d: "www",
    __user: "0",
    __a: "1",
    __req: "h",
    __hs: "20702.HYP:instagram_web_pkg.2.1...0",
    dpr: "1",
    __ccg: "EXCELLENT",
    __rev: "1046913831",
    __comet_req: "7",
    fb_dtsg: fbDtsg,
    jazoest: jazoest,
    lsd: lsd,
    fb_api_caller_class: "RelayModern",
    fb_api_req_friendly_name: "usePolarisLikeMediaXIGLikeMutation",
    server_timestamps: "true",
    doc_id: DOC_LIKE,
    variables: JSON.stringify(variables),
  });

  const headers = [
    "accept: */*",
    "accept-language: vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
    "content-type: application/x-www-form-urlencoded",
    "origin: https://www.instagram.com",
    "priority: u=1, i",
    `referer: ${referer}`,
    `sec-ch-ua: ${SEC_CH_UA_120}`,
    "sec-ch-ua-mobile: ?0",
    'sec-ch-ua-platform: "Windows"',
    "sec-fetch-dest: empty",
    "sec-fetch-mode: cors",
    "sec-fetch-site: same-origin",
    `user-agent: ${BROWSER_UA}`,
    `x-asbd-id: ${ASBD_ID}`,
    `x-csrftoken: ${csrf}`,
    `x-ig-app-id: ${APP_ID}`,
    "x-ig-www-claim: 0",
    "x-requested-with: XMLHttpRequest",
  ];

  try {
    const res = await executeCurlRequest({
      url: GRAPHQL_URL,
      method: "POST",
      body: bodyParams.toString(),
      cookie,
      headers,
      proxy,
      timeoutSecs: 15,
    });

    try {
      const g = JSON.parse(res);
      if (g.data || g.status === "ok") {
        return { isSuccess: true, httpCode: 200, rawBody: res };
      }
      return {
        isSuccess: false,
        httpCode: 400,
        rawBody: res,
        errorMessage: g.message || "Bị IG chặn thao tác",
      };
    } catch {
      if (
        res.includes('"status":"ok"') ||
        res.includes('"viewer_has_liked":true')
      ) {
        return { isSuccess: true, httpCode: 200, rawBody: res };
      }
      return {
        isSuccess: false,
        httpCode: 400,
        rawBody: res,
        errorMessage: "Lỗi phản hồi JSON",
      };
    }
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
 * 4. COMMENT INSTAGRAM (Chuẩn 100% TA Tool V2 - DOC_COMMENT = 27261905640092552)
 */
export async function doComment(options: {
  cookie: string;
  mediaIdOrUrl: string;
  text: string;
  linkJob?: string;
  proxy?: string;
  tokens?: IgPageTokens;
  userId?: string;
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

  const referer = linkJob || "https://www.instagram.com/";

  // Trích xuất lsd, fb_dtsg, jazoest chuẩn TA Tool
  let fbDtsg = inputTokens?.dtsg || "";
  let lsd = inputTokens?.lsd || "9zei3OjvTBQ-9YG6E0OMzm";
  let jazoest = inputTokens?.jazoest || "26312";

  try {
    const pageRes = await executeCurlRequest({
      url: referer,
      method: "GET",
      cookie,
      proxy,
      headers: [
        `User-Agent: ${BROWSER_UA}`,
        `sec-ch-ua: ${SEC_CH_UA_120}`,
        "sec-ch-ua-mobile: ?0",
        'sec-ch-ua-platform: "Windows"',
      ],
      timeoutSecs: 10,
    });

    const lsdM = pageRes.match(/"LSD",\[\],\{"token":"([^"]+)"\}/);
    if (lsdM?.[1]) lsd = lsdM[1];

    const dtsgM =
      pageRes.match(/"dtsg":\{"token":"([^"]+)"/) ||
      pageRes.match(/name="fb_dtsg" value="([^"]+)"/);
    if (dtsgM?.[1]) fbDtsg = dtsgM[1];

    const jazoestM = pageRes.match(/name="jazoest" value="(\d+)"/);
    if (jazoestM?.[1]) jazoest = jazoestM[1];
  } catch {
    // ignore
  }

  const csrf = getCsrfToken(cookie) || "missing";
  const actorId = getActorId(cookie) || "0";

  const variables = {
    connections: [
      `client:root:__PolarisPostComments__xdt_api__v1__media__media_id__comments__connection_connection(data:{},media_id:"${mediaId}",sort_order:"popular")`,
    ],
    data: { comment_text: text, media_id: String(mediaId) },
  };

  const bodyParams = new URLSearchParams({
    av: actorId,
    __d: "www",
    __user: "0",
    __a: "1",
    __req: "10",
    __hs: "20702.HYP:instagram_web_pkg.2.1...0",
    dpr: "1",
    __ccg: "EXCELLENT",
    __rev: "1046917461",
    __comet_req: "7",
    fb_dtsg: fbDtsg,
    jazoest: jazoest,
    lsd: lsd,
    fb_api_caller_class: "RelayModern",
    fb_api_req_friendly_name: "PolarisPostCommentInputRevampedMutation",
    server_timestamps: "true",
    doc_id: DOC_COMMENT,
    variables: JSON.stringify(variables),
  });

  const headers = [
    "accept: */*",
    "accept-language: vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
    "content-type: application/x-www-form-urlencoded",
    "origin: https://www.instagram.com",
    "priority: u=1, i",
    `referer: ${referer}`,
    `sec-ch-ua: ${SEC_CH_UA_120}`,
    "sec-ch-ua-mobile: ?0",
    'sec-ch-ua-platform: "Windows"',
    "sec-fetch-dest: empty",
    "sec-fetch-mode: cors",
    "sec-fetch-site: same-origin",
    `user-agent: ${BROWSER_UA}`,
    `x-asbd-id: ${ASBD_ID}`,
    `x-csrftoken: ${csrf}`,
    `x-ig-app-id: ${APP_ID}`,
    "x-ig-www-claim: 0",
    "x-requested-with: XMLHttpRequest",
  ];

  try {
    const res = await executeCurlRequest({
      url: GRAPHQL_URL,
      method: "POST",
      body: bodyParams.toString(),
      cookie,
      headers,
      proxy,
      timeoutSecs: 15,
    });

    try {
      const g = JSON.parse(res);
      if (g.status === "ok" || g.data) {
        return { isSuccess: true, httpCode: 200, rawBody: res };
      }
      return {
        isSuccess: false,
        httpCode: 400,
        rawBody: res,
        errorMessage: g.message || "Bị IG chặn cmt",
      };
    } catch {
      if (res.includes('"status":"ok"')) {
        return { isSuccess: true, httpCode: 200, rawBody: res };
      }
      return {
        isSuccess: false,
        httpCode: 400,
        rawBody: res,
        errorMessage: "Lỗi phản hồi JSON",
      };
    }
  } catch (err: unknown) {
    return {
      isSuccess: false,
      httpCode: 0,
      rawBody: "",
      errorMessage: err instanceof Error ? err.message : "Lỗi kết nối",
    };
  }
}

