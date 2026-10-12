# BÓC TÁCH 100% LOGIC DOLIKE TỪ GOMAX 1.2.4: PHẦN 2 - THÊM & KIỂM TRA TÀI KHOẢN INSTAGRAM

> **Nguồn trích xuất từ Smali APK GoMax 1.2.4**:
> - `Lx/iq;->e` (Hàm kiểm tra & liên kết tài khoản Instagram)
> - `Lx/iq;->h` (Hàm lấy danh sách tài khoản DoLike hiện có)
> - `Lx/iq;->m` (Hàm gửi yêu cầu liên kết nick Instagram mới)

---

## 1. Quy trình Kiểm tra Tài khoản đã liên kết (`Lx/iq;->e`)

Trước khi bắt đầu chạy job hoặc khi người dùng yêu cầu liên kết nick, GoMax luôn thực hiện bước kiểm tra đối soát trước:

```
[Người dùng / Runner] 
       │
       ▼
Gọt sạch tên nick: regex "^@+" (loại bỏ ký tự @)
       │
       ▼
Gọi Lx/iq;->h: GET /api/platform-accounts.php
       │
       ├──► [Đã có trong danh sách DoLike] ──► Log: "[DoLike Instagram] Đã xác nhận tài khoản @{username} trên DoLike (ID: {id}); không liên kết lại."
       │                                     ──► Trả về: Thành công (alreadyLinked = true)
       │
       └──► [Chưa có trong danh sách DoLike] ──► Gọi tiếp Lx/iq;->m: POST /api/platform-accounts.php
```

### Chi tiết Request lấy danh sách (`Lx/iq;->h`):
- **URL**: `GET https://congtingudolike.servehttp.com/api/platform-accounts.php`
- **Headers**:
  ```http
  Accept: application/json
  Authorization: Bearer <token>
  X-API-Token: <token>
  Origin: https://congtingudolike.servehttp.com
  Referer: https://congtingudolike.servehttp.com/
  ```
- **Phản hồi**: Mảng JSON chứa các tài khoản đã liên kết:
  ```json
  [
    {
      "id": 105423,
      "platform": "instagram",
      "account_url": "calebford9906113",
      "username": "calebford9906113",
      "account_type": "vn",
      "status": "active"
    }
  ]
  ```

---

## 2. Quy trình Thêm Tài khoản Mới (`Lx/iq;->m`)

Nếu nick Instagram chưa có trên hệ thống DoLike, GoMax gửi lệnh thêm tài khoản:

### Chi tiết Request thêm tài khoản:
- **URL**: `POST https://congtingudolike.servehttp.com/api/platform-accounts.php`
- **Headers**:
  ```http
  Accept: application/json
  Content-Type: application/json
  Authorization: Bearer <token>
  X-API-Token: <token>
  Origin: https://congtingudolike.servehttp.com
  Referer: https://congtingudolike.servehttp.com/
  ```
- **Body Payload (Chuẩn GoMax Smali)**:
  ```json
  {
    "platform": "instagram",
    "account_url": "calebford9906113",
    "account_type": "vn"
  }
  ```
  *(Lưu ý: `account_type` bắt buộc là `"vn"` để DoLike phân bổ vào server Việt Nam).*

---

## 3. Phân biệt Trường hợp Thêm Acc ĐÚNG vs Thêm Acc SAI

### Trường hợp 1: Thêm Acc ĐÚNG (Nick hợp lệ, tồn tại trên Instagram)
- **Phản hồi từ Server DoLike**:
  ```json
  {
    "status": "success",
    "message": "Liên kết thành công",
    "data": {
      "saved": true,
      "id": 105423,
      "username": "calebford9906113",
      "account_uid": "64153158612",
      "uid": "64153158612"
    }
  }
  ```
- **Xử lý của GoMax**:
  - Trích xuất `id` từ `data.id` (hoặc `data.account_uid`).
  - Ghi log chuẩn:
    `[DoLike Instagram] Đã liên kết tài khoản @calebford9906113 (Server Việt Nam) lên DoLike (ID: 105423)`
  - Đánh dấu tài khoản là `dolikeLinked = true` và cho phép nhận job ngay.

### Trường hợp 2: Thêm Acc SAI (Nick không tồn tại, sai định dạng, bị Instagram khóa)
- **Phản hồi từ Server DoLike**:
  ```json
  {
    "status": "error",
    "message": "Tài khoản không tồn tại trên Instagram hoặc đang ở chế độ riêng tư"
  }
  ```
- **Xử lý của GoMax**:
  - Bắt lỗi tại `Lx/iq;->u` (hàm trích xuất chuỗi lỗi từ `msg`, `message`, `error`).
  - Trả về lỗi thất bại: `Không thể liên kết tài khoản vào DoLike: {message}`.
  - GoMax KHÔNG thêm nick này vào danh sách chạy, dừng lại và thông báo cho người dùng.

### Trường hợp 3: Server phản hồi "Tài khoản đã tồn tại"
- **Phản hồi từ Server DoLike**:
  Chuỗi thông báo chứa từ khóa: `"đã tồn tại"`, `"already"`, hoặc `"đã liên kết"`.
- **Xử lý của GoMax**:
  - Coi như liên kết thành công vì tài khoản đã có sẵn trên hệ thống.
  - Không ném ra lỗi, chuyển trạng thái tài khoản thành Đã liên kết.
