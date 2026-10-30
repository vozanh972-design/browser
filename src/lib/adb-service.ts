import { invoke } from "@tauri-apps/api/core";

export interface AdbStatus {
  installed: boolean;
  adb_path: string | null;
  version: string | null;
  error: string | null;
}

export interface AdbDeviceInfo {
  serial: string;
  state: "device" | "unauthorized" | "offline" | string;
  brand: string;
  model: string;
  market_name: string;
  display_name: string;
  battery_level: number | null;
  android_version: string;
}

/**
 * Kiểm tra xem máy tính đã cài đặt/sẵn sàng ADB hay chưa
 */
export async function checkAdbStatus(): Promise<AdbStatus> {
  try {
    return await invoke<AdbStatus>("check_adb_status");
  } catch (err: unknown) {
    return {
      installed: false,
      adb_path: null,
      version: null,
      error:
        err instanceof Error
          ? err.message
          : "Không thể gọi hệ thống ADB từ ứng dụng",
    };
  }
}

/**
 * Lấy danh sách các thiết bị Android đang cắm qua USB
 */
export async function getAdbDevices(): Promise<AdbDeviceInfo[]> {
  try {
    return await invoke<AdbDeviceInfo[]>("get_adb_devices");
  } catch {
    return [];
  }
}

/**
 * Bắn thông báo hệ thống lên điện thoại (không cần cài APK vào máy)
 */
export async function notifyPhoneConnected(
  serial: string,
  title = "AutoLunex",
  message = "Đã kết nối thành công với phần mềm AutoLunex trên máy tính!",
): Promise<boolean> {
  try {
    return await invoke<boolean>("notify_phone_connected", {
      serial,
      title,
      message,
    });
  } catch {
    return false;
  }
}

export interface LaunchTiktokResult {
  success: boolean;
  notInstalled?: boolean;
  error?: string;
}

/**
 * Điều khiển thiết bị Android mở ứng dụng TikTok VN
 * Package: com.ss.android.ugc.trill
 * Activity: com.ss.android.ugc.aweme.splash.SplashActivity
 */
export async function launchTiktokApp(
  serial: string,
): Promise<LaunchTiktokResult> {
  try {
    await invoke<boolean>("launch_tiktok_app", { serial });
    return { success: true };
  } catch (err: unknown) {
    const msg =
      typeof err === "string"
        ? err
        : err instanceof Error
          ? err.message
          : String(err);
    if (msg.includes("NOT_INSTALLED")) {
      return { success: false, notInstalled: true, error: "NOT_INSTALLED" };
    }
    return { success: false, error: msg };
  }
}

/**
 * Tự động đọc username TikTok đang mở trên màn hình thiết bị
 */
export async function detectTiktokUsername(
  serial: string,
): Promise<string | null> {
  try {
    return await invoke<string | null>("detect_tiktok_username", { serial });
  } catch {
    return null;
  }
}

export interface DeviceWatcherHandlers {
  onDeviceConnected?: (device: AdbDeviceInfo) => void;
  onDeviceDisconnected?: (serial: string) => void;
  onDeviceUnauthorized?: (device: AdbDeviceInfo) => void;
  onAdbMissing?: (errorMsg: string) => void;
}

/**
 * Khởi động tiến trình theo dõi thiết bị cắm/rút USB thời gian thực
 */
export function startAdbDeviceWatcher(handlers: DeviceWatcherHandlers): () => void {
  let isRunning = true;
  let hasNotifiedAdbMissing = false;
  const knownDevices = new Map<string, string>(); // serial -> state
  const notifiedSerials = new Set<string>();

  const checkLoop = async () => {
    if (!isRunning) return;

    try {
      const status = await checkAdbStatus();
      if (!status.installed) {
        if (!hasNotifiedAdbMissing) {
          hasNotifiedAdbMissing = true;
          handlers.onAdbMissing?.(
            status.error ||
              "Chưa cài đặt Android Debug Bridge (ADB) trên máy tính",
          );
        }
        return;
      }

      hasNotifiedAdbMissing = false;
      const devices = await getAdbDevices();
      const currentSerials = new Set(devices.map((d) => d.serial));

      // Kiểm tra thiết bị bị rút cáp
      for (const [serial] of knownDevices.entries()) {
        if (!currentSerials.has(serial)) {
          knownDevices.delete(serial);
          notifiedSerials.delete(serial);
          handlers.onDeviceDisconnected?.(serial);
        }
      }

      // Kiểm tra thiết bị mới cắm vào hoặc thay đổi trạng thái
      for (const device of devices) {
        const prevState = knownDevices.get(device.serial);

        if (device.state === "device") {
          if (!prevState || prevState !== "device") {
            knownDevices.set(device.serial, "device");
            if (!notifiedSerials.has(device.serial)) {
              notifiedSerials.add(device.serial);
              handlers.onDeviceConnected?.(device);
              // Bắn thông báo lên điện thoại không cần cài app
              void notifyPhoneConnected(device.serial);
            }
          }
        } else if (device.state === "unauthorized") {
          if (!prevState || prevState !== "unauthorized") {
            knownDevices.set(device.serial, "unauthorized");
            handlers.onDeviceUnauthorized?.(device);
          }
        } else {
          knownDevices.set(device.serial, device.state);
        }
      }
    } catch {
      // ignore loop error
    } finally {
      if (isRunning) {
        setTimeout(checkLoop, 1800);
      }
    }
  };

  // Khởi chạy vòng lặp
  void checkLoop();

  return () => {
    isRunning = false;
  };
}
