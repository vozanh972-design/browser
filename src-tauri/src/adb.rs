use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AdbStatus {
    pub installed: bool,
    pub adb_path: Option<String>,
    pub version: Option<String>,
    pub error: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AdbDeviceInfo {
    pub serial: String,
    pub state: String, // "device", "unauthorized", "offline", etc.
    pub brand: String,
    pub model: String,
    pub market_name: String,
    pub display_name: String,
    pub battery_level: Option<i32>,
    pub android_version: String,
}

pub fn find_adb_path() -> Option<std::path::PathBuf> {
    // 1. Kiểm tra lệnh `adb` trong PATH
    {
        let mut cmd = std::process::Command::new("adb");
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x0800_0000);
        }
        cmd.arg("version");
        if let Ok(output) = cmd.output() {
            if output.status.success() {
                return Some(std::path::PathBuf::from("adb"));
            }
        }
    }

    // 2. Tìm kiếm trong các thư mục chuẩn trên Windows
    let mut candidates: Vec<std::path::PathBuf> = Vec::new();

    if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
        candidates.push(
            std::path::PathBuf::from(&local_appdata)
                .join("Android")
                .join("Sdk")
                .join("platform-tools")
                .join("adb.exe"),
        );
    }

    if let Ok(userprofile) = std::env::var("USERPROFILE") {
        candidates.push(
            std::path::PathBuf::from(&userprofile)
                .join("AppData")
                .join("Local")
                .join("Android")
                .join("Sdk")
                .join("platform-tools")
                .join("adb.exe"),
        );
    }

    candidates.push(std::path::PathBuf::from(
        r"D:\platform-tools-latest-windows\platform-tools\adb.exe",
    ));
    candidates.push(std::path::PathBuf::from(r"C:\platform-tools\adb.exe"));
    candidates.push(std::path::PathBuf::from(r"D:\platform-tools\adb.exe"));

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            candidates.push(parent.join("platform-tools").join("adb.exe"));
            candidates.push(parent.join("adb.exe"));
        }
    }

    for path in candidates {
        if path.exists() {
            return Some(path);
        }
    }

    None
}

#[tauri::command]
pub fn check_adb_status() -> AdbStatus {
    match find_adb_path() {
        Some(path) => {
            let mut cmd = std::process::Command::new(&path);
            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                cmd.creation_flags(0x0800_0000);
            }
            cmd.arg("version");
            match cmd.output() {
                Ok(out) if out.status.success() => {
                    let text = String::from_utf8_lossy(&out.stdout).to_string();
                    let first_line = text
                        .lines()
                        .next()
                        .unwrap_or("Android Debug Bridge")
                        .trim()
                        .to_string();
                    AdbStatus {
                        installed: true,
                        adb_path: Some(path.to_string_lossy().to_string()),
                        version: Some(first_line),
                        error: None,
                    }
                }
                _ => AdbStatus {
                    installed: true,
                    adb_path: Some(path.to_string_lossy().to_string()),
                    version: None,
                    error: None,
                },
            }
        }
        None => AdbStatus {
            installed: false,
            adb_path: None,
            version: None,
            error: Some("Chưa cài đặt Android Debug Bridge (ADB) trên máy tính".to_string()),
        },
    }
}

#[tauri::command]
pub fn get_adb_devices() -> Result<Vec<AdbDeviceInfo>, String> {
    let adb_bin = match find_adb_path() {
        Some(p) => p,
        None => return Err("Chưa tìm thấy adb.exe trên máy tính".to_string()),
    };

    let mut cmd = std::process::Command::new(&adb_bin);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    cmd.args(["devices", "-l"]);

    let output = cmd.output().map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout);

    let mut devices = Vec::new();
    for line in stdout.lines().skip(1) {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.is_empty() {
            continue;
        }

        let serial = parts[0].to_string();
        let state = if parts.len() > 1 {
            parts[1].to_string()
        } else {
            "unknown".to_string()
        };

        let mut brand = String::new();
        let mut model = String::new();
        let mut market_name = String::new();
        let mut android_ver = String::new();
        let mut battery_level: Option<i32> = None;

        if state == "device" {
            // Đọc toàn bộ thuộc tính thiết bị bằng một lệnh shell getprop duy nhất (nhanh và đủ thông tin)
            let mut c_prop = std::process::Command::new(&adb_bin);
            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                c_prop.creation_flags(0x0800_0000);
            }
            if let Ok(out) = c_prop.args(["-s", &serial, "shell", "getprop"]).output() {
                let txt = String::from_utf8_lossy(&out.stdout);
                let mut prop_map = std::collections::HashMap::new();
                for l in txt.lines() {
                    let trimmed = l.trim();
                    if trimmed.starts_with('[') && trimmed.contains("]: [") {
                        if let Some((k, v)) = trimmed.split_once("]: [") {
                            let key = k.trim_start_matches('[').trim();
                            let val = v.trim_end_matches(']').trim();
                            prop_map.insert(key.to_string(), val.to_string());
                        }
                    }
                }

                brand = prop_map
                    .get("ro.product.brand")
                    .or_else(|| prop_map.get("ro.product.manufacturer"))
                    .unwrap_or(&String::new())
                    .clone();

                model = prop_map
                    .get("ro.product.model")
                    .unwrap_or(&String::new())
                    .clone();

                market_name = prop_map
                    .get("ro.product.marketname")
                    .or_else(|| prop_map.get("ro.vendor.product.marketname"))
                    .or_else(|| prop_map.get("ro.product.display"))
                    .unwrap_or(&String::new())
                    .clone();

                android_ver = prop_map
                    .get("ro.build.version.release")
                    .unwrap_or(&String::new())
                    .clone();
            }

            // Lấy phần trăm pin
            let mut c_bat = std::process::Command::new(&adb_bin);
            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                c_bat.creation_flags(0x0800_0000);
            }
            if let Ok(out) = c_bat
                .args(["-s", &serial, "shell", "dumpsys", "battery"])
                .output()
            {
                let bat_txt = String::from_utf8_lossy(&out.stdout);
                for l in bat_txt.lines() {
                    let trimmed = l.trim();
                    if trimmed.starts_with("level:") {
                        if let Some(num_str) = trimmed.split(':').nth(1) {
                            if let Ok(lvl) = num_str.trim().parse::<i32>() {
                                battery_level = Some(lvl);
                                break;
                            }
                        }
                    }
                }
            }
        } else {
            for part in &parts {
                if let Some(m) = part.strip_prefix("model:") {
                    model = m.replace('_', " ");
                }
            }
        }

        // Tạo tên máy hiển thị đầy đủ và chuyên nghiệp nhất
        let display_name = if !market_name.is_empty() {
            let brand_clean = brand.trim();
            let mut title = market_name.clone();
            if !brand_clean.is_empty() && !market_name.to_lowercase().contains(&brand_clean.to_lowercase()) {
                title = format!("{} {}", brand_clean, market_name);
            }
            if !model.is_empty() && !market_name.contains(&model) {
                format!("{} ({})", title, model)
            } else {
                title
            }
        } else if !brand.is_empty() && !model.is_empty() {
            format!("{} {}", brand, model)
        } else if !model.is_empty() {
            model.clone()
        } else {
            format!("Thiết bị Android ({})", serial)
        };

        devices.push(AdbDeviceInfo {
            serial,
            state,
            brand,
            model,
            market_name,
            display_name,
            battery_level,
            android_version: android_ver,
        });
    }

    Ok(devices)
}

#[tauri::command]
pub fn notify_phone_connected(serial: String, title: String, message: String) -> Result<bool, String> {
    let adb_bin = match find_adb_path() {
        Some(p) => p,
        None => return Err("Chưa tìm thấy adb.exe trên máy tính".to_string()),
    };

    let mut cmd = std::process::Command::new(&adb_bin);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    // Tránh lỗi ngắt từ khi gửi qua shell adb: bọc trong cặp nháy đơn và escape
    let safe_title = title.replace('\'', "'\\''");
    let safe_msg = message.replace('\'', "'\\''");
    let shell_cmd = format!(
        "cmd notification post -S bigtext -t '{}' 'AutoLunex' '{}'",
        safe_title, safe_msg
    );

    cmd.args(["-s", &serial, "shell", &shell_cmd]);

    let _ = cmd.output();
    Ok(true)
}

#[tauri::command]
pub fn launch_tiktok_app(serial: String) -> Result<bool, String> {
    let adb_bin = match find_adb_path() {
        Some(p) => p,
        None => return Err("Chưa tìm thấy adb.exe trên máy tính".to_string()),
    };

    // 1. Đánh thức màn hình thiết bị (nếu đang sleep/tắt)
    let mut cmd_wake = std::process::Command::new(&adb_bin);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd_wake.creation_flags(0x0800_0000);
    }
    cmd_wake.args(["-s", &serial, "shell", "input keyevent 224"]);
    let _ = cmd_wake.output();

    // 2. Mở ứng dụng TikTok VN theo package và activity yêu cầu:
    // com.ss.android.ugc.trill / com.ss.android.ugc.aweme.splash.SplashActivity
    let mut cmd_start = std::process::Command::new(&adb_bin);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd_start.creation_flags(0x0800_0000);
    }
    cmd_start.args([
        "-s",
        &serial,
        "shell",
        "am start -n com.ss.android.ugc.trill/com.ss.android.ugc.aweme.splash.SplashActivity",
    ]);

    if let Ok(output) = cmd_start.output() {
        let err_str = String::from_utf8_lossy(&output.stderr);
        let out_str = String::from_utf8_lossy(&output.stdout);

        // Nếu báo lỗi hoặc chưa mở được activity, thử bằng monkey launcher cho com.ss.android.ugc.trill
        if err_str.contains("Error")
            || out_str.contains("Error")
            || err_str.contains("does not exist")
            || out_str.contains("does not exist")
        {
            let mut cmd_fallback = std::process::Command::new(&adb_bin);
            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                cmd_fallback.creation_flags(0x0800_0000);
            }
            if let Ok(out_fb) = cmd_fallback
                .args([
                    "-s",
                    &serial,
                    "shell",
                    "monkey -p com.ss.android.ugc.trill -c android.intent.category.LAUNCHER 1",
                ])
                .output()
            {
                let fb_err = String::from_utf8_lossy(&out_fb.stderr);
                let fb_out = String::from_utf8_lossy(&out_fb.stdout);
                // Nếu máy dùng bản quốc tế com.zhiliaoapp.musically
                if fb_err.contains("No activities found") || fb_out.contains("No activities found") {
                    let mut cmd_intl = std::process::Command::new(&adb_bin);
                    #[cfg(windows)]
                    {
                        use std::os::windows::process::CommandExt;
                        cmd_intl.creation_flags(0x0800_0000);
                    }
                    let _ = cmd_intl
                        .args([
                            "-s",
                            &serial,
                            "shell",
                            "monkey -p com.zhiliaoapp.musically -c android.intent.category.LAUNCHER 1",
                        ])
                        .output();
                }
            }
        }
    }

    Ok(true)
}

