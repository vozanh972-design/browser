# BÓC TÁCH 100% LOGIC DOLIKE TỪ GOMAX 1.2.4: PHẦN 1 - ĐĂNG NHẬP & LƯU TRỮ

> **Nguồn trích xuất từ Smali APK GoMax 1.2.4**:
> - `Lcom/hoanguyen/gomax/ui/dolike/DolikeWebLoginActivity;`
> - `Lx/n2;` (Dialog Cấu hình Token DoLike)
> - `Lx/iq;->w` và `Lx/iq;->x` (Xác thực thông tin tài khoản và ví)

---

## 1. Cơ chế Đăng nhập của GoMax

Trong toàn bộ mã nguồn APK GoMax 1.2.4, **hoàn toàn KHÔNG CÓ** form nhập Email / Mật khẩu kiểu form đăng ký web PHP thông thường. GoMax hỗ trợ 2 phương thức kết nối chuẩn:

### Phương thức A: Mở Web chính chủ DoLike (`DolikeWebLoginActivity`)
- **Tên Class**: `Lcom/hoanguyen/gomax/ui/dolike/DolikeWebLoginActivity;`
- **Tiêu đề Activity**: `"Đăng nhập Web DoLike"`
- **Thông báo hướng dẫn người dùng**: `"Đăng nhập DoLike trên trang chính chủ để đồng bộ số dư."`
- **URL tải trong WebView**: `https://congtingudolike.servehttp.com/`
- **Cấu hình WebView của GoMax**:
  - `setJavaScriptEnabled(true)`
  - `setDomStorageEnabled(true)`
  - `CookieManager.getInstance().setAcceptCookie(true)`
  - `CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)`
- **Cơ chế bắt Cookie/Token**:
  - Khi trang web DoLike tải xong (`onPageFinished` trong `Lx/jr;`), GoMax gọi:
    `CookieManager.getInstance().getCookie("https://congtingudolike.servehttp.com")`
  - Đồng thời thực thi script JavaScript injected để bắt `localStorage` (`device_id`, `username`, `signing_key`, `user_id`) và header `authorization`.
  - Khi người dùng đăng nhập thành công trên trang chính chủ, GoMax bắt được session cookie (chứa `PHPSESSID`, `mgauto_email_persist`) và Token Bearer, sau đó tự động đóng WebView.

### Phương thức B: Nhập Authorization Token DoLike (`Lx/n2;`)
- **Tên Class**: `Lx/n2;`
- **Nút hành động trong Dialog**: `"Xác nhận Token"`
- **Trường nhập liệu**: Ô nhập chuỗi **Authorization Token DoLike** (định dạng JWT `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`).
- **Cấu trúc JWT Token chính chủ DoLike**:
  Khi giải mã Base64 phần payload của Token DoLike:
  ```json
  {
    "iss": "mgauto",
    "user_id": 55967,
    "email": "calebford9906113@gmail.com",
    "exp": 1800000000
  }
  ```
  - `iss`: định danh hệ thống `"mgauto"` (MGAUTO / DoLike ecosystem).
  - `user_id`: ID định danh người dùng trong database DoLike.
  - `email`: Email tài khoản người dùng đã đăng ký.
  - `exp`: Thời hạn hết hạn của Token.

---

## 2. Cơ chế Xác thực Token lên Server (`Lx/iq;->x`)

Khi người dùng nhấn nút `"Xác nhận Token"`, GoMax gọi hàm xác thực:
- **Endpoint kiểm tra**:
  1. `GET https://congtingudolike.servehttp.com/api/wallet.php`
  2. `GET https://congtingudolike.servehttp.com/api/users.php`
- **Headers bắt buộc chuẩn GoMax**:
  ```http
  Accept: application/json
  Authorization: Bearer <token>
  X-API-Token: <token>
  Origin: https://congtingudolike.servehttp.com
  Referer: https://congtingudolike.servehttp.com/
  ```
- **Xử lý phản hồi từ Server**:
  - **Nếu Token hợp lệ**:
    - Trả về thông tin ví: `coins`, `balance`, `wallet_balance`.
    - Trả về thông tin user: `email`, `display_name`, `telegram_uid`.
    - Hiển thị Toast thông báo: `"Kết nối DoLike thành công!"`.
  - **Nếu Token không hợp lệ**:
    - Hiển thị Toast thông báo: `"Authorization Token DoLike không hợp lệ!"`.

---

## 3. Cơ chế Lưu trữ Thông tin (SharedPreferences)

Sau khi xác thực thành công, GoMax lưu các trường sau vào bộ nhớ SharedPreferences:

| Key SharedPreferences | Ý nghĩa | Ví dụ giá trị |
| :--- | :--- | :--- |
| `dolike_auth_token` | Token xác thực chính | `eyJhbGciOiJIUzI1Ni...` |
| `dolike_email` | Email tài khoản DoLike | `calebford9906113@gmail.com` |
| `dolike_display_name` | Tên hiển thị người dùng | `calebford9906113` |
| `dolike_telegram_uid` | UID tài khoản Telegram | `123456789` |
| `dolike_balance` | Số dư xu DoLike | `15000` |

*Ghi chú đặc biệt trong mã Smali*:
GoMax chủ động gọi `remove("dolike_cookies")` và `remove("dolike_password")` để chuyển hoàn toàn sang sử dụng Bearer Token `dolike_auth_token` an toàn.
