// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use serde::Serialize;
use tauri::AppHandle;

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
  #[cfg(windows)]
  let mut cmd = std::process::Command::new("curl.exe");

  #[cfg(not(windows))]
  let mut cmd = std::process::Command::new("curl");

  cmd
    .arg("-s")
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

  let output = cmd.output().map_err(|e| format!("Lỗi thực thi curl: {}", e))?;

  let stdout = String::from_utf8_lossy(&output.stdout);
  if !output.status.success() && stdout.trim().is_empty() {
    let err = String::from_utf8_lossy(&output.stderr);
    return Err(format!("Lỗi kết nối máy chủ XSMM: {}", err));
  }

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
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
