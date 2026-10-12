# BÓC TÁCH 100% LOGIC DOLIKE TỪ GOMAX 1.2.4: PHẦN 3 - NHẬN JOB, LÀM JOB & BÁO CÁO

> **Nguồn trích xuất từ Smali APK GoMax 1.2.4**:
> - `Lx/iq;->l` (Thuật toán sinh x-api-token bằng SHA-256 qua session.php)
> - `Lx/iq;->i` (Nhận job DoLike Instagram)
> - `Lx/gu1;` (Runner tự động hóa DoLike Instagram Automation)
> - `Lx/iq;->c` (Báo cáo hoàn thành job)
> - `Lx/iq;->z` (Bỏ qua job khi lỗi - skip/nopjobing)

---

## 1. Cơ chế Sinh Token Bảo Mật `x-api-token` (`Lx/iq;->l`)

Trước khi thực hiện các yêu cầu nhạy cảm (nhận job, báo cáo hoàn thành), GoMax ký số bảo mật:
1. Tính hàm băm SHA-256 của chuỗi payload JSON cần gửi (`body_hash`).
2. Gửi request xin token phiên:
   - **URL**: `POST https://congtingudolike.servehttp.com/api/session.php`
   - **Body**:
     ```json
     {
       "path": "/api/bot/users/nhan-instagram/ig-cudau.php",
       "method": "POST",
       "body_hash": "<SHA256_HASH_CỦA_BODY>"
     }
     ```
   - **Headers**: `Accept: application/json`, `Content-Type: application/json`, `Authorization: Bearer <token>`.
3. Server trả về chuỗi `data.token` hoặc `token`. Chuỗi này được GoMax gán vào header `x-api-token` trong request tiếp theo.

---

## 2. Quy trình Nhận Job DoLike (`Lx/iq;->i`)

- **URL chính thức**: `POST https://congtingudolike.servehttp.com/api/bot/users/nhan-instagram/ig-cudau.php`
  *(URL dự phòng: `https://congtingudolike.servehttp.com/api/session.php`)*
- **Headers**:
  ```http
  Accept: application/json
  Content-Type: application/json
  Authorization: Bearer <token>
  x-api-token: <generated_sha256_token>
  Origin: https://congtingudolike.servehttp.com
  Referer: https://congtingudolike.servehttp.com/
  ```
- **Body Payload**:
  ```json
  {
    "type": "get_jobs",
    "job_type": "all",
    "platform": "instagram",
    "account_id": "105423",
    "account_uid": "64153158612"
  }
  ```

### Xử lý các tình huống phản hồi từ Server:
1. **Có Job mới**:
   Server trả về object job chứa:
   - `run_id`: Mã phiên làm job duy nhất.
   - `type`: Loại job (`like`, `follow`, `comment`).
   - `link` / `url`: Đường dẫn bài viết hoặc trang cá nhân Instagram.
   - `post_id` / `media_id`: ID bài viết hoặc ID người dùng cần tương tác.
   - `coin` / `xu`: Số xu nhận được sau khi làm xong (thường là 50 - 150 Xu).
2. **Hết Job / Server yêu cầu chờ (Cooldown)**:
   - Server trả về `status: "error"` kèm `retry_after: 15`.
   - GoMax hiển thị thông báo: `Cooldown DoLike: chờ 15s theo yêu cầu server...`.
   - Nếu không có `retry_after`: GoMax chờ ngẫu nhiên từ 10 - 15 giây rồi nhận lại.
   - Nếu hết job liên tiếp **40 lần**, GoMax tự động dừng phiên chạy với thông báo: `Hết job liên tiếp 40 lần. Đã tạm dừng.`

---

## 3. Quy trình Tự Động Hóa Thực Hiện Job Instagram (`Lx/gu1;`)

### Bước 1: Kiểm tra tình trạng nick Instagram
GoMax kiểm tra Cookie tài khoản Instagram trước khi làm job:
- Nếu cookie chết hoặc Instagram trả về mã checkpoint `-9`:
  - Dừng tài khoản ngay lập tức với thông báo: `Cookie tài khoản hết hạn hoặc bị Checkpoint (-9). Dừng.`

### Bước 2: Tương tác theo từng loại job

#### A. Job LIKE (`jobType = "like"`)
- Phân giải `mediaId`:
  - Nếu DoLike trả về đường dẫn `https://www.instagram.com/p/DFxyz.../`:
  - GoMax trích xuất shortcode `DFxyz...` và giải mã sang số nguyên lớn `mediaId` bằng thuật toán Base64 alphabet:
    `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_`
- Gửi GraphQL Like với Doc ID chuẩn GoMax: `9595477160535898`.
- Nếu GraphQL không thành công, GoMax gửi fallback sang REST API:
  `POST https://www.instagram.com/api/v1/web/likes/{mediaId}/like/`

#### B. Job FOLLOW (`jobType = "follow"`)
- Phân giải numeric `target_user_id`:
  - Nếu DoLike trả về username hoặc URL profile, GoMax gọi API `web_profile_info/?username={username}` để lấy UID số chính xác.
- Gửi GraphQL Follow với Doc ID chính của GoMax: `9740159112729312`.
- Nếu lỗi, thử tiếp Doc ID dự phòng của GoMax: `9663809173698092`.

#### C. Job COMMENT (`jobType = "comment"`)
- Nội dung bình luận:
  - Nếu DoLike trả về sẵn trường `comment_text` / `message`: Sử dụng nội dung đó.
  - Nếu DoLike không có sẵn nội dung, GoMax sử dụng kho câu mẫu chuẩn:
    ```json
    [
      "Thích quá ạ",
      "Dễ thương quá nè ❤️",
      "❤️",
      "Tuyệt vời quá!",
      "Xinh quá nè",
      "Đẹp quá"
    ]
    ```
- Gửi GraphQL Comment với Doc ID chuẩn GoMax: `7755358241198424`.

---

## 4. Báo Cáo Hoàn Thành Job (`Lx/iq;->c`)

Sau khi tương tác Instagram thành công, GoMax chờ 2 giây (`Chờ gửi báo cáo -> đang gửi báo cáo...`) rồi gửi xác nhận:
- **URL**: `POST https://congtingudolike.servehttp.com/api/bot/users/nhan-instagram/ig-cudau.php`
- **Body Payload**:
  ```json
  {
    "type": "perform_job",
    "run_id": "<RUN_ID_CỦA_JOB>"
  }
  ```
- **Xử lý thành công**:
  - Server trả về số xu thưởng (`coins`).
  - GoMax ghi log: `hoàn thành job {type} (+{coins} Xu)`.
  - Tự động cộng dồn vào số dư hiển thị `dolike_balance`.

---

## 5. Bỏ Qua Job khi Gặp Sự Cố (`Lx/iq;->z`)

Nếu không thể like, follow, comment (do bài viết bị xóa, nick bị chặn, bài viết riêng tư, hoặc báo cáo thất bại), GoMax bắt buộc phải gửi lệnh skip để DoLike không bị kẹt phiên:
- **URL**: `POST https://congtingudolike.servehttp.com/api/bot/users/nhan-instagram/ig-cudau.php`
- **Body Payload**:
  ```json
  {
    "type": "nopjobing",
    "run_id": "<RUN_ID_CỦA_JOB>",
    "report_type": "skip_unwanted",
    "report_reason": "error",
    "report_details": "error"
  }
  ```
- **Các mã `report_type` chuẩn GoMax**:
  - `skip_already_done`: Đã làm trước đó.
  - `skip_unwanted`: Bỏ qua job không mong muốn hoặc lỗi tương tác.
  - `error_post_missing`: Bài viết không còn tồn tại.
  - `error_private_account`: Tài khoản riêng tư.
  - `error_completion_failed`: Thao tác thất bại.

---

## 6. Khoảng Nghỉ Giữa Các Job (Safety Delay)
Theo chuẩn mã nguồn `Lx/gu1;`, GoMax áp dụng thời gian nghỉ an toàn giữa mỗi lần nhận job:
- **Thời gian delay**: Ngẫu nhiên từ **8 giây đến 15 giây** (`8000 + random(7000)` ms) để đảm bảo an toàn cho nick Instagram không bị phạt spam.
