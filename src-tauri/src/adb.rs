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

    // 1. Kiểm tra xem điện thoại đã cài đặt đúng ứng dụng TikTok VN (com.ss.android.ugc.trill) hay chưa
    let mut cmd_check = std::process::Command::new(&adb_bin);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd_check.creation_flags(0x0800_0000);
    }
    cmd_check.args(["-s", &serial, "shell", "pm path com.ss.android.ugc.trill"]);
    if let Ok(out) = cmd_check.output() {
        let text = String::from_utf8_lossy(&out.stdout);
        if !text.contains("package:") {
            return Err("NOT_INSTALLED".to_string());
        }
    } else {
        return Err("NOT_INSTALLED".to_string());
    }

    // 2. Đánh thức màn hình thiết bị (nếu đang sleep/tắt)
    let mut cmd_wake = std::process::Command::new(&adb_bin);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd_wake.creation_flags(0x0800_0000);
    }
    cmd_wake.args(["-s", &serial, "shell", "input keyevent 224"]);
    let _ = cmd_wake.output();

    // 3. Mở ứng dụng TikTok VN theo package và activity yêu cầu:
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

        // Nếu SplashActivity bị hạn chế quyền gọi trực tiếp, thử mở bằng launcher của chính com.ss.android.ugc.trill
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
            let _ = cmd_fallback
                .args([
                    "-s",
                    &serial,
                    "shell",
                    "monkey -p com.ss.android.ugc.trill -c android.intent.category.LAUNCHER 1",
                ])
                .output();
        }
    }

    Ok(true)
}

fn parse_bounds(s: &str) -> Option<(i32, i32, i32, i32)> {
    let parts: Vec<&str> = s.split("][").collect();
    if parts.len() != 2 {
        return None;
    }
    let left = parts[0].trim_start_matches('[');
    let right = parts[1].trim_end_matches(']');
    let (x1_s, y1_s) = left.split_once(',')?;
    let (x2_s, y2_s) = right.split_once(',')?;
    let x1 = x1_s.parse().ok()?;
    let y1 = y1_s.parse().ok()?;
    let x2 = x2_s.parse().ok()?;
    let y2 = y2_s.parse().ok()?;
    Some((x1, y1, x2, y2))
}

#[tauri::command]
pub fn click_tiktok_profile_tab(serial: String) -> Result<bool, String> {
    let adb_bin = match find_adb_path() {
        Some(p) => p,
        None => return Err("Chưa tìm thấy adb.exe trên máy tính".to_string()),
    };

    let run_adb = |args: &[&str]| -> std::io::Result<std::process::Output> {
        let mut cmd = std::process::Command::new(&adb_bin);
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x0800_0000);
        }
        cmd.arg("-s").arg(&serial).args(args).output()
    };

    // 1. Lấy độ phân giải màn hình thực tế của thiết bị
    let mut screen_w = 1080;
    let mut screen_h = 2400;
    if let Ok(out) = run_adb(&["shell", "wm size"]) {
        let text = String::from_utf8_lossy(&out.stdout);
        for line in text.lines() {
            if let Some((_, size_part)) = line.split_once(':') {
                let size_part = size_part.trim();
                if let Some((w_s, h_s)) = size_part.split_once('x') {
                    if let (Ok(w), Ok(h)) = (w_s.trim().parse::<i32>(), h_s.trim().parse::<i32>()) {
                        screen_w = w;
                        screen_h = h;
                    }
                }
            }
        }
    }

    // 2. Chờ ban đầu 2.5s để máy yếu kịp nạp bộ nhớ và vào giao diện chính
    std::thread::sleep(std::time::Duration::from_millis(2500));

    // Bộ lọc giới hạn vị trí nút Hồ sơ:
    // Nút Hồ sơ ở thanh điều hướng dưới cùng: Y >= 78% chiều cao màn hình, X >= 55% chiều rộng màn hình.
    // Avatar tròn của video ở cạnh phải nằm ở khoảng Y = 35% - 65% -> BỊ LOẠI BỎ 100%, KHÔNG BAO GIỜ BẤM NHẦM!
    let min_y = (screen_h as f64 * 0.78) as i32;
    let min_x = (screen_w as f64 * 0.55) as i32;

    // Vòng lặp chờ giao diện ổn định (thử tối đa 6 lần, mỗi lần cách nhau 2.5s = tối đa ~15s cho máy yếu/mạng chậm)
    for _attempt in 1..=6 {
        let dump_res = run_adb(&["shell", "uiautomator dump /sdcard/autolunex_ui.xml && cat /sdcard/autolunex_ui.xml"]);
        if let Ok(out) = dump_res {
            let xml = String::from_utf8_lossy(&out.stdout);

            let mut target_tap: Option<(i32, i32)> = None;

            for part in xml.split("<node ") {
                if part.is_empty() {
                    continue;
                }

                let is_profile_node = part.contains("text=\"Hồ sơ\"")
                    || part.contains("content-desc=\"Hồ sơ\"")
                    || part.contains("text=\"Profile\"")
                    || part.contains("content-desc=\"Profile\"")
                    || part.contains("text=\"Tôi\"")
                    || part.contains("content-desc=\"Tôi\"");

                if is_profile_node {
                    if let Some(bounds_idx) = part.find("bounds=\"[") {
                        let rest = &part[bounds_idx + 8..];
                        if let Some(end_quote) = rest.find('"') {
                            let bounds_str = &rest[..end_quote];
                            if let Some((x1, y1, x2, y2)) = parse_bounds(bounds_str) {
                                // Kiểm tra chặt chẽ: Nằm ở thanh đáy dưới cùng bên phải
                                if y1 >= min_y && x1 >= min_x {
                                    let cx = (x1 + x2) / 2;
                                    let cy = (y1 + y2) / 2;
                                    target_tap = Some((cx, cy));
                                    break;
                                }
                            }
                        }
                    }
                }
            }

            // Nếu tìm thấy nút Hồ sơ -> Thực hiện click và DỪNG NGAY
            if let Some((tap_x, tap_y)) = target_tap {
                let tap_cmd = format!("input tap {} {}", tap_x, tap_y);
                let _ = run_adb(&["shell", &tap_cmd]);
                return Ok(true);
            }
        }

        // Nghỉ 2.5s để máy yếu kịp render xong giao diện
        std::thread::sleep(std::time::Duration::from_millis(2500));
    }

    // Nếu sau 6 lần quét text không có (do TikTok phiên bản mới không set accessibility text),
    // Fallback: Tìm nút có clickable="true" ở góc đáy cực phải (Y >= 88%, X >= 75%)
    let fallback_min_y = (screen_h as f64 * 0.88) as i32;
    let fallback_min_x = (screen_w as f64 * 0.75) as i32;

    let dump_res = run_adb(&["shell", "uiautomator dump /sdcard/autolunex_ui.xml && cat /sdcard/autolunex_ui.xml"]);
    if let Ok(out) = dump_res {
        let xml = String::from_utf8_lossy(&out.stdout);
        for part in xml.split("<node ") {
            if part.contains("clickable=\"true\"") {
                if let Some(bounds_idx) = part.find("bounds=\"[") {
                    let rest = &part[bounds_idx + 8..];
                    if let Some(end_quote) = rest.find('"') {
                        let bounds_str = &rest[..end_quote];
                        if let Some((x1, y1, x2, y2)) = parse_bounds(bounds_str) {
                            if y1 >= fallback_min_y && x1 >= fallback_min_x && x2 <= screen_w && y2 <= screen_h {
                                let cx = (x1 + x2) / 2;
                                let cy = (y1 + y2) / 2;
                                let tap_cmd = format!("input tap {} {}", cx, cy);
                                let _ = run_adb(&["shell", &tap_cmd]);
                                return Ok(true);
                            }
                        }
                    }
                }
            }
        }
    }

    // Không tìm thấy sau tất cả các bước thử
    Err("Không tìm thấy nút Hồ sơ ở thanh điều hướng dưới cùng".to_string())
}

#[tauri::command]
pub fn detect_tiktok_username(serial: String) -> Result<Option<String>, String> {
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
    cmd.args([
        "-s",
        &serial,
        "shell",
        "uiautomator dump /sdcard/autolunex_ui.xml && cat /sdcard/autolunex_ui.xml",
    ]);

    if let Ok(output) = cmd.output() {
        let text = String::from_utf8_lossy(&output.stdout);
        for part in text.split("text=\"") {
            if let Some((val, _)) = part.split_once('"') {
                let trimmed = val.trim();
                if trimmed.starts_with('@') && trimmed.len() >= 3 && trimmed.len() <= 32 {
                    return Ok(Some(trimmed.to_string()));
                }
            }
        }
    }

    Ok(None)
}


