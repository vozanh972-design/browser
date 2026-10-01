import { invoke } from "@tauri-apps/api/core";

export interface MigrateResult {
  success: boolean;
  target_path: string;
  exe_copied: boolean;
  message: string;
}

/**
 * Lấy danh sách các ổ đĩa có sẵn trên máy tính (ví dụ: ["C:", "D:", "E:"])
 */
export async function getAvailableDrives(): Promise<string[]> {
  try {
    const drives = await invoke<string[]>("get_available_drives");
    if (Array.isArray(drives) && drives.length > 0) {
      return drives;
    }
  } catch {
    // Dự phòng môi trường dev / web preview
  }
  return ["C:", "D:"];
}

/**
 * Lấy ổ đĩa đang được dùng để lưu trữ dữ liệu AutoLunex
 */
export async function getCurrentStorageDrive(): Promise<string> {
  try {
    const drive = await invoke<string>("get_current_storage_drive");
    if (drive) return drive;
  } catch {
    // ignore
  }
  if (typeof window !== "undefined") {
    return localStorage.getItem("app_storage_drive") || "C:";
  }
  return "C:";
}

/**
 * Thu thập toàn bộ dữ liệu ứng dụng hiện tại và chuyển sang ổ đĩa được chỉ định (vd: "D:")
 * Đảm bảo toàn bộ tài khoản, cookie, proxy, phiên làm việc được lưu trên ổ đích,
 * tuyệt đối không ghi đè hay lưu vào ổ C.
 */
export async function migrateAppToDrive(
  targetDrive: string,
): Promise<MigrateResult> {
  const driveClean = targetDrive.trim().toUpperCase().replace(/[\\/]/g, "");

  // Thu thập toàn bộ dữ liệu từ localStorage
  const snapshot: Record<string, string> = {};
  if (typeof window !== "undefined") {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        snapshot[key] = localStorage.getItem(key) || "";
      }
    }
  }

  const payload = {
    migrated_at: new Date().toISOString(),
    target_drive: driveClean,
    storage_folder: `${driveClean}\\AutoLunex`,
    data: snapshot,
  };

  try {
    const result = await invoke<MigrateResult>("migrate_app_to_drive", {
      targetDrive: driveClean,
      dataJson: JSON.stringify(payload, null, 2),
    });

    if (typeof window !== "undefined") {
      localStorage.setItem("app_storage_drive", driveClean);
      localStorage.setItem(
        "app_storage_path",
        result.target_path || `${driveClean}\\AutoLunex`,
      );
    }

    return result;
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : "Không thể chuyển ổ đĩa lưu trữ.";
    return {
      success: false,
      target_path: `${driveClean}\\AutoLunex`,
      exe_copied: false,
      message,
    };
  }
}

/**
 * Mở thư mục AutoLunex trên ổ đĩa lưu trữ bằng File Explorer
 */
export async function openStorageFolder(targetDrive: string): Promise<boolean> {
  const driveClean = targetDrive.trim().toUpperCase().replace(/[\\/]/g, "");
  const folderPath = `${driveClean}\\AutoLunex`;
  try {
    return await invoke<boolean>("open_storage_folder", { path: folderPath });
  } catch {
    return false;
  }
}
