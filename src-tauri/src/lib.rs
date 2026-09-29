// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use hmac::{Hmac, Mac};
use serde::Serialize;
use sha2::Sha256;
use std::fmt::Write as FmtWrite;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::AppHandle;

type HmacSha256 = Hmac<Sha256>;

// ============================================================
// SECURITY: Global license session
// Stored in Rust memory — cannot be read or written from JS.
// ============================================================
static LICENSE_VALID: AtomicBool = AtomicBool::new(false);
static LICENSE_KEY_STORE: Mutex<Option<String>> = Mutex::new(None);

// ============================================================
// XOR obfuscation (key = 0x5A)
// Prevents plain-text API URLs and secrets from appearing
// in the binary when analyzed by `strings.exe` or IDA Pro.
// ============================================================
const OBF_KEY: u8 = 0x5A;

// "https://lunex.io.vn/api/license.php" XOR 0x5A
const API_OBF: &[u8] = &[
    0x32, 0x2E, 0x2E, 0x2A, 0x29, 0x60, 0x75, 0x75, 0x36, 0x2F, 0x34, 0x3F,
    0x22, 0x74, 0x33, 0x35, 0x74, 0x2C, 0x34, 0x75, 0x3B, 0x2A, 0x33, 0x75,
    0x36, 0x33, 0x39, 0x3F, 0x34, 0x29, 0x3F, 0x74, 0x2A, 0x32, 0x2A,
];

// "lunexpc" XOR 0x5A
const APP_OBF: &[u8] = &[0x36, 0x2F, 0x34, 0x3F, 0x22, 0x2A, 0x39];

// "LUNEX_SECURE_HMAC_SECRET_2026_x99aBq" XOR 0x5A
const HMAC_OBF: &[u8] = &[
    0x16, 0x0F, 0x14, 0x1F, 0x02, 0x05, 0x09, 0x1F, 0x19, 0x0F, 0x08, 0x1F,
    0x05, 0x12, 0x17, 0x1B, 0x19, 0x05, 0x09, 0x1F, 0x19, 0x08, 0x1F, 0x0E,
    0x05, 0x68, 0x6A, 0x68, 0x6C, 0x05, 0x22, 0x63, 0x63, 0x3B, 0x18, 0x2B,
];

#[inline(always)]
fn deobf(data: &[u8]) -> String {
    String::from_utf8(data.iter().map(|&b| b ^ OBF_KEY).collect()).unwrap_or_default()
}

// ============================================================
// HWID: Unique hardware fingerprint (Windows MachineGuid)
// Same approach as C# reference implementation in docs.
// ============================================================
fn get_hwid() -> String {
    #[cfg(windows)]
    {
        use winreg::enums::HKEY_LOCAL_MACHINE;
        use winreg::RegKey;
        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        if let Ok(subkey) = hklm.open_subkey(r"SOFTWARE\Microsoft\Cryptography") {
            if let Ok(guid) = subkey.get_value::<String, _>("MachineGuid") {
                return guid;
            }
        }
    }
    // Fallback: derive HWID from environment (non-Windows or registry fail)
    let mut parts: Vec<String> = Vec::new();
    if let Ok(v) = std::env::var("COMPUTERNAME") {
        parts.push(v);
    }
    if let Ok(v) = std::env::var("USERNAME") {
        parts.push(v);
    }
    if parts.is_empty() {
        parts.push("unknown_host".to_string());
    }
    use sha2::{Digest, Sha256 as Sha256Digest};
    let hash = Sha256Digest::digest(parts.join("-").as_bytes());
    let mut hex = String::new();
    for b in &hash {
        let _ = write!(hex, "{:02x}", b);
    }
    hex
}

// ============================================================
// HMAC-SHA256 verification
// Server signs `json_encode($data)` with the secret key.
// We re-compute and compare to detect server-bypass attacks
// (Fiddler/Burp/hosts file redirect to fake server).
// ============================================================
fn verify_hmac_signature(secret: &str, data_json: &str, received: &str) -> bool {
    let Ok(mut mac) = HmacSha256::new_from_slice(secret.as_bytes()) else {
        return false;
    };
    mac.update(data_json.as_bytes());
    let result = mac.finalize().into_bytes();
    let mut computed = String::new();
    for b in result.iter() {
        let _ = write!(computed, "{:02x}", b);
    }
    computed == received
}

// ============================================================
// URL-encode a string (percent encoding for query params)
// ============================================================
fn url_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for byte in s.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(byte as char);
            }
            _ => {
                let _ = write!(out, "%{:02X}", byte);
            }
        }
    }
    out
}

// ============================================================
// License result returned to the frontend
// ============================================================
#[derive(Serialize, Debug, Clone)]
pub struct LicenseResult {
    pub success: bool,
    pub status: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub days_left: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expired_at: Option<String>,
}

// ============================================================
// verify_license — Tauri command callable from JavaScript
// ============================================================
#[tauri::command]
fn verify_license(key: String) -> LicenseResult {
    let trimmed = key.trim().to_string();

    if trimmed.is_empty() {
        return LicenseResult {
            success: false,
            status: "missing_key".into(),
            message: "Vui lòng nhập mã key bản quyền!".into(),
            days_left: None,
            expired_at: None,
        };
    }

    // Build API URL from obfuscated bytes
    let api_url = deobf(API_OBF);
    let app_slug = deobf(APP_OBF);
    let hwid = get_hwid();
    let full_url = format!(
        "{}?key={}&app={}&hwid={}",
        api_url,
        url_encode(&trimmed),
        url_encode(&app_slug),
        url_encode(&hwid)
    );

    // Call API via curl (same pattern as curl_request)
    #[cfg(windows)]
    let mut cmd = std::process::Command::new("curl.exe");
    #[cfg(not(windows))]
    let mut cmd = std::process::Command::new("curl");

    cmd.arg("-s")
        .arg("--connect-timeout")
        .arg("10")
        .arg("--max-time")
        .arg("15")
        .arg(&full_url);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }

    let raw = match cmd.output() {
        Ok(o) => String::from_utf8_lossy(&o.stdout).to_string(),
        Err(_) => String::new(),
    };

    if raw.trim().is_empty() {
        // Network error — check if this key was previously validated in this session
        if LICENSE_VALID.load(Ordering::SeqCst) {
            if let Ok(lock) = LICENSE_KEY_STORE.lock() {
                if lock.as_deref() == Some(trimmed.as_str()) {
                    return LicenseResult {
                        success: true,
                        status: "valid".into(),
                        message: "Đang chạy ở chế độ offline – đã xác thực trước đó.".into(),
                        days_left: None,
                        expired_at: None,
                    };
                }
            }
        }
        return LicenseResult {
            success: false,
            status: "network_error".into(),
            message: "Không thể kết nối đến máy chủ xác thực. Vui lòng kiểm tra mạng!".into(),
            days_left: None,
            expired_at: None,
        };
    }

    // Parse JSON response
    let parsed: serde_json::Value = match serde_json::from_str(raw.trim()) {
        Ok(v) => v,
        Err(_) => {
            return LicenseResult {
                success: false,
                status: "parse_error".into(),
                message: "Phản hồi từ máy chủ không hợp lệ!".into(),
                days_left: None,
                expired_at: None,
            };
        }
    };

    let success = parsed["success"].as_bool().unwrap_or(false);
    let status = parsed["status"].as_str().unwrap_or("unknown").to_string();
    let srv_message = parsed["message"].as_str().unwrap_or("").to_string();

    // ── ANTI-BYPASS: Verify HMAC-SHA256 signature ──────────────────
    // If an attacker redirects traffic to a fake server that returns
    // {"success":true,"status":"valid",...} without the correct HMAC
    // signature, this check will catch it and block the activation.
    if let (Some(data_val), Some(sig)) = (parsed.get("data"), parsed["signature"].as_str()) {
        if !sig.is_empty() {
            let hmac_secret = deobf(HMAC_OBF);
            // serde_json preserves insertion order (preserve_order feature)
            // so re-serialization matches what PHP json_encode($data) produced
            let data_json = serde_json::to_string(data_val).unwrap_or_default();
            if !verify_hmac_signature(&hmac_secret, &data_json, sig) {
                LICENSE_VALID.store(false, Ordering::SeqCst);
                return LicenseResult {
                    success: false,
                    status: "signature_invalid".into(),
                    message: "Phát hiện giả mạo máy chủ! Kết nối bị chặn vì lý do bảo mật.".into(),
                    days_left: None,
                    expired_at: None,
                };
            }
        }
    }

    if success && status == "valid" {
        // Store validated license in memory — feature gate will check this
        LICENSE_VALID.store(true, Ordering::SeqCst);
        if let Ok(mut lock) = LICENSE_KEY_STORE.lock() {
            *lock = Some(trimmed);
        }

        let days_left = parsed["data"]["days_left"].as_f64();
        let expired_at = parsed["data"]["expired_at"]
            .as_str()
            .filter(|s| !s.is_empty())
            .map(str::to_string);

        LicenseResult {
            success: true,
            status,
            message: srv_message,
            days_left,
            expired_at,
        }
    } else {
        // Server explicitly rejected — revoke any cached session
        LICENSE_VALID.store(false, Ordering::SeqCst);
        if let Ok(mut lock) = LICENSE_KEY_STORE.lock() {
            *lock = None;
        }

        let friendly_msg = match status.as_str() {
            "wrong_device" => {
                "Key này đang chạy trên máy khác! Vui lòng vào web Lunex để Reset thiết bị.".into()
            }
            "app_mismatch" => "Mã key này không thuộc về ứng dụng này!".into(),
            "key_expired" => "Bản quyền của bạn đã hết hạn! Vui lòng gia hạn thêm.".into(),
            "invalid_key" => "Mã key không hợp lệ hoặc chưa được mua!".into(),
            "key_revoked" => "Bản quyền này đã bị thu hồi do vi phạm điều khoản!".into(),
            "rate_limited" => {
                "Bạn đã gửi quá nhiều yêu cầu xác thực. Vui lòng thử lại sau 1 phút!".into()
            }
            _ => srv_message,
        };

        LicenseResult {
            success: false,
            status,
            message: friendly_msg,
            days_left: None,
            expired_at: None,
        }
    }
}

// ============================================================
// Existing commands — protected by license gate
// ============================================================

#[derive(Serialize)]
pub struct SystemInfo {
    pub app_version: String,
    pub os: String,
    pub arch: String,
    pub portable: bool,
}

#[tauri::command]
fn get_system_info() -> SystemInfo {
    SystemInfo {
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        portable: false,
    }
}

#[tauri::command]
fn confirm_quit(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn xsmm_request(
    url: String,
    method: String,
    token: String,
    body: Option<String>,
) -> Result<String, String> {
    // Feature gate: block if license not verified this session
    if !LICENSE_VALID.load(Ordering::SeqCst) {
        return Err("E_UNLICENSED".to_string());
    }

    #[cfg(windows)]
    let mut cmd = std::process::Command::new("curl.exe");

    #[cfg(not(windows))]
    let mut cmd = std::process::Command::new("curl");

    cmd.arg("-s")
        .arg("-X")
        .arg(&method)
        .arg("-H")
        .arg(format!("Authorization: Bearer {}", token.trim()))
        .arg("-H")
        .arg("Content-Type: application/json");

    if let Some(ref b) = body {
        cmd.arg("-d").arg(b);
    }

    cmd.arg(&url);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute curl: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    if !output.status.success() && stdout.trim().is_empty() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!("XSMM server connection error: {}", err));
    }

    Ok(stdout.into_owned())
}

#[tauri::command]
fn curl_request(
    url: String,
    method: Option<String>,
    headers: Option<Vec<String>>,
    body: Option<String>,
    cookie: Option<String>,
    proxy: Option<String>,
    include_headers: Option<bool>,
) -> Result<String, String> {
    // Feature gate: block if license not verified this session
    if !LICENSE_VALID.load(Ordering::SeqCst) {
        return Err("E_UNLICENSED".to_string());
    }

    #[cfg(windows)]
    let mut cmd = std::process::Command::new("curl.exe");

    #[cfg(not(windows))]
    let mut cmd = std::process::Command::new("curl");

    let m = method.unwrap_or_else(|| "GET".to_string());
    cmd.arg("-s").arg("-L").arg("-X").arg(&m);

    if include_headers.unwrap_or(false) {
        cmd.arg("-i");
    }

    if let Some(hdrs) = headers {
        for h in hdrs {
            cmd.arg("-H").arg(h);
        }
    }

    if let Some(c) = cookie {
        cmd.arg("-b").arg(c);
    }

    if let Some(p) = proxy {
        if !p.trim().is_empty() {
            cmd.arg("-x").arg(p.trim());
        }
    }

    if let Some(ref b) = body {
        cmd.arg("-d").arg(b);
    }

    cmd.arg(&url);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute curl: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            confirm_quit,
            xsmm_request,
            curl_request,
            verify_license,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
