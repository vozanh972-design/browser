import { executeCurlRequest } from "./facebook-api";

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

// Danh sách danh mục phổ biến hợp lệ để logic tự chọn
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
  "Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ",
  "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý", "Đinh", "Đoàn", "Lâm", "Trịnh"
];

const VIETNAMESE_MIDDLE = [
  "Thị", "Văn", "Thùy", "Ngọc", "Thu", "Xuân", "Thanh", "Minh", "Đức",
  "Hải", "Tuấn", "Hoàng", "Gia", "Bảo", "Khánh", "Phương", "Diệu", "Mỹ", "Quỳnh"
];

const VIETNAMESE_LAST = [
  "Dung", "Anh", "Linh", "Trang", "Hương", "Hà", "Nhi", "Mai", "Thảo",
  "Uyên", "Yến", "Vy", "Huyền", "Ngân", "Tâm", "Hằng", "Chi", "Quân", "Nhật", "Phong", "Huy", "Sơn"
];

const WESTERN_FIRST = [
  "James", "John", "Robert", "Michael", "William", "David", "Richard", "Joseph", "Thomas", "Charles",
  "Emma", "Olivia", "Sophia", "Ava", "Isabella", "Mia", "Emily", "Abigail", "Harper", "Ella",
  "Alexander", "Daniel", "Matthew", "Lucas", "Henry", "Sebastian", "Jack", "Chloe", "Grace", "Zoey"
];

const WESTERN_LAST = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis", "Garcia", "Rodriguez", "Wilson",
  "Martinez", "Anderson", "Taylor", "Thomas", "Hernandez", "Moore", "Martin", "Jackson", "Thompson", "White",
  "Harris", "Clark", "Lewis", "Robinson", "Walker", "Young", "Allen", "King", "Wright", "Scott"
];

/**
 * Sinh tên ngẫu nhiên chuẩn thuần theo Loại tên (Tên Việt hoặc Tên Tây)
 */
export function generateRandomName(type: "vietnamese" | "western"): string {
  if (type === "western") {
    const f = WESTERN_FIRST[Math.floor(Math.random() * WESTERN_FIRST.length)];
    const l = WESTERN_LAST[Math.floor(Math.random() * WESTERN_LAST.length)];
    return `${f} ${l}`;
  }

  // Tên Việt: 50% là 3 từ (Họ + Đệm + Tên) và 50% là 2 từ (Đệm + Tên / Họ + Tên)
  const isThree = Math.random() > 0.4;
  if (isThree) {
    const f = VIETNAMESE_FIRST[Math.floor(Math.random() * VIETNAMESE_FIRST.length)];
    const m = VIETNAMESE_MIDDLE[Math.floor(Math.random() * VIETNAMESE_MIDDLE.length)];
    const l = VIETNAMESE_LAST[Math.floor(Math.random() * VIETNAMESE_LAST.length)];
    return `${f} ${m} ${l}`;
  }

  const m = VIETNAMESE_MIDDLE[Math.floor(Math.random() * VIETNAMESE_MIDDLE.length)];
  const l = VIETNAMESE_LAST[Math.floor(Math.random() * VIETNAMESE_LAST.length)];
  return `${m} ${l}`;
}

/**
 * Tự động chọn ngẫu nhiên danh mục hợp lệ
 */
export function getRandomCategory(): { id: string; name: string } {
  const item = AUTO_CATEGORIES[Math.floor(Math.random() * AUTO_CATEGORIES.length)];
  return item || { id: "180164648685982", name: "Blog cá nhân" };
}

/**
 * Tạo Facebook Profile Plus Page (UID 615) bằng GraphQL chuẩn Katana Android
 */
export async function createFacebookPageApi({
  pageName,
  token,
  categoryId,
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

  const selectedCategory = categoryId || getRandomCategory().id;

  const innerParams = {
    client_input_params: {
      page_id: "0",
      profile_plus_id: "0",
      cp_upsell_declined: 0,
      off_platform_creator_reachout_id: "",
      category_ids: [selectedCategory],
      nav_chain: "...",
    },
    server_params: {
      referrer: "pages_tab_launch_point",
      INTERNAL__latency_qpl_marker_id: 36707139,
      creation_source: "android",
      name: pageName,
      variant: 5,
      screen: "category",
      INTERNAL__latency_qpl_instance_id: 55098533200051.0,
    },
  };

  const level1 = {
    params: JSON.stringify({ params: JSON.stringify(innerParams) }),
    bloks_versioning_id: "338f8ead5977a2c41eba3e92584dcf1d132e8b7928f1f5796662ec064023047d",
    app_id: "com.bloks.www.additional.profile.plus.creation.action.category.submit",
  };

  const ntContext = {
    using_white_navbar: true,
    styles_id: "588d028b36bed0e1889e09b60e0f9aea",
    pixel_ratio: 2,
    is_push_on: true,
    debug_tooling_metadata_token: null,
    is_flipper_enabled: false,
    theme_params: [
      {
        value: [],
        design_system_name: "FDS",
      },
    ],
    bloks_version: "338f8ead5977a2c41eba3e92584dcf1d132e8b7928f1f5796662ec064023047d",
  };

  const variables = {
    params: level1,
    scale: "2",
    nt_context: ntContext,
  };

  const params = new URLSearchParams({
    method: "post",
    pretty: "false",
    format: "json",
    server_timestamps: "true",
    locale: "vi_VN",
    client_doc_id: "119940804239956818821550724",
    variables: JSON.stringify(variables),
  });

  const headers = [
    `User-Agent: ${KATANA_USER_AGENT}`,
    `Authorization: OAuth ${cleanToken}`,
    "Content-Type: application/x-www-form-urlencoded",
    "X-Fb-Connection-Type: WIFI",
    "X-Fb-Http-Engine: Tigon/Liger",
    "X-Fb-Client-Ip: True",
    "X-Fb-Server-Cluster: True",
    "X-Graphql-Request-Purpose: fetch",
    "X-Graphql-Client-Library: graphservice",
    "X-FB-Friendly-Name: AdditionalProfilePlusCreation",
  ];

  try {
    const raw = await executeCurlRequest({
      url: "https://graph.facebook.com/graphql",
      method: "POST",
      body: params.toString(),
      headers,
      proxy,
    });

    // 1. Bóc tách Page ID / Profile Plus ID (UID 615)
    let extractedPageId: string | undefined;
    let extractedProfilePlusId: string | undefined;

    // Pattern 1: WriteGlobalConsistencyStore
    const p1Page = raw.match(
      /\(bk\.action\.bloks\.WriteGlobalConsistencyStore,\s*"ADDITIONAL_PROFILE_PLUS_CREATION:page_id"\s*,\s*"(\d+)"/,
    );
    if (p1Page) extractedPageId = p1Page[1];

    const p1Plus = raw.match(
      /\(bk\.action\.bloks\.WriteGlobalConsistencyStore,\s*"ADDITIONAL_PROFILE_PLUS_CREATION:profile_plus_id"\s*,\s*"(\d+)"/,
    );
    if (p1Plus) extractedProfilePlusId = p1Plus[1];

    // Pattern 2: dq8 action
    if (!extractedPageId) {
      const p2Page = raw.match(
        /\(dq8\s+"ADDITIONAL_PROFILE_PLUS_CREATION:page_id"\s+"(\d+)"/,
      );
      if (p2Page) extractedPageId = p2Page[1];
    }
    if (!extractedProfilePlusId) {
      const p2Plus = raw.match(
        /\(dq8\s+"ADDITIONAL_PROFILE_PLUS_CREATION:profile_plus_id"\s+"(\d+)"/,
      );
      if (p2Plus) extractedProfilePlusId = p2Plus[1];
    }

    // Pattern 3: JSON key-value
    if (!extractedPageId) {
      const p3Page = raw.match(/"page_id"\s*[:=]\s*"?(\d{6,})"?/);
      if (p3Page && p3Page[1] !== "0") extractedPageId = p3Page[1];
    }
    if (!extractedProfilePlusId) {
      const p3Plus = raw.match(/"profile_plus_id"\s*[:=]\s*"?(\d{6,})"?/);
      if (p3Plus && p3Plus[1] !== "0") extractedProfilePlusId = p3Plus[1];
    }

    // Pattern 4: Regex UID 615
    if (!extractedProfilePlusId) {
      const p615Match = raw.match(/615\d{10,}/);
      if (p615Match) extractedProfilePlusId = p615Match[0];
    }

    const isSuccess =
      raw.includes("create_success") ||
      (!!extractedPageId && extractedPageId !== "0") ||
      (!!extractedProfilePlusId && extractedProfilePlusId !== "0");

    if (isSuccess) {
      return {
        isSuccess: true,
        pageId: extractedPageId || extractedProfilePlusId,
        profilePlusId: extractedProfilePlusId,
        pageName,
        category: selectedCategory,
        rawResponse: raw,
      };
    }

    // 2. Trích xuất thông báo lỗi chi tiết
    let errorMessage: string | undefined;

    // Toast lỗi
    const toastMatch = raw.match(/\(bk\.action\.io\.Toast,\s*"([^"]+)"/);
    if (toastMatch && toastMatch[1].trim()) {
      errorMessage = toastMatch[1].trim();
    }

    // Generic Toast
    if (!errorMessage) {
      const genToast = raw.match(/Toast,\s*["']([^"']+)["']/i);
      if (genToast && genToast[1].trim()) {
        errorMessage = genToast[1].trim();
      }
    }

    // Các lỗi Meta đặc thù
    if (!errorMessage) {
      const lower = raw.toLowerCase();
      if (
        lower.includes("phone_verification") ||
        lower.includes("confirm_phone") ||
        lower.includes("xác minh số điện thoại")
      ) {
        errorMessage = "Tài khoản yêu cầu xác minh Số điện thoại / SMS (Checkpoint)";
      } else if (lower.includes("checkpoint")) {
        errorMessage = "Tài khoản bị Checkpoint bảo mật từ chối tạo Page";
      } else if (
        lower.includes("profile_creation_error") ||
        lower.includes("create_error") ||
        lower.includes("quá nhiều") ||
        lower.includes("too many") ||
        lower.includes("limit_reached")
      ) {
        errorMessage = "Tài khoản bị giới hạn (Đã tạo quá nhiều Trang gần đây, hãy thử lại sau)";
      } else if (lower.includes("invalid_name") || lower.includes("tên không hợp lệ")) {
        errorMessage = "Tên Page không hợp lệ hoặc chứa từ khóa bị Facebook chặn";
      }
    }

    // JSON error
    if (!errorMessage) {
      try {
        const json = JSON.parse(raw);
        if (json.error?.message) {
          errorMessage = json.error.message;
        } else if (Array.isArray(json.errors) && json.errors[0]?.message) {
          errorMessage = json.errors[0].message;
        }
      } catch {
        // ignore json parse error
      }
    }

    if (!errorMessage) {
      const clean = raw.replace(/[\r\n\t]+/g, " ").slice(0, 150);
      errorMessage = clean ? `Lỗi: ${clean}` : "Không thể tạo Trang (Lỗi không xác định)";
    }

    return {
      isSuccess: false,
      pageName,
      category: selectedCategory,
      errorMessage,
      rawResponse: raw,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Lỗi kết nối khi gửi yêu cầu Reg Page";
    return {
      isSuccess: false,
      pageName,
      errorMessage: msg,
    };
  }
}
