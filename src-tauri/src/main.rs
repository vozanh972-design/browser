// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  // Read user-chosen storage root from the config file placed next to the
  // executable. This must happen before `donutbrowser_lib::run()` so that
  // `app_dirs` picks it up the very first time any path is resolved.
  if let Ok(exe) = std::env::current_exe() {
    if let Some(dir) = exe.parent() {
      let config = dir.join("storage_root.txt");
      if let Ok(path) = std::fs::read_to_string(&config) {
        let trimmed = path.trim();
        if !trimmed.is_empty() {
          unsafe {
            std::env::set_var("DONUTBROWSER_DATA_ROOT", trimmed);
          }
        }
      }
    }
  }

  donutbrowser_lib::run()
}
