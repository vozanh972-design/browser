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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_clipboard_manager::init())
    .plugin(tauri_plugin_window_state::Builder::new().build())
    .invoke_handler(tauri::generate_handler![get_system_info, confirm_quit,])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
