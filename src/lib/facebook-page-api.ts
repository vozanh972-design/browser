import { executeCurlRequest, type FacebookPageItem } from "./facebook-api";
export type { FacebookPageItem };

export interface RegPageResult {
  isSuccess: boolean;
  pageId?: string;
  profilePlusId?: string;
  pageName: string;
  category?: string;
  errorMessage?: string;
  rawResponse?: string;
}

const KATANA_USER_AGENT =
  "[FBAN/FB4A;FBAV/548.1.0.51.64;FBBV/474618929;FBDM/{density=3.0,width=1080,height=2340};FBLC/vi_VN;FBRV/0;FBCR/Viettel;FBMF/samsung;FBBD/samsung;FBPN/com.facebook.katana;FBDV/SM-S928B;FBSV/14;FBOP/1;FBCA/arm64-v8a;]";

export const AUTO_CATEGORIES = [
  { id: "180164648685982", name: "Blog cá nhân" },
  { id: "2612", name: "Cửa hàng quần áo" },
  { id: "2738", name: "Đồ ăn & Đồ uống" },
  { id: "2234", name: "Dịch vụ kinh doanh" },
  { id: "1605", name: "Nghệ sĩ & Người của công chúng" },
  { id: "2006", name: "Mua sắm & Bán lẻ" },
  { id: "1301", name: "Sức khỏe & Sắc đẹp" },
  { id: "1901", name: "Bất động sản" },
];

const VIETNAMESE_FIRST = [
  "Nguyễn",
  "Trần",
  "Lê",
  "Phạm",
  "Hoàng",
  "Huỳnh",
  "Phan",
  "Vũ",
  "Võ",
  "Đặng",
  "Bùi",
  "Đỗ",
  "Hồ",
  "Ngô",
  "Dương",
  "Lý",
  "Đinh",
  "Đoàn",
  "Lâm",
  "Trịnh",
];

const VIETNAMESE_MIDDLE = [
  "Thị",
  "Văn",
  "Thùy",
  "Ngọc",
  "Thu",
  "Xuân",
  "Thanh",
  "Minh",
  "Đức",
  "Hải",
  "Tuấn",
  "Hoàng",
  "Gia",
  "Bảo",
  "Khánh",
  "Phương",
  "Diệu",
  "Mỹ",
  "Quỳnh",
];

const VIETNAMESE_LAST = [
  "Dung",
  "Anh",
  "Linh",
  "Trang",
  "Hương",
  "Hà",
  "Nhi",
  "Mai",
  "Thảo",
  "Uyên",
  "Yến",
  "Vy",
  "Huyền",
  "Ngân",
  "Tâm",
  "Hằng",
  "Chi",
  "Quân",
  "Nam",
  "Phong",
  "Huy",
  "Sơn",
];

const WESTERN_FIRST = [
  "James",
  "John",
  "Robert",
  "Michael",
  "William",
  "David",
  "Richard",
  "Joseph",
  "Thomas",
  "Charles",
  "Emma",
  "Olivia",
  "Sophia",
  "Ava",
  "Isabella",
  "Mia",
  "Emily",
  "Abigail",
  "Harper",
  "Ella",
  "Alexander",
  "Daniel",
  "Matthew",
  "Lucas",
  "Henry",
  "Sebastian",
  "Jack",
  "Chloe",
  "Grace",
  "Zoey",
];

const WESTERN_LAST = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Miller",
  "Davis",
  "Garcia",
  "Rodriguez",
  "Wilson",
  "Martinez",
  "Anderson",
  "Taylor",
  "Thomas",
  "Hernandez",
  "Moore",
  "Martin",
  "Jackson",
  "Thompson",
  "White",
  "Harris",
  "Clark",
  "Lewis",
  "Robinson",
  "Walker",
  "Young",
  "Allen",
  "King",
  "Wright",
  "Scott",
];

/**
 * Sinh tên ngẫu nhiên chuẩn 100% thuần từ FacebookPageService.kt:
 * - Tên Việt: 50% là 3 từ (Họ + Đệm + Tên) và 50% là 2 từ (Đệm + Tên)
 * - Tên Tây: First Name + Last Name
 */
export function generateRandomName(type: "vietnamese" | "western"): string {
  if (type === "western") {
    const f = WESTERN_FIRST[Math.floor(Math.random() * WESTERN_FIRST.length)];
    const l = WESTERN_LAST[Math.floor(Math.random() * WESTERN_LAST.length)];
    return `${f} ${l}`;
  }

  const isThree = Math.random() > 0.4;
  if (isThree) {
    const f =
      VIETNAMESE_FIRST[Math.floor(Math.random() * VIETNAMESE_FIRST.length)];
    const m =
      VIETNAMESE_MIDDLE[Math.floor(Math.random() * VIETNAMESE_MIDDLE.length)];
    const l =
      VIETNAMESE_LAST[Math.floor(Math.random() * VIETNAMESE_LAST.length)];
    return `${f} ${m} ${l}`;
  }

  const m =
    VIETNAMESE_MIDDLE[Math.floor(Math.random() * VIETNAMESE_MIDDLE.length)];
  const l = VIETNAMESE_LAST[Math.floor(Math.random() * VIETNAMESE_LAST.length)];
  return `${m} ${l}`;
}

export function getRandomCategory(): { id: string; name: string } {
  const item =
    AUTO_CATEGORIES[Math.floor(Math.random() * AUTO_CATEGORIES.length)];
  return item || { id: "180164648685982", name: "Blog cá nhân" };
}

/**
 * 1. TẠO PROFILE PLUS / FANPAGE FACEBOOK BẰNG BLOKS GRAPHQL CHUẨN APP KATANA (Li2/n;)
 * Endpoint: POST https://graph.facebook.com/graphql
 * App ID: com.bloks.www.additional.profile.plus.creation.action.category.submit
 * Bloks Versioning ID: 338f8ead5977a2c41eba3e92584dcf1d132e8b7928f1f5796662ec064023047d
 * Styles ID: 588d028b36bed0e1889e09b60e0f9aea
 * Client Doc ID: 119940804239956818821550724
 * User-Agent: [FBAN/FB4A;FBAV/537.0.0.47.77;FBPN/com.facebook.katana;]
 */
export async function createFacebookPageApi({
  pageName,
  token,
  categoryId = "180164648685982",
  proxy,
}: {
  pageName: string;
  token: string;
  categoryId?: string;
  proxy?: string;
}): Promise<RegPageResult> {
  const cleanToken = token.replace(/^(OAuth|Bearer)\s+/i, "").trim();
  if (!cleanToken) {
    return {
      isSuccess: false,
      pageName,
      errorMessage: "Tài khoản thiếu Token EAAA/Katana",
    };
  }

  // Cấu trúc chuẩn 100% từ FacebookPageEngine.kt
  const innerParams = {
    client_input_params: {
      page_id: "0",
      profile_plus_id: "0",
      category_ids: [categoryId],
    },
    server_params: {
      referrer: "pages_tab_launch_point",
      creation_source: "android",
      name: pageName,
      variant: 5,
      screen: "category",
    },
  };

  const level1 = {
    params: JSON.stringify({ params: JSON.stringify(innerParams) }),
    bloks_versioning_id:
      "338f8ead5977a2c41eba3e92584dcf1d132e8b7928f1f5796662ec064023047d",
    app_id:
      "com.bloks.www.additional.profile.plus.creation.action.category.submit",
  };

  const variables = {
    params: level1,
    scale: "2",
  };

  const params = new URLSearchParams({
    method: "post",
    format: "json",
    client_doc_id: "119940804239956818821550724",
    variables: JSON.stringify(variables),
  });

  const headers = [
    `User-Agent: ${KATANA_USER_AGENT}`,
    `Authorization: OAuth ${cleanToken}`,
    "X-FB-Friendly-Name: AdditionalProfilePlusCreation",
    "Content-Type: application/x-www-form-urlencoded",
  ];

  try {
    const raw = await executeCurlRequest({
      url: "https://graph.facebook.com/graphql",
      method: "POST",
      body: params.toString(),
      headers,
      proxy,
      timeoutSecs: 30,
    });

    // 1. Bóc tách Page ID / Profile Plus ID theo 5 mẫu định dạng chuẩn cloneexe (Li2/i0;)
    let extractedPageId: string | undefined;
    let extractedProfilePlusId: string | undefined;

    // Mẫu 1: WriteGlobalConsistencyStore
    const p1Page = raw.match(
      /\(bk\.action\.bloks\.WriteGlobalConsistencyStore,\s*"ADDITIONAL_PROFILE_PLUS_CREATION:page_id"\s*,\s*"(\d+)"/,
    );
    if (p1Page?.[1]) extractedPageId = p1Page[1];

    const p1Plus = raw.match(
      /\(bk\.action\.bloks\.WriteGlobalConsistencyStore,\s*"ADDITIONAL_PROFILE_PLUS_CREATION:profile_plus_id"\s*,\s*"(\d+)"/,
    );
    if (p1Plus?.[1]) extractedProfilePlusId = p1Plus[1];

    // Mẫu 2: dq8 action
    if (!extractedPageId) {
      const p2Page = raw.match(
        /\(dq8\s+"ADDITIONAL_PROFILE_PLUS_CREATION:page_id"\s+"(\d+)"/,
      );
      if (p2Page?.[1]) extractedPageId = p2Page[1];
    }
    if (!extractedProfilePlusId) {
      const p2Plus = raw.match(
        /\(dq8\s+"ADDITIONAL_PROFILE_PLUS_CREATION:profile_plus_id"\s+"(\d+)"/,
      );
      if (p2Plus?.[1]) extractedProfilePlusId = p2Plus[1];
    }

    // Mẫu 3: JSON key-value
    if (!extractedPageId) {
      const p3Page = raw.match(/"page_id"\s*[:=]\s*"?(\d{6,})"?/);
      if (p3Page?.[1] && p3Page[1] !== "0") extractedPageId = p3Page[1];
    }
    if (!extractedProfilePlusId) {
      const p3Plus = raw.match(/"profile_plus_id"\s*[:=]\s*"?(\d{6,})"?/);
      if (p3Plus?.[1] && p3Plus[1] !== "0") extractedProfilePlusId = p3Plus[1];
    }

    // Mẫu 4: Word boundary
    if (!extractedPageId) {
      const p4Page = raw.match(/\bpage_id\b[^\d]*(\d{6,})/);
      if (p4Page?.[1] && p4Page[1] !== "0") extractedPageId = p4Page[1];
    }

    // Mẫu 5: 615 regex
    if (!extractedProfilePlusId) {
      const p615Match = raw.match(/615\d{12,}/);
      if (p615Match?.[0]) extractedProfilePlusId = p615Match[0];
    }

    let finalId = extractedProfilePlusId || extractedPageId;
    let isSuccess =
      raw.includes("create_success") || (!!finalId && finalId !== "0");

    // Nếu chưa lấy được ID trực tiếp từ chuỗi Bloks, kiểm tra ngay trong danh sách Page (chuẩn findPageByName)
    if (!isSuccess) {
      try {
        const pagesAfter = await getFacebookPages(cleanToken, proxy);
        const matched = pagesAfter.find(
          (p) =>
            p.pageName.trim().toLowerCase() === pageName.trim().toLowerCase(),
        );
        if (matched) {
          finalId = matched.additionalProfileId || matched.pageId;
          extractedProfilePlusId = matched.additionalProfileId;
          isSuccess = true;
        }
      } catch {
        // ignore
      }
    }

    if (isSuccess && finalId) {
      return {
        isSuccess: true,
        pageId: finalId,
        profilePlusId: extractedProfilePlusId,
        pageName,
        category: categoryId,
        rawResponse: raw,
      };
    }

    // 2. Bóc tách Toast lỗi và Error Marker (Chuẩn FacebookPageService.kt)
    let bloksError: string | undefined;

    const toastRegex = raw.match(/\(bk\.action\.io\.Toast,\s*"([^"]+)"/);
    if (toastRegex?.[1]) {
      bloksError = toastRegex[1];
    }

    if (!bloksError) {
      const genericToast = raw.match(/Toast,\s*["']([^"']+)["']/i);
      if (genericToast?.[1]) {
        bloksError = genericToast[1];
      }
    }

    if (!bloksError) {
      if (
        raw.includes("profile_creation_error") ||
        raw.includes("create_error")
      ) {
        const msgPattern = raw.match(
          /["'](Bạn đã tạo quá nhiều|Tài khoản của bạn|Không thể tạo [tT]rang|Vui lòng thử lại|You've created too many|You cannot create)[^"']*["']/i,
        );
        if (msgPattern?.[0]) {
          bloksError = msgPattern[0].replace(/^["']|["']$/g, "");
        } else {
          bloksError =
            "Không thể tạo Trang: Gần đây bạn đã thử tạo Trang quá nhiều lần. Hãy thử lại vào lúc khác.";
        }
      }
    }

    const finalError = bloksError || extractDetailedFacebookError(raw);
    return {
      isSuccess: false,
      pageName,
      category: categoryId,
      errorMessage: finalError,
      rawResponse: raw,
    };
  } catch (err: unknown) {
    return {
      isSuccess: false,
      pageName,
      errorMessage:
        err instanceof Error
          ? err.message
          : "Lỗi kết nối khi gửi yêu cầu Reg Page",
    };
  }
}

/**
 * Bóc tách thông điệp lỗi chi tiết từ Facebook (Chuẩn FacebookPageService.kt)
 */
function extractDetailedFacebookError(body: string): string {
  // 1. Tìm thông báo Toast trong Bloks Action: (bk.action.io.Toast, "..." (Chuẩn Bước 2 FacebookPageService.kt)
  const toastRegex = body.match(/\(bk\.action\.io\.Toast,\s*"([^"]+)"/);
  if (toastRegex?.[1]?.trim()) {
    return toastRegex[1].trim();
  }
  const genericToast = body.match(/Toast,\s*["']([^"']+)["']/i);
  if (genericToast?.[1]?.trim()) {
    return genericToast[1].trim();
  }

  // 2. Phân tích cấu trúc JSON errors / error (Chuẩn Bước 3 FacebookPageService.kt & QuanLyPageEngine.kt)
  try {
    const json = JSON.parse(body);

    if (json.error && typeof json.error === "object") {
      const err = json.error;
      const code = err.code || 0;
      const subcode = err.error_subcode || 0;
      const title = (err.error_user_title || "").trim();
      const userMsg = (err.error_user_msg || "").trim();

      // Nếu Facebook trả về tiêu đề và thông điệp người dùng cụ thể (ví dụ: Bị chặn tạm thời)
      if (title || userMsg) {
        const fullMsg = [title, userMsg].filter(Boolean).join(": ");
        return code !== 0 ? `(#${code}) ${fullMsg}` : fullMsg;
      }

      if (code === 368 || subcode === 1390008) {
        return "Tài khoản bị Facebook giới hạn tính năng tạm thời (Spam Block - Mã 368)";
      }
      if (code === 100 && subcode === 33) {
        return "Đối tượng không tồn tại hoặc tài khoản không có quyền thao tác";
      }
      if (code === 200) {
        return "Không đủ quyền quản trị đối với Page này";
      }

      const msg = (err.message || "").trim();
      if (msg) return code !== 0 ? `(#${code}) ${msg}` : msg;
    }

    if (Array.isArray(json.errors) && json.errors.length > 0) {
      const err = json.errors[0];
      const desc = (err.description || "").trim();
      const summary = (err.summary || "").trim();
      const msg = (err.message || "").trim();
      const code = err.code || 0;

      let text = "";
      if (summary && desc && summary.toLowerCase() !== desc.toLowerCase()) {
        text = `${summary}: ${desc}`;
      } else {
        text = desc || summary || msg;
      }

      if (code === 1675030) {
        return `(#1675030) ${text || "Lỗi thực hiện truy vấn"} (Bị Meta giới hạn/chặn tạo Trang tạm thời)`;
      }

      if (text) {
        return code !== 0 ? `(#${code}) ${text}` : text;
      }
    }
  } catch {
    // ignore
  }

  // 3. Tìm các thuộc tính lỗi trong chuỗi JSON qua Regex (Chuẩn Bước 4 FacebookPageService.kt)
  const messageRegexes = [
    /["']error_user_msg["']\s*:\s*["']([^"']+)["']/,
    /["']error_description["']\s*:\s*["']([^"']+)["']/,
    /["']error_message["']\s*:\s*["']([^"']+)["']/,
    /["']description["']\s*:\s*["']([^"']+)["']/,
    /["']message["']\s*:\s*["']([^"']+)["']/,
  ];
  for (const regex of messageRegexes) {
    const match = body.match(regex);
    if (match?.[1]?.trim()) {
      const found = match[1].trim();
      if (
        found.toLowerCase() !== "null" &&
        !found.startsWith("http") &&
        !found.toLowerCase().includes("graphql")
      ) {
        return found;
      }
    }
  }

  // 4. Kiểm tra các lỗi phổ biến đặc trưng của Meta (Chuẩn Bước 1 FacebookPageService.kt)
  const lowerBody = body.toLowerCase();
  if (
    lowerBody.includes("bị chặn tạm thời") ||
    lowerBody.includes("tạm thời bị chặn") ||
    lowerBody.includes("temporarily blocked")
  ) {
    return "Tài khoản bị Facebook chặn thao tác tạm thời";
  }
  if (
    lowerBody.includes("phone_verification") ||
    lowerBody.includes("confirm_phone") ||
    lowerBody.includes("sms_code") ||
    lowerBody.includes("xác minh số điện thoại") ||
    lowerBody.includes("xác thực sms")
  ) {
    return "Tài khoản yêu cầu xác thực Số điện thoại / SMS (Checkpoint)";
  }
  if (
    lowerBody.includes("checkpoint_required") ||
    lowerBody.includes("account_checkpoint") ||
    lowerBody.includes("checkpoint")
  ) {
    return "Tài khoản bị Checkpoint yêu cầu xác minh bảo mật";
  }
  if (
    lowerBody.includes("profile_creation_error") ||
    lowerBody.includes("quá nhiều") ||
    lowerBody.includes("too many") ||
    lowerBody.includes("limit_reached")
  ) {
    return "Tài khoản bị giới hạn tạo Trang (Đã tạo quá nhiều Trang gần đây, hãy thử lại sau)";
  }
  if (
    lowerBody.includes("invalid_name") ||
    lowerBody.includes("tên không hợp lệ")
  ) {
    return "Tên Page không hợp lệ hoặc chứa ký tự/từ khóa bị Meta từ chối";
  }
  if (lowerBody.includes("1675030")) {
    return "(#1675030) Bị Meta giới hạn tạo Trang tạm thời (Cần đổi Proxy hoặc cho acc nghỉ)";
  }

  // 5. Chuỗi lỗi trực tiếp từ Facebook (Chuẩn Bước 5 FacebookPageService.kt)
  const clean = body.replace(/[\r\n\t]+/g, " ").replace(/\\/g, "").trim();
  return clean.length > 150
    ? `${clean.slice(0, 150)}...`
    : clean || "Lỗi không xác định từ Facebook";
}

/**
 * 2. LẤY DANH SÁCH FANPAGE CỦA TÀI KHOẢN (Chuẩn Lz2/m FacebookPageService.kt)
 * Endpoint: GET /v24.0/me?fields=facebook_pages{access_token,additional_profile_id,id,name}
 * Fallback: GET /v19.0/me/accounts?fields=id,name,access_token,additional_profile_id&limit=100
 */
export async function getFacebookPages(
  userToken: string,
  proxy?: string,
): Promise<FacebookPageItem[]> {
  const cleanToken = userToken.replace(/^(OAuth|Bearer)\s+/i, "").trim();
  if (!cleanToken) return [];

  const list: FacebookPageItem[] = [];

  // 1. Thử cơ chế chuẩn Lz2/m v24.0
  try {
    const url = `https://graph.facebook.com/v24.0/me?fields=facebook_pages{access_token,additional_profile_id,id,name}&access_token=${cleanToken}`;
    const raw = await executeCurlRequest({
      url,
      method: "GET",
      proxy,
      timeoutSecs: 15,
    });
    const json = JSON.parse(raw);
    const arr = json.facebook_pages?.data;
    if (Array.isArray(arr) && arr.length > 0) {
      for (const p of arr) {
        if (p.id) {
          list.push({
            pageId: String(p.id),
            pageName: String(p.name || ""),
            pageToken: String(p.access_token || ""),
            additionalProfileId: p.additional_profile_id
              ? String(p.additional_profile_id)
              : undefined,
            avatar: `https://graph.facebook.com/${p.id}/picture?type=large`,
            isLive: true,
          });
        }
      }
    }
  } catch {
    // ignore
  }

  if (list.length > 0) return list;

  // 2. Fallback v19.0 me/accounts
  try {
    const fallbackUrl = `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,additional_profile_id,delegate_page_id&limit=100&access_token=${cleanToken}`;
    const raw = await executeCurlRequest({
      url: fallbackUrl,
      method: "GET",
      proxy,
      timeoutSecs: 15,
    });
    const json = JSON.parse(raw);
    const arr = json.data;
    if (Array.isArray(arr) && arr.length > 0) {
      for (const p of arr) {
        if (p.id) {
          const addId = p.additional_profile_id ? String(p.additional_profile_id) : "";
          const delId = p.delegate_page_id ? String(p.delegate_page_id) : "";
          const pid = String(p.id);
          const p615 = addId.startsWith("615")
            ? addId
            : delId.startsWith("615")
              ? delId
              : pid.startsWith("615")
                ? pid
                : addId || delId || undefined;

          list.push({
            pageId: pid,
            pageName: String(p.name || ""),
            pageToken: String(p.access_token || ""),
            additionalProfileId: p615,
            avatar: `https://graph.facebook.com/${pid}/picture?type=large`,
            isLive: true,
          });
        }
      }
    }
  } catch {
    // ignore
  }

  return list;
}

/**
 * 3. TÌM PAGE VỪA TẠO THEO TÊN ĐỂ LẤY UID VÀ PAGE TOKEN (Chuẩn Lz2/m FacebookPageService.kt)
 */
export async function findPageByName(
  token: string,
  pageName: string,
  maxRetries = 5,
  delayMs = 2000,
  proxy?: string,
): Promise<FacebookPageItem | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const pages = await getFacebookPages(token, proxy);
    const found = pages.find(
      (p) => p.pageName.trim().toLowerCase() === pageName.trim().toLowerCase(),
    );
    if (found) return found;
    if (attempt < maxRetries - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return null;
}
