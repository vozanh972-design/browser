const DEVICE_ID_STORAGE_KEY = "donut-device-id";
const LICENSE_KEY_STORAGE_KEY = "donut-license-key";
const LICENSE_VALID_STORAGE_KEY = "donut-license-valid";

const CHECK_KEY_URL = "https://lunex.io.vn/api/check_key.php";

/**
 * A stable per-install identifier, generated once and reused for every key
 * check. This is what the backend locks a key to (`device_id` column in
 * `home_product_keys`) — it never needs to match real hardware, only stay
 * the same across app launches on this machine.
 */
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing) return existing;
    const generated = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
    return generated;
  } catch {
    // localStorage unavailable (rare) — fall back to a per-session id so the
    // check can still run, just without persistence across restarts.
    return `session-${Math.random().toString(36).slice(2)}`;
  }
}

export type CheckKeyStatus =
  | "valid"
  | "ok"
  | "invalid"
  | "expired"
  | "revoked"
  | "device_mismatch"
  | "error";

export interface CheckKeyResult {
  status: CheckKeyStatus;
  msg?: string;
  product?: string;
  package?: string;
  key_status?: string;
  activated_at?: string | null;
  expired_at?: string | null;
  device_locked?: boolean;
}

/** Calls the shared Lunex key-check endpoint and activates the key on this device. */
export async function checkLicenseKey(key: string): Promise<CheckKeyResult> {
  const deviceId = getDeviceId();
  const url = `${CHECK_KEY_URL}?key=${encodeURIComponent(key)}&device_id=${encodeURIComponent(deviceId)}`;

  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      return { status: "error", msg: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as CheckKeyResult;
    if (!data || typeof data.status !== "string") {
      return { status: "error", msg: "Unexpected response" };
    }
    return data;
  } catch (error) {
    return {
      status: "error",
      msg: error instanceof Error ? error.message : "Network error",
    };
  }
}

/** Reads any previously stored license key so the gate can be skipped. */
export function getStoredLicenseKey(): string | null {
  try {
    return localStorage.getItem(LICENSE_KEY_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeLicenseKey(key: string): void {
  try {
    localStorage.setItem(LICENSE_KEY_STORAGE_KEY, key);
  } catch {
    // Non-fatal: the app still works for this session even if it can't
    // persist, the person just re-enters the key next launch.
  }
}

/** Whether the last key check succeeded — this is what gates Pro features locally. */
export function isLicenseValidLocally(): boolean {
  try {
    return localStorage.getItem(LICENSE_VALID_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function setLicenseValidLocally(valid: boolean): void {
  try {
    if (valid) {
      localStorage.setItem(LICENSE_VALID_STORAGE_KEY, "true");
    } else {
      localStorage.removeItem(LICENSE_VALID_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

/** Persists a successful check: remembers the key and flips the local Pro flag. */
export function markLicenseValid(key: string): void {
  storeLicenseKey(key);
  setLicenseValidLocally(true);
}

export function clearStoredLicense(): void {
  try {
    localStorage.removeItem(LICENSE_KEY_STORAGE_KEY);
  } catch {
    // ignore
  }
  setLicenseValidLocally(false);
}
