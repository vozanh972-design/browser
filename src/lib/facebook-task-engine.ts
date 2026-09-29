import { executeCurlRequest } from "./facebook-api";

const GRAPH_API = "https://graph.facebook.com/v21.0";
const GRAPHQL_URL = "https://graph.facebook.com/graphql";
const FB_UA =
  "[FBAN/FB4A;FBAV/548.1.0.51.64;FBBV/474618929;FBDM/{density=3.0,width=1080,height=2340};FBLC/vi_VN;FBRV/0;FBCR/Viettel;FBMF/samsung;FBBD/samsung;FBPN/com.facebook.katana;FBDV/SM-S928B;FBSV/14;FBOP/1;FBCA/arm64-v8a;]";

export const FB_REACTION_IDS: Record<string, string> = {
  LIKE: "1635855486666999",
  LOVE: "1678524932434102",
  CARE: "2229796038974261",
  HAHA: "115940658764963",
  WOW: "478547315650144",
  SAD: "908563459236466",
  ANGRY: "444813342392137",
};

export interface FbTaskResult {
  isSuccess: boolean;
  action: string;
  targetId: string;
  message?: string;
  rawResponse?: string;
}

/**
 * Trích xuất ID đối tượng (Post ID, Video ID, UID, Page ID, Feedback ID) từ URL link Facebook
 */
export function extractFacebookId(rawTarget: string): string {
  const trimmed = rawTarget.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return trimmed;
  }

  const patterns = [
    /(?:\/posts\/|\/videos\/|\/reels\/|\/reel\/|\/stories\/|story_fbid=|fbid=)(\d+)/,
    /(?:[?&](?:id|v)=)(\d+)/,
    /facebook\.com\/(\d{10,})/,
    /facebook\.com\/[^/]+\/posts\/(\d+)/,
    /(?:\/posts\/|\/reels\/|\/reel\/)(pfbid[A-Za-z0-9]+)/,
  ];

  for (const p of patterns) {
    const match = trimmed.match(p);
    if (match?.[1]) return match[1];
  }

  const cleanUrl = trimmed.replace(/\/+$/, "");
  const segment = cleanUrl.split("/").pop()?.split("?")[0];
  return segment || trimmed;
}

/**
 * Chuẩn hóa tên cảm xúc Facebook
 */
export function parseReactionType(str: string): string {
  const upper = str.toUpperCase().trim();
  if (
    upper.includes("CARE") ||
    upper.includes("THUONG") ||
    upper.includes("THƯƠNG")
  )
    return "CARE";
  if (
    upper.includes("LOVE") ||
    upper.includes("TYM") ||
    upper.includes("TIM") ||
    upper.includes("YÊU") ||
    upper.includes("YEU")
  )
    return "LOVE";
  if (
    upper.includes("HAHA") ||
    upper.includes("CUOI") ||
    upper.includes("CƯỜI")
  )
    return "HAHA";
  if (
    upper.includes("WOW") ||
    upper.includes("NGAC") ||
    upper.includes("NGẠC") ||
    upper.includes("BAT_NGO") ||
    upper.includes("NGO") ||
    upper.includes("NGỜ")
  )
    return "WOW";
  if (upper.includes("SAD") || upper.includes("BUON") || upper.includes("BUỒN"))
    return "SAD";
  if (
    upper.includes("ANGRY") ||
    upper.includes("PHAN_NO") ||
    upper.includes("PHẪN") ||
    upper.includes("PHANNO")
  )
    return "ANGRY";
  return "LIKE";
}

/**
 * Xử lý thông báo lỗi từ JSON Facebook trả về
 */
export function parseFacebookError(body: string): string {
  try {
    const json = JSON.parse(body);
    if (Array.isArray(json.errors) && json.errors.length > 0) {
      const first = json.errors[0];
      const msg = first.message;
      const summary = first.summary;
      if (msg) return summary ? `${summary}: ${msg}` : msg;
    }
    if (json.error) {
      const err = json.error;
      const code = err.code ?? 0;
      const subcode = err.error_subcode ?? 0;
      const title = err.error_user_title;
      const userMsg = err.error_user_msg;
      if (title || userMsg) {
        return [title, userMsg].filter(Boolean).join(": ");
      }
      if (code === 368 || subcode === 1390008) {
        return "Tài khoản bị Facebook giới hạn tính năng tạm thời (Spam Block - Mã 368)";
      }
      if (err.message) return String(err.message);
    }
  } catch {
    // ignore
  }
  return body.length > 250 ? `${body.substring(0, 250)}...` : body;
}

/**
 * Bóc tách feedback id dạng Base64
 */
function buildFeedbackId(objectId: string): {
  b64: string;
  owner: string;
  fbid: string;
} {
  let s = objectId.trim();
  if (s.startsWith("http")) {
    s = s.split("facebook.com/").pop()?.split("?")[0] || s;
  }
  s = s.replace(/\/+$/, "");

  let owner = "";
  let fbid = s;

  if (s.includes("/posts/")) {
    const parts = s.split("/posts/");
    owner = parts[0];
    fbid = parts[1].split("/")[0];
  } else if (s.includes("_")) {
    const idx = s.indexOf("_");
    owner = s.substring(0, idx);
    fbid = s.substring(idx + 1);
  }

  const tok = owner ? `${owner}_${fbid}` : fbid;
  const b64 = btoa(`feedback:${tok}`);
  return { b64, owner, fbid };
}

/**
 * 1. THỰC HIỆN THẢ CẢM XÚC FACEBOOK (LIKE, LOVE, CARE, HAHA, WOW, SAD, ANGRY)
 */
export async function executeFacebookReaction(options: {
  targetId: string;
  reactionType: string;
  token: string;
  userId?: string;
  proxy?: string;
}): Promise<FbTaskResult> {
  const { targetId, reactionType, token, userId, proxy } = options;
  const cleanId = extractFacebookId(targetId);
  const cleanToken = token
    .replace(/^OAuth\s+/, "")
    .replace(/^Bearer\s+/, "")
    .trim();

  if (!cleanToken) {
    return {
      isSuccess: false,
      action: "REACT",
      targetId: cleanId,
      message: "Token Facebook trống",
    };
  }

  const reactKey = parseReactionType(reactionType);
  const reactId = FB_REACTION_IDS[reactKey] || FB_REACTION_IDS.LIKE;
  const { b64: feedbackB64 } = buildFeedbackId(cleanId);

  // Thử 1: UFIReactionMutation GraphQL (Chuẩn app Katana Android)
  try {
    const input = {
      feedback_id: feedbackB64,
      feedback_reaction_id: reactId,
      ...(userId ? { actor_id: userId } : {}),
    };

    const bodyParams = new URLSearchParams({
      method: "post",
      pretty: "false",
      format: "json",
      server_timestamps: "true",
      locale: "vi_VN",
      fb_api_req_friendly_name: "UFIReactionMutation",
      fb_api_caller_class: "RelayModern",
      client_doc_id: "2857784093518205785115255697",
      variables: JSON.stringify({ input }),
      access_token: cleanToken,
    });

    const res = await executeCurlRequest({
      url: GRAPHQL_URL,
      method: "POST",
      body: bodyParams.toString(),
      proxy,
      headers: [
        `User-Agent: ${FB_UA}`,
        "X-FB-Friendly-Name: UFIReactionMutation",
        `Authorization: OAuth ${cleanToken}`,
      ],
    });

    const isOk =
      res &&
      !res.includes('"error"') &&
      (res.includes("feedback_reaction") ||
        res.includes("viewer_feedback_reaction") ||
        res.includes('"id"') ||
        res.includes('"success":true'));

    if (isOk) {
      return {
        isSuccess: true,
        action: `REACT_${reactKey}`,
        targetId: cleanId,
        message: "Thành công",
        rawResponse: res,
      };
    }
  } catch {
    // fallback
  }

  // Thử 2: Graph API v21.0
  try {
    const graphUrl =
      reactKey === "LIKE"
        ? `${GRAPH_API}/${cleanId}/likes?access_token=${cleanToken}`
        : `${GRAPH_API}/${cleanId}/reactions?type=${reactKey}&access_token=${cleanToken}`;

    const res = await executeCurlRequest({
      url: graphUrl,
      method: "POST",
      body: "",
      proxy,
      headers: [
        "Content-Type: application/x-www-form-urlencoded",
        `User-Agent: ${FB_UA}`,
      ],
    });

    const isSuccess =
      res &&
      (res.includes('"success":true') ||
        res.includes('"id"') ||
        !res.includes('"error"'));

    if (isSuccess) {
      return {
        isSuccess: true,
        action: `REACT_${reactKey}`,
        targetId: cleanId,
        message: "Thành công",
        rawResponse: res,
      };
    }

    return {
      isSuccess: false,
      action: `REACT_${reactKey}`,
      targetId: cleanId,
      message: parseFacebookError(res),
      rawResponse: res,
    };
  } catch (err: unknown) {
    return {
      isSuccess: false,
      action: `REACT_${reactKey}`,
      targetId: cleanId,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * 2. THỰC HIỆN COMMENT BÀI VIẾT FACEBOOK
 */
export async function executeFacebookComment(options: {
  targetId: string;
  comment: string;
  token: string;
  userId?: string;
  proxy?: string;
}): Promise<FbTaskResult> {
  const { targetId, comment, token, userId, proxy } = options;
  const cleanId = extractFacebookId(targetId);
  const cleanToken = token
    .replace(/^OAuth\s+/, "")
    .replace(/^Bearer\s+/, "")
    .trim();

  if (!comment?.trim()) {
    return {
      isSuccess: false,
      action: "COMMENT",
      targetId: cleanId,
      message: "Nội dung bình luận trống",
    };
  }

  // Thử 1: GraphQL CommentCreateMutation (doc_id 6739921102758190)
  try {
    const input = {
      client_mutation_id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      actor_id: userId || "",
      feedback_id: cleanId,
      message: { text: comment },
    };

    const bodyParams = new URLSearchParams({
      doc_id: "6739921102758190",
      variables: JSON.stringify({ input }),
      access_token: cleanToken,
    });

    const res = await executeCurlRequest({
      url: GRAPHQL_URL,
      method: "POST",
      body: bodyParams.toString(),
      proxy,
      headers: [
        `User-Agent: ${FB_UA}`,
        "X-FB-Friendly-Name: CommentCreateMutation",
        `Authorization: OAuth ${cleanToken}`,
      ],
    });

    if (res?.includes('"id"') && !res.includes('"errors"')) {
      return {
        isSuccess: true,
        action: "COMMENT",
        targetId: cleanId,
        message: "Thành công",
        rawResponse: res,
      };
    }
  } catch {
    // fallback
  }

  // Thử 2: Graph API v21.0 /{targetId}/comments
  try {
    const url = `${GRAPH_API}/${cleanId}/comments?access_token=${cleanToken}`;
    const bodyParams = new URLSearchParams({ message: comment });

    const res = await executeCurlRequest({
      url,
      method: "POST",
      body: bodyParams.toString(),
      proxy,
      headers: [
        "Content-Type: application/x-www-form-urlencoded",
        `User-Agent: ${FB_UA}`,
      ],
    });

    const isSuccess =
      res &&
      (res.includes('"id"') || res.includes('"success":true')) &&
      !res.includes('"error"');

    if (isSuccess) {
      return {
        isSuccess: true,
        action: "COMMENT",
        targetId: cleanId,
        message: "Thành công",
        rawResponse: res,
      };
    }

    return {
      isSuccess: false,
      action: "COMMENT",
      targetId: cleanId,
      message: parseFacebookError(res),
      rawResponse: res,
    };
  } catch (err: unknown) {
    return {
      isSuccess: false,
      action: "COMMENT",
      targetId: cleanId,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * 3. THỰC HIỆN THEO DÕI (FOLLOW / SUB) FACEBOOK
 */
export async function executeFacebookFollow(options: {
  targetId: string;
  token: string;
  userId?: string;
  proxy?: string;
}): Promise<FbTaskResult> {
  const { targetId, token, userId, proxy } = options;
  const cleanId = extractFacebookId(targetId);
  const cleanToken = token
    .replace(/^OAuth\s+/, "")
    .replace(/^Bearer\s+/, "")
    .trim();

  // Thử 1: GraphQL ActorSubscribeCoreMutation (doc_id 4268153066598920)
  try {
    const input = {
      client_mutation_id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      actor_id: userId || "",
      subscribee_id: cleanId,
      subscribe_location: "PROFILE",
    };

    const bodyParams = new URLSearchParams({
      doc_id: "4268153066598920",
      variables: JSON.stringify({ input }),
      access_token: cleanToken,
    });

    const res = await executeCurlRequest({
      url: GRAPHQL_URL,
      method: "POST",
      body: bodyParams.toString(),
      proxy,
      headers: [
        `User-Agent: ${FB_UA}`,
        "X-FB-Friendly-Name: ActorSubscribeCoreMutation",
        `Authorization: OAuth ${cleanToken}`,
      ],
    });

    if (
      res &&
      !res.includes('"errors"') &&
      (res.includes("subscribee") ||
        res.includes('"is_subscribed":true') ||
        res.includes('"id"'))
    ) {
      return {
        isSuccess: true,
        action: "FOLLOW",
        targetId: cleanId,
        message: "Thành công",
        rawResponse: res,
      };
    }
  } catch {
    // fallback
  }

  // Thử 2: Graph API v21.0 /{targetId}/subscribers
  try {
    const url = `${GRAPH_API}/${cleanId}/subscribers?access_token=${cleanToken}`;
    const res = await executeCurlRequest({
      url,
      method: "POST",
      body: "",
      proxy,
      headers: [
        "Content-Type: application/x-www-form-urlencoded",
        `User-Agent: ${FB_UA}`,
      ],
    });

    const isSuccess =
      res &&
      (res.includes('"success":true') ||
        res.includes('"id"') ||
        !res.includes('"error"'));

    if (isSuccess) {
      return {
        isSuccess: true,
        action: "FOLLOW",
        targetId: cleanId,
        message: "Thành công",
        rawResponse: res,
      };
    }

    return {
      isSuccess: false,
      action: "FOLLOW",
      targetId: cleanId,
      message: parseFacebookError(res),
      rawResponse: res,
    };
  } catch (err: unknown) {
    return {
      isSuccess: false,
      action: "FOLLOW",
      targetId: cleanId,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * 4. THỰC HIỆN LIKE PAGE FACEBOOK
 */
export async function executeFacebookLikePage(options: {
  targetId: string;
  token: string;
  userId?: string;
  proxy?: string;
}): Promise<FbTaskResult> {
  const { targetId, token, userId, proxy } = options;
  const cleanId = extractFacebookId(targetId);
  const cleanToken = token
    .replace(/^OAuth\s+/, "")
    .replace(/^Bearer\s+/, "")
    .trim();

  // Thử PageLikeMutation (doc_id 3628174981029411)
  try {
    const input = {
      client_mutation_id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      actor_id: userId || "",
      page_id: cleanId,
    };

    const bodyParams = new URLSearchParams({
      doc_id: "3628174981029411",
      variables: JSON.stringify({ input }),
      access_token: cleanToken,
    });

    const res = await executeCurlRequest({
      url: GRAPHQL_URL,
      method: "POST",
      body: bodyParams.toString(),
      proxy,
      headers: [
        `User-Agent: ${FB_UA}`,
        "X-FB-Friendly-Name: PageLikeMutation",
        `Authorization: OAuth ${cleanToken}`,
      ],
    });

    if (res && !res.includes('"errors"') && res.includes("page")) {
      return {
        isSuccess: true,
        action: "LIKE_PAGE",
        targetId: cleanId,
        message: "Thành công",
        rawResponse: res,
      };
    }
  } catch {
    // fallback sang follow nếu là page 615 profile+
  }

  return await executeFacebookFollow({
    targetId: cleanId,
    token: cleanToken,
    userId,
    proxy,
  });
}

/**
 * 5. THỰC HIỆN GIA NHẬP GROUP FACEBOOK
 */
export async function executeFacebookJoinGroup(options: {
  targetId: string;
  token: string;
  userId?: string;
  proxy?: string;
}): Promise<FbTaskResult> {
  const { targetId, token, userId, proxy } = options;
  const cleanId = extractFacebookId(targetId);
  const cleanToken = token
    .replace(/^OAuth\s+/, "")
    .replace(/^Bearer\s+/, "")
    .trim();

  try {
    const input = {
      client_mutation_id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      actor_id: userId || "",
      group_id: cleanId,
      source: "group_mall",
    };

    const bodyParams = new URLSearchParams({
      doc_id: "4981273901928471",
      variables: JSON.stringify({ input }),
      access_token: cleanToken,
    });

    const res = await executeCurlRequest({
      url: GRAPHQL_URL,
      method: "POST",
      body: bodyParams.toString(),
      proxy,
      headers: [
        `User-Agent: ${FB_UA}`,
        "X-FB-Friendly-Name: GroupJoinMutation",
        `Authorization: OAuth ${cleanToken}`,
      ],
    });

    const isOk =
      res &&
      !res.includes('"errors"') &&
      (res.includes("group") || res.includes('"id"'));
    if (isOk) {
      return {
        isSuccess: true,
        action: "JOIN_GROUP",
        targetId: cleanId,
        message: "Thành công",
        rawResponse: res,
      };
    }

    return {
      isSuccess: false,
      action: "JOIN_GROUP",
      targetId: cleanId,
      message: parseFacebookError(res),
      rawResponse: res,
    };
  } catch (err: unknown) {
    return {
      isSuccess: false,
      action: "JOIN_GROUP",
      targetId: cleanId,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * 6. THỰC HIỆN CHIA SẺ BÀI VIẾT LÊN TƯỜNG (SHARE)
 */
export async function executeFacebookShare(options: {
  targetId: string;
  token: string;
  message?: string;
  proxy?: string;
}): Promise<FbTaskResult> {
  const { targetId, token, message, proxy } = options;
  const cleanId = extractFacebookId(targetId);
  const cleanToken = token
    .replace(/^OAuth\s+/, "")
    .replace(/^Bearer\s+/, "")
    .trim();

  try {
    const bodyParams = new URLSearchParams({
      link: `https://www.facebook.com/${cleanId}`,
      access_token: cleanToken,
      ...(message ? { message } : {}),
    });

    const res = await executeCurlRequest({
      url: `${GRAPH_API}/me/feed`,
      method: "POST",
      body: bodyParams.toString(),
      proxy,
      headers: [
        "Content-Type: application/x-www-form-urlencoded",
        `User-Agent: ${FB_UA}`,
      ],
    });

    if (
      res &&
      (res.includes('"id"') || res.includes('"success":true')) &&
      !res.includes('"error"')
    ) {
      return {
        isSuccess: true,
        action: "SHARE",
        targetId: cleanId,
        message: "Thành công",
        rawResponse: res,
      };
    }

    return {
      isSuccess: false,
      action: "SHARE",
      targetId: cleanId,
      message: parseFacebookError(res),
      rawResponse: res,
    };
  } catch (err: unknown) {
    return {
      isSuccess: false,
      action: "SHARE",
      targetId: cleanId,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
