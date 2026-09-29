import { executeCurlRequest } from "./facebook-api";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const SEC_CH_UA =
  '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"';
const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export interface IgCookieInfo {
  isLive: boolean;
  username: string;
  userId: string;
  avatar?: string;
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
 * Trích xuất các token từ chuỗi cookie Instagram
 */
export function extractTokensFromCookie(
  cookie: string,
): Record<string, string> {
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

/**
 * Lấy csrf_token từ chuỗi cookie
 */
export function getCsrfToken(cookie: string): string {
  const match = cookie.match(/csrftoken=([^;]+)/);
  return match?.[1] ? match[1].trim() : "missing";
}

/**
 * Lấy actor ID từ ds_user_id trong cookie
 */
export function getActorId(cookie: string): string {
  const match = cookie.match(/ds_user_id=(\d+)/);
  return match?.[1] ? match[1].trim() : "0";
}

/**
 * Chuyển đổi Instagram shortcode sang numeric Media ID (dùng BigInt)
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
 * Trích xuất shortcode từ URL bài viết Instagram (/p/..., /reel/..., /tv/...)
 */
export function extractShortcode(url: string): string | null {
  const match = url.match(/\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return match?.[1] ?? null;
}

/**
 * 1. KIỂM TRA TÌNH TRẠNG COOKIE INSTAGRAM (chuẩn TA Tool - check_cookie_ig kết hợp fallback)
 */
export async function checkCookieIg(
  cookie: string,
  proxy?: string,
): Promise<IgCookieInfo> {
  const cleanCookie = cookie.replace(/[\r\n]+/g, "").trim();
  const dsMatch = cleanCookie.match(/ds_user_id=(\d+)/);
  const fallbackUid = dsMatch?.[1] || "";

  // 1. Thử qua endpoint web_form_data (TA Tool - chuẩn)
  try {
    const raw = await executeCurlRequest({
      url: "https://www.instagram.com/api/v1/accounts/edit/web_form_data/",
      method: "GET",
      cookie: cleanCookie,
      proxy,
      headers: [
        "x-ig-app-id: 936619743392459",
        "x-requested-with: XMLHttpRequest",
        "referer: https://www.instagram.com/accounts/edit/",
        `User-Agent: ${USER_AGENT}`,
        `sec-ch-ua: ${SEC_CH_UA}`,
      ],
    });

    if (raw?.trim()) {
      try {
        const json = JSON.parse(raw);
        const formData = json.form_data;
        if (formData?.username) {
          const username = String(formData.username).trim();
          const uid = fallbackUid || String(formData.id || "");
          return { isLive: true, username, userId: uid };
        }
      } catch {
        // Tiếp tục thử fallback bên dưới
      }
    }
  } catch {
    // Tiếp tục thử fallback
  }

  // 2. Thử qua endpoint current_user/?edit=true
  try {
    const raw = await executeCurlRequest({
      url: "https://www.instagram.com/api/v1/accounts/current_user/?edit=true",
      method: "GET",
      cookie: cleanCookie,
      proxy,
      headers: [
        "x-ig-app-id: 936619743392459",
        "x-requested-with: XMLHttpRequest",
        `User-Agent: ${USER_AGENT}`,
        `sec-ch-ua: ${SEC_CH_UA}`,
      ],
    });

    if (raw?.trim()) {
      try {
        const json = JSON.parse(raw);
        const user = json.user;
        if (user?.username) {
          const username = String(user.username).trim();
          const uid = String(user.pk || fallbackUid || "");
          const avatar = user.profile_pic_url || "";
          return { isLive: true, username, userId: uid, avatar };
        }
      } catch {
        // Tiếp tục thử fallback
      }
    }
  } catch {
    // Tiếp tục thử fallback
  }

  // 3. Thử qua trang chủ https://www.instagram.com/
  try {
    const html = await executeCurlRequest({
      url: "https://www.instagram.com/",
      method: "GET",
      cookie: cleanCookie,
      proxy,
      headers: [
        `User-Agent: ${USER_AGENT}`,
        `sec-ch-ua: ${SEC_CH_UA}`,
        "sec-ch-ua-mobile: ?0",
        'sec-ch-ua-platform: "Windows"',
        "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ],
    });

    if (html?.trim()) {
      const lower = html.toLowerCase();
      const isDead =
        lower.includes("login_required") ||
        lower.includes("checkpoint_required") ||
        lower.includes("challenge_required") ||
        lower.includes('"is_logged_in":false') ||
        lower.includes("accounts/suspended") ||
        lower.includes("1357031");

      if (isDead) {
        return { isLive: false, username: "", userId: fallbackUid };
      }

      const uMatch =
        html.match(/"username"\s*:\s*"([^"]+)"/) ||
        html.match(/username":"([^"]+)"/) ||
        html.match(/"viewer"\s*:\s*\{"username"\s*:\s*"([^"]+)"/);
      if (uMatch?.[1]) {
        return {
          isLive: true,
          username: uMatch[1],
          userId: fallbackUid,
        };
      }
    }
  } catch {
    // Tiếp tục
  }

  // 4. Nếu có sessionid và ds_user_id trong cookie và không bị phát hiện checkpoint
  if (cleanCookie.includes("sessionid=") && fallbackUid) {
    return {
      isLive: true,
      username: fallbackUid,
      userId: fallbackUid,
    };
  }

  return { isLive: false, username: "", userId: fallbackUid };
}

/**
 * 2. TRÍCH XUẤT META TOKENS (fb_dtsg, lsd, jazoest)
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
        `User-Agent: ${USER_AGENT}`,
        `sec-ch-ua: ${SEC_CH_UA}`,
        "sec-ch-ua-mobile: ?0",
        'sec-ch-ua-platform: "Windows"',
      ],
    });

    // 1. Trích xuất lsd
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

    // 2. Trích xuất fb_dtsg
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
    }
  } catch {
    // ignore
  }

  return { dtsg: fbDtsg, lsd, jazoest };
}

/**
 * Tạo danh sách Headers chuẩn Instagram Web cho GraphQL / REST requests
 */
function buildIgHeaders(
  _cookie: string,
  csrftoken: string,
  lsd = "",
  referer = "https://www.instagram.com/",
): string[] {
  const headers = [
    "accept: */*",
    "accept-language: vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    "content-type: application/x-www-form-urlencoded",
    "origin: https://www.instagram.com",
    `referer: ${referer}`,
    `sec-ch-ua: ${SEC_CH_UA}`,
    "sec-ch-ua-mobile: ?0",
    'sec-ch-ua-platform: "Windows"',
    "sec-fetch-dest: empty",
    "sec-fetch-mode: cors",
    "sec-fetch-site: same-origin",
    `user-agent: ${USER_AGENT}`,
    "x-asbd-id: 129477",
    `x-csrftoken: ${csrftoken}`,
    "x-ig-app-id: 936619743392459",
    "x-ig-www-claim: 0",
    "x-requested-with: XMLHttpRequest",
  ];
  if (lsd) {
    headers.push(`x-fb-lsd: ${lsd}`);
  }
  return headers;
}

/**
 * 3. HÀM FOLLOW INSTAGRAM (GraphQL Query Chuẩn Meta Web - usePolarisFollowMutation)
 */
export async function doFollow(options: {
  cookie: string;
  targetNumericId: string;
  targetUsername?: string;
  targetUrl?: string;
  tokens?: IgPageTokens;
  proxy?: string;
  userId?: string;
}): Promise<IgActionResult> {
  const {
    cookie,
    targetNumericId,
    targetUsername,
    targetUrl,
    tokens: inputTokens,
    proxy,
    userId,
  } = options;

  let targetId = targetNumericId.trim();
  if (!targetId || !/^\d+$/.test(targetId)) {
    const extracted = targetUrl
      ? await extractTargetIdFromUrl(cookie, targetUrl, proxy)
      : null;
    targetId =
      extracted ||
      (targetUsername
        ? await resolveTargetUid(cookie, targetUsername, proxy)
        : null) ||
      targetNumericId;
  }

  if (!targetId) {
    return {
      isSuccess: false,
      httpCode: 400,
      rawBody: "",
      errorMessage: "Lỗi Target ID đối tượng",
    };
  }

  const tokens =
    inputTokens?.dtsg && inputTokens.lsd
      ? inputTokens
      : await extractPageTokens(
          cookie,
          "https://www.instagram.com/",
          proxy,
          inputTokens?.dtsg,
          inputTokens?.lsd,
        );

  if (!tokens.dtsg || !tokens.lsd) {
    return {
      isSuccess: false,
      httpCode: 400,
      rawBody: "",
      errorMessage: "Không lấy được fb_dtsg/lsd của Instagram",
    };
  }

  const csrftoken = getCsrfToken(cookie);
  const actorId = userId?.trim() || getActorId(cookie);
  const avId =
    actorId && actorId !== "0"
      ? !actorId.startsWith("178414")
        ? `178414${actorId}`
        : actorId
      : actorId;

  const docIds = ["9740159112729312", "9663809173698092", "26508036048874888"];
  let lastResult = "";

  for (const docId of docIds) {
    const variables = JSON.stringify({ target_user_id: targetId });
    const bodyParams = new URLSearchParams({
      av: avId,
      __user: actorId,
      fb_dtsg: tokens.dtsg,
      jazoest: tokens.jazoest,
      lsd: tokens.lsd,
      doc_id: docId,
      variables,
    });

    const headers = [
      ...buildIgHeaders(
        cookie,
        csrftoken,
        tokens.lsd,
        targetUrl || "https://www.instagram.com/",
      ),
      "x-fb-friendly-name: usePolarisFollowMutation",
    ];

    const targetEndpoint =
      docId === "26508036048874888"
        ? "https://www.instagram.com/api/graphql"
        : "https://www.instagram.com/graphql/query";

    try {
      const resBody = await executeCurlRequest({
        url: targetEndpoint,
        method: "POST",
        body: bodyParams.toString(),
        cookie,
        headers,
        proxy,
      });
      lastResult = resBody.trim();
      const parsed = parseIgResult(lastResult, "Follow");
      if (parsed.isSuccess) {
        return parsed;
      }
      if (!lastResult.includes("1357004") && lastResult) {
        return parsed;
      }
    } catch (e: unknown) {
      lastResult = JSON.stringify({
        status: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return parseIgResult(lastResult, "Follow");
}

/**
 * 4. HÀM TYM / LIKE INSTAGRAM (Ưu tiên REST API Web Like + Dự phòng GraphQL)
 */
export async function doLike(options: {
  cookie: string;
  mediaIdOrUrl: string;
  linkJob?: string;
  tokens?: IgPageTokens;
  proxy?: string;
  userId?: string;
}): Promise<IgActionResult> {
  const {
    cookie,
    mediaIdOrUrl,
    linkJob = "",
    tokens: inputTokens,
    proxy,
    userId,
  } = options;

  let mediaId = mediaIdOrUrl.trim();
  if (!mediaId || !/^\d+$/.test(mediaId)) {
    const sc = extractShortcode(linkJob) || extractShortcode(mediaIdOrUrl);
    if (sc) {
      mediaId = shortcodeToMediaId(sc) || mediaId;
    }
  }
  if (!mediaId || !/^\d+$/.test(mediaId)) {
    const targetLink =
      linkJob ||
      (mediaIdOrUrl.startsWith("http")
        ? mediaIdOrUrl
        : `https://www.instagram.com/p/${mediaIdOrUrl}/`);
    const extracted = await extractMediaIdFromPage(cookie, targetLink, proxy);
    if (extracted) mediaId = extracted;
  }

  if (!mediaId || !/^\d+$/.test(mediaId)) {
    return {
      isSuccess: false,
      httpCode: 400,
      rawBody: "",
      errorMessage: "Không tìm thấy Media ID để Like",
    };
  }

  const csrftoken = getCsrfToken(cookie);

  // 1. Thử REST API Web Like
  try {
    const restRes = await executeCurlRequest({
      url: `https://www.instagram.com/api/v1/web/likes/${mediaId}/like/`,
      method: "POST",
      cookie,
      proxy,
      headers: [
        `User-Agent: ${USER_AGENT}`,
        `X-CSRFToken: ${csrftoken}`,
        "X-Instagram-AJAX: 1006309104",
        "X-Requested-With: XMLHttpRequest",
        "X-IG-App-ID: 936619743392459",
        "X-ASBD-ID: 129477",
        `Referer: ${linkJob || "https://www.instagram.com/"}`,
      ],
    });

    if (
      restRes &&
      (restRes.includes('"status":"ok"') ||
        restRes.includes('"status": "ok"') ||
        restRes.includes('"viewer_has_liked":true'))
    ) {
      return { isSuccess: true, httpCode: 200, rawBody: restRes };
    }
  } catch {
    // fallback sang GraphQL
  }

  // 2. Fallback sang GraphQL Like (doc_id 9595477160535898 hoặc 27182485238052618)
  const tokens =
    inputTokens?.dtsg && inputTokens.lsd
      ? inputTokens
      : await extractPageTokens(
          cookie,
          linkJob || "https://www.instagram.com/",
          proxy,
          inputTokens?.dtsg,
          inputTokens?.lsd,
        );

  if (!tokens.dtsg || !tokens.lsd) {
    return {
      isSuccess: false,
      httpCode: 400,
      rawBody: "",
      errorMessage: "Không lấy được fb_dtsg/lsd của Instagram",
    };
  }

  const actorId = userId?.trim() || getActorId(cookie);
  const avId =
    actorId && actorId !== "0"
      ? !actorId.startsWith("178414")
        ? `178414${actorId}`
        : actorId
      : actorId;

  const graphConfigs = [
    {
      docId: "9595477160535898",
      variables: JSON.stringify({
        media_id: mediaId,
        container_module: "feed_timeline",
      }),
    },
    {
      docId: "27182485238052618",
      variables: JSON.stringify({
        input: {
          actor_id: actorId,
          client_mutation_id: String(
            Math.floor(1000000 + Math.random() * 9000000),
          ),
          container_module: "single_post",
          media_id: mediaId,
        },
      }),
    },
  ];

  let lastResult = "";
  for (const { docId, variables } of graphConfigs) {
    const bodyParams = new URLSearchParams({
      av: avId,
      __d: "www",
      __user: actorId,
      __a: "1",
      __req: "h",
      __hs: "20702.HYP:instagram_web_pkg.2.1...0",
      dpr: "1",
      __ccg: "EXCELLENT",
      __rev: "1046913831",
      __comet_req: "7",
      fb_dtsg: tokens.dtsg,
      jazoest: tokens.jazoest,
      lsd: tokens.lsd,
      fb_api_caller_class: "RelayModern",
      fb_api_req_friendly_name: "usePolarisLikeMediaXIGLikeMutation",
      server_timestamps: "true",
      doc_id: docId,
      variables,
    });

    const headers = [
      ...buildIgHeaders(
        cookie,
        csrftoken,
        tokens.lsd,
        linkJob || "https://www.instagram.com/",
      ),
      "x-fb-friendly-name: usePolarisLikeMediaXIGLikeMutation",
    ];

    try {
      const resBody = await executeCurlRequest({
        url: "https://www.instagram.com/graphql/query",
        method: "POST",
        body: bodyParams.toString(),
        cookie,
        headers,
        proxy,
      });
      lastResult = resBody.trim();
      const parsed = parseIgResult(lastResult, "Tym");
      if (parsed.isSuccess) return parsed;
    } catch (e: unknown) {
      lastResult = JSON.stringify({
        status: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return parseIgResult(lastResult, "Tym");
}

/**
 * 5. HÀM BÌNH LUẬN INSTAGRAM (PolarisPostCommentInputRevampedMutation)
 */
export async function doComment(options: {
  cookie: string;
  mediaIdOrUrl: string;
  text: string;
  linkJob?: string;
  tokens?: IgPageTokens;
  proxy?: string;
  userId?: string;
}): Promise<IgActionResult> {
  const {
    cookie,
    mediaIdOrUrl,
    text,
    linkJob = "",
    tokens: inputTokens,
    proxy,
    userId,
  } = options;

  let mediaId = mediaIdOrUrl.trim();
  if (!mediaId || !/^\d+$/.test(mediaId)) {
    const sc = extractShortcode(linkJob) || extractShortcode(mediaIdOrUrl);
    if (sc) {
      mediaId = shortcodeToMediaId(sc) || mediaId;
    }
  }
  if (!mediaId || !/^\d+$/.test(mediaId)) {
    const targetLink =
      linkJob ||
      (mediaIdOrUrl.startsWith("http")
        ? mediaIdOrUrl
        : `https://www.instagram.com/p/${mediaIdOrUrl}/`);
    const extracted = await extractMediaIdFromPage(cookie, targetLink, proxy);
    if (extracted) mediaId = extracted;
  }

  if (!mediaId || !/^\d+$/.test(mediaId)) {
    return {
      isSuccess: false,
      httpCode: 400,
      rawBody: "",
      errorMessage: "Không tìm thấy Media ID để Comment",
    };
  }

  const tokens =
    inputTokens?.dtsg && inputTokens.lsd
      ? inputTokens
      : await extractPageTokens(
          cookie,
          linkJob || "https://www.instagram.com/",
          proxy,
          inputTokens?.dtsg,
          inputTokens?.lsd,
        );

  if (!tokens.dtsg || !tokens.lsd) {
    return {
      isSuccess: false,
      httpCode: 400,
      rawBody: "",
      errorMessage: "Không lấy được fb_dtsg/lsd của Instagram",
    };
  }

  const csrftoken = getCsrfToken(cookie);
  const actorId = userId?.trim() || getActorId(cookie);
  const avId =
    actorId && actorId !== "0"
      ? !actorId.startsWith("178414")
        ? `178414${actorId}`
        : actorId
      : actorId;

  const variables = JSON.stringify({
    connections: [
      `client:root:__PolarisPostComments__xdt_api__v1__media__media_id__comments__connection_connection(data:{},media_id:"${mediaId}",sort_order:"popular")`,
    ],
    data: {
      comment_text: text,
      media_id: mediaId,
    },
  });

  const bodyParams = new URLSearchParams({
    av: avId,
    __d: "www",
    __user: actorId,
    __a: "1",
    __req: "10",
    __hs: "20702.HYP:instagram_web_pkg.2.1...0",
    dpr: "1",
    __ccg: "EXCELLENT",
    __rev: "1046917461",
    __comet_req: "7",
    fb_dtsg: tokens.dtsg,
    jazoest: tokens.jazoest,
    lsd: tokens.lsd,
    fb_api_caller_class: "RelayModern",
    fb_api_req_friendly_name: "PolarisPostCommentInputRevampedMutation",
    server_timestamps: "true",
    doc_id: "27261905640092552",
    variables,
  });

  const headers = [
    ...buildIgHeaders(
      cookie,
      csrftoken,
      tokens.lsd,
      linkJob || "https://www.instagram.com/",
    ),
    "x-fb-friendly-name: PolarisPostCommentInputRevampedMutation",
  ];

  const endpoints = [
    "https://www.instagram.com/graphql/query",
    "https://www.instagram.com/api/graphql",
  ];
  let lastResult = "";
  for (const ep of endpoints) {
    try {
      const resBody = await executeCurlRequest({
        url: ep,
        method: "POST",
        body: bodyParams.toString(),
        cookie,
        headers,
        proxy,
      });
      lastResult = resBody.trim();
      const parsed = parseIgResult(lastResult, "Comment");
      if (parsed.isSuccess) return parsed;
      if (!lastResult.includes("1357004") && lastResult) return parsed;
    } catch (e: unknown) {
      lastResult = JSON.stringify({
        status: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return parseIgResult(lastResult, "Comment");
}

/**
 * 6. PHÂN TÍCH PHẢN HỒI INSTAGRAM (Bóc tách mã lỗi Meta chuẩn xác 100%)
 */
export function parseIgResult(
  rawBody: string,
  defaultActionName: string,
): IgActionResult {
  if (!rawBody?.trim()) {
    return {
      isSuccess: false,
      httpCode: 0,
      rawBody: "",
      errorMessage: "Phản hồi rỗng từ Instagram",
    };
  }

  let cleanBody = rawBody.trim();
  if (cleanBody.startsWith("for (;;);")) {
    cleanBody = cleanBody.replace(/^for \(;;\);/, "").trim();
  }

  try {
    const root = JSON.parse(cleanBody);

    // 0. Bóc tách lỗi 1357004 của Meta
    if (root.error === 1357004) {
      const summary = root.errorSummary || "Rất tiếc, đã xảy ra lỗi";
      const desc =
        root.errorDescription || "Vui lòng thử lại với một trình duyệt khác.";
      return {
        isSuccess: false,
        httpCode: 400,
        rawBody,
        errorMessage: `${summary}: ${desc} (Mã lỗi 1357004 - Meta từ chối phiên)`,
      };
    }

    // 1. Kiểm tra mảng lỗi GraphQL
    if (Array.isArray(root.errors) && root.errors.length > 0) {
      const firstErr = root.errors[0];
      const msg = firstErr.message || "";
      if (msg.toLowerCase().includes("already")) {
        return { isSuccess: true, httpCode: 200, rawBody };
      }
      const summary = firstErr.summary || "";
      const desc = firstErr.description || "";
      const errorText = [summary, desc, msg].filter(Boolean).join(": ");
      return {
        isSuccess: false,
        httpCode: 400,
        rawBody,
        errorMessage: errorText || "Lỗi GraphQL Instagram",
      };
    }

    // 2. Kiểm tra các mã lỗi nghiệp vụ
    const msg = root.message || "";
    const statusStr = root.status || "";
    const spam = Boolean(root.spam);
    const feedbackTitle = root.feedback_title || "";
    const feedbackMessage = root.feedback_message || "";

    if (
      statusStr.toLowerCase() === "fail" ||
      spam ||
      (statusStr.toLowerCase() !== "ok" && msg && msg.toLowerCase() !== "ok")
    ) {
      let friendlyMsg = `${defaultActionName} thất bại`;
      if (msg.toLowerCase() === "feedback_required" || spam) {
        friendlyMsg =
          feedbackMessage ||
          feedbackTitle ||
          "Chặn tính năng (feedback_required / spam)";
      } else if (msg.toLowerCase() === "checkpoint_required") {
        friendlyMsg = "Dính Checkpoint xác minh tài khoản";
      } else if (msg.toLowerCase() === "login_required") {
        friendlyMsg = "Hết phiên đăng nhập (Cookie DIE)";
      } else if (msg.toLowerCase() === "rate_limit_exceeded") {
        friendlyMsg = "Quá giới hạn thao tác Instagram (Rate limit)";
      } else if (feedbackMessage) {
        friendlyMsg = feedbackMessage;
      } else if (feedbackTitle) {
        friendlyMsg = feedbackTitle;
      } else if (msg) {
        friendlyMsg = msg;
      }
      return {
        isSuccess: false,
        httpCode: spam ? 429 : 400,
        rawBody,
        errorMessage: friendlyMsg,
      };
    }

    // 3. Kiểm tra thành công cụ thể
    const data = root.data;
    const friendship = data?.xdt_create_friendship;
    const fStatus = friendship?.friendship_status;
    if (fStatus?.following === true || fStatus?.outgoing_request === true) {
      return { isSuccess: true, httpCode: 200, rawBody };
    }
    const likeMedia = data?.xdt_like_media;
    if (
      likeMedia &&
      (likeMedia.status === "ok" || likeMedia.client_mutation_id)
    ) {
      return { isSuccess: true, httpCode: 200, rawBody };
    }
    const commentData = data?.comment || data?.xdt_comment;
    if (
      commentData ||
      root.comment ||
      (root.id !== undefined && root.text !== undefined)
    ) {
      return { isSuccess: true, httpCode: 200, rawBody };
    }
    if (root.status === "ok" || root.viewer_has_liked === true) {
      return { isSuccess: true, httpCode: 200, rawBody };
    }
  } catch {
    // ignore json parse error
  }

  // Fallback kiểm tra chuỗi
  const hasFail =
    cleanBody.includes('"status":"fail"') ||
    cleanBody.includes('"status": "fail"');
  if (
    !hasFail &&
    (cleanBody.includes('"following":true') ||
      cleanBody.includes('"viewer_has_liked":true') ||
      cleanBody.includes('"status":"ok"') ||
      cleanBody.includes('"status": "ok"'))
  ) {
    return { isSuccess: true, httpCode: 200, rawBody };
  }
  if (cleanBody.toLowerCase().includes("feedback_required")) {
    return {
      isSuccess: false,
      httpCode: 429,
      rawBody,
      errorMessage: "Chặn tính năng (feedback_required)",
    };
  }
  if (cleanBody.toLowerCase().includes("checkpoint")) {
    return {
      isSuccess: false,
      httpCode: 403,
      rawBody,
      errorMessage: "Dính Checkpoint Instagram",
    };
  }
  if (cleanBody.toLowerCase().includes("login_required")) {
    return {
      isSuccess: false,
      httpCode: 401,
      rawBody,
      errorMessage: "Cookie DIE / Yêu cầu đăng nhập",
    };
  }

  return {
    isSuccess: false,
    httpCode: 400,
    rawBody,
    errorMessage: `Instagram từ chối (${defaultActionName})`,
  };
}

/**
 * Tra cứu Numeric UID đối tượng từ Instagram Username qua topsearch API
 */
export async function resolveTargetUid(
  cookie: string,
  username: string,
  proxy?: string,
): Promise<string | null> {
  const clean = username.trim().replace(/^@/, "").replace(/\/+$/, "");
  if (!clean) return null;
  const url = `https://www.instagram.com/web/search/topsearch/?context=blended&query=${encodeURIComponent(clean)}`;
  try {
    const raw = await executeCurlRequest({
      url,
      method: "GET",
      cookie,
      proxy,
      headers: [`User-Agent: ${USER_AGENT}`, "X-IG-App-ID: 936619743392459"],
    });
    const root = JSON.parse(raw);
    const users = root.users;
    if (Array.isArray(users)) {
      for (const item of users) {
        const u = item.user;
        if (u && String(u.username).toLowerCase() === clean.toLowerCase()) {
          if (u.pk) return String(u.pk);
          if (u.id) return String(u.id);
        }
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Trích xuất Media ID từ mã nguồn trang Instagram bài viết
 */
export async function extractMediaIdFromPage(
  cookie: string,
  url: string,
  proxy?: string,
): Promise<string | null> {
  if (!url?.trim()) return null;
  try {
    const html = await executeCurlRequest({
      url,
      method: "GET",
      cookie,
      proxy,
      headers: [`User-Agent: ${USER_AGENT}`],
    });
    const patterns = [
      /"media_id":\s*"(\d+)"/,
      /"post_id":\s*"(\d+)"/,
      /"shortcode_media":\s*\{[^}]*"id":\s*"(\d+)"/,
      /\/p\/[^/]+\/\?id=(\d+)/,
      /"id":\s*"(\d+)_\d+"/,
    ];
    for (const p of patterns) {
      const m = html.match(p);
      if (m?.[1]) return m[1];
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Trích xuất UID profile từ trang cá nhân Instagram
 */
export async function extractTargetIdFromUrl(
  cookie: string,
  targetUrl: string,
  proxy?: string,
): Promise<string | null> {
  try {
    const html = await executeCurlRequest({
      url: targetUrl,
      method: "GET",
      cookie,
      proxy,
      headers: [`User-Agent: ${USER_AGENT}`],
    });
    const patterns = [
      /"profile_id":"(\d+)"/,
      /"user_id":"(\d+)"/,
      /profilePage_(\d+)/,
    ];
    for (const p of patterns) {
      const m = html.match(p);
      if (m?.[1]) return m[1];
    }
  } catch {
    // ignore
  }
  return null;
}
