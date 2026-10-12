# HƯỚNG DẪN TÍCH HỢP CHI TIẾT 100% LOGIC DOLIKE INSTAGRAM TỪ GOMAX 1.2.4

Tài liệu này hướng dẫn chi tiết từng bước tích hợp logic DoLike Instagram được trích xuất nguyên bản từ APK GoMax 1.2.4 vào dự án ứng dụng Desktop/Web, đảm bảo **độc lập tuyệt đối, không đụng chạm đến bất kỳ module nào khác (XSMM, NVC, Facebook)**.

---

## MỤC LỤC
1. [Cấu trúc thư mục logic](#1-cấu-trúc-thư-mục-logic)
2. [Bước 1: Tích hợp Giao diện Kết nối DoLike](#bước-1-tích-hợp-giao-diện-kết-nối-dolike)
3. [Bước 2: Tích hợp Quy trình Kiểm tra & Liên kết Nick Instagram](#bước-2-tích-hợp-quy-trình-kiểm-tra--liên-kết-nick-instagram)
4. [Bước 3: Tích hợp Runner Tự Động Hóa Làm Job Instagram](#bước-3-tích-hợp-runner-tự-động-hóa-làm-job-instagram)
5. [Bước 4: Nguyên tắc Bảo Toàn 100% XSMM & Module Khác](#bước-4-nguyên-tắc-bảo-toàn-100-xsmm--module-khác)

---

## 1. Cấu trúc thư mục logic

Toàn bộ logic bóc tách từ GoMax 1.2.4 nằm gọn trong thư mục `dolike_ig_logic/`:

```
dolike_ig_logic/
├── 01_DANG_NHAP_VA_LUU_TRU.md             # Tài liệu bóc tách cơ chế Đăng nhập & Lưu token
├── 02_THEM_ACC_INSTAGRAM_VA_KIEM_TRA.md   # Tài liệu bóc tách API thêm acc đúng / acc sai
├── 03_NHAN_JOB_LAM_JOB_BAO_CAO.md         # Tài liệu bóc tách nhận job, làm job IG, báo cáo/skip
├── 04_TONG_HOP_FULL_LOGIC.ts              # File code TypeScript đầy đủ 100% độc lập
└── HUONG_DAN_TICH_HOP_CHI_TIET.md         # File hướng dẫn tích hợp này
```

---

## Bước 1: Tích hợp Giao diện Kết nối DoLike

Trong GoMax APK, DoLike chỉ có 2 cơ chế kết nối chính:
1. Mở trang Web chính chủ DoLike (`DolikeWebLoginActivity` -> `https://congtingudolike.servehttp.com/`).
2. Nhập Authorization Token DoLike (`Lx/n2;` -> nút `"Xác nhận Token"`).

### Mã nhúng Component UI (`DolikeLoginDialog`):
```tsx
import { openUrl } from "@tauri-apps/plugin-opener";
import { DOLIKE_BASE_URL, verifyDolikeToken } from "@/lib/dolike-api";

// 1. Khi bấm "Mở Web DoLike"
const handleOpenWeb = async () => {
  try {
    await openUrl(DOLIKE_BASE_URL);
  } catch {
    window.open(DOLIKE_BASE_URL, "_blank");
  }
};

// 2. Khi bấm "Xác nhận Token"
const handleVerify = async (token: string) => {
  const result = await verifyDolikeToken(token);
  if (result.success) {
    // Lưu token chuẩn GoMax vào localStorage
    localStorage.setItem("dolike_auth_token", token);
    localStorage.setItem("dolike_email", result.email || "");
    localStorage.setItem("dolike_balance", result.balance || "0 đ");
    if (result.userId) {
      localStorage.setItem("dolike_user_id", String(result.userId));
    }
    showSuccessToast("Kết nối DoLike thành công!");
  } else {
    showErrorToast("Authorization Token DoLike không hợp lệ!");
  }
};
```

---

## Bước 2: Tích hợp Quy trình Kiểm tra & Liên kết Nick Instagram

GoMax xử lý liên kết nick Instagram qua phương thức `Lx/iq;->e`:

```typescript
import { linkDolikeAccountFull } from "@/lib/dolike-api";

// Hàm gọi khi người dùng bấm nút "Chưa liên kết" trên một nick Instagram
async function handleLinkAccount(username: string, token: string) {
  const cleanUsername = username.replace(/^@+/, "").trim();

  // Gọi hàm chuẩn GoMax: tự động kiểm tra acc đã có trên DoLike chưa,
  // nếu chưa có mới gửi POST thêm mới với account_type: "vn"
  const res = await linkDolikeAccountFull({
    accountUrl: cleanUsername,
    platform: "instagram",
    bearerToken: token,
  });

  if (res.success) {
    if (res.alreadyLinked) {
      console.log(`[DoLike Instagram] Đã xác nhận tài khoản @${cleanUsername} trên DoLike; không liên kết lại.`);
    } else {
      console.log(`[DoLike Instagram] Đã liên kết tài khoản @${cleanUsername} (Server Việt Nam) lên DoLike (ID: ${res.id})`);
    }
    // Cập nhật trạng thái giao diện: đã liên kết
    markAccountAsLinked(cleanUsername);
  } else {
    // Phản hồi chi tiết nếu acc sai / không tồn tại trên Instagram
    showErrorToast(res.error || "Không thể liên kết tài khoản vào DoLike");
  }
}
```

---

## Bước 3: Tích hợp Runner Tự Động Hóa Làm Job Instagram

Runner độc lập `dolikeRunner` (tương ứng `Lx/gu1;` của GoMax) chịu trách nhiệm:
1. Kiểm tra cookie Instagram xem có checkpoint `-9` hay không trước khi chạy.
2. Vòng lặp nhận job qua `ig-cudau.php` (ký token SHA-256 qua `session.php`).
3. Tương tác Instagram:
   - **Like**: Trích xuất shortcode, giải mã `shortcodeToMediaId` qua BigInt, gọi GraphQL DOC_LIKE `9595477160535898` hoặc REST.
   - **Follow**: Lấy numeric user ID, gọi GraphQL DOC_FOLLOW `9740159112729312`.
   - **Comment**: Dùng kho câu bình luận GoMax: `["Thích quá ạ", "Dễ thương quá nè ❤️", "❤️", "Tuyệt vời quá!", "Xinh quá nè", "Đẹp quá"]`.
4. Báo cáo hoàn thành job qua `perform_job`, nhận Xu và cộng dồn vào số dư ví.
5. Nếu gặp lỗi tương tác: tự động gửi lệnh `nopjobing` (`skip_unwanted`) để không bị kẹt nick.
6. Tự động xử lý Cooldown theo yêu cầu máy chủ (`retry_after`).

### Cách gọi trong UI:
```typescript
import { dolikeRunner } from "@/lib/dolike-runner";

// Bắt đầu chạy nhiệm vụ DoLike Instagram cho 1 tài khoản
dolikeRunner.startAccount(account, {
  bearerToken: dolikeToken,
});

// Bắt đầu chạy hàng loạt nhiều nick
dolikeRunner.startAccounts(accountList, {
  bearerToken: dolikeToken,
});

// Dừng 1 nick hoặc dừng tất cả
dolikeRunner.stopAccount(account.id);
dolikeRunner.stopAll();
```

---

## Bước 4: Nguyên tắc Bảo Toàn 100% XSMM & Module Khác

Để đảm bảo tuyệt đối không ảnh hưởng đến module XSMM, Facebook hay NVC:
1. **Không import chéo**: File `dolike-runner.ts` và `dolike-api.ts` KHÔNG import bất kỳ class, interface hay hàm nào từ `xsmm-runner.ts` hoặc `xsmm-api.ts`.
2. **Không sửa các state chung**: Trạng thái chạy của DoLike sử dụng `dolikeRunner` riêng biệt, không dùng chung instance runner với XSMM.
3. **Phân tách tab UI rõ ràng**: Mọi logic DoLike chỉ nằm trong nhánh `currentPage === "dolike"`, các tab XSMM, Facebook, NVC hoàn toàn nguyên vẹn 100%.
