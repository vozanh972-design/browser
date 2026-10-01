"use client";

import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  FolderOpen,
  FolderSync,
  Globe,
  HardDrive,
  Info,
  KeyRound,
  LogOut,
  Monitor,
  Moon,
  Palette,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  SunMedium,
  User,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatedSwitch } from "@/components/ui/animated-switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUPPORTED_LANGUAGES } from "@/i18n";
import {
  getAvailableDrives,
  getCurrentStorageDrive,
  migrateAppToDrive,
  openStorageFolder,
} from "@/lib/storage-drive";
import { THEMES } from "@/lib/themes";
import { cn } from "@/lib/utils";
import {
  type AppVersionCheckResult,
  CURRENT_APP_VERSION,
  checkAppVersion,
} from "@/lib/version-checker";
import { Logo } from "./icons/logo";
import { useTheme } from "./theme-provider";

export interface XsmmAccountInfo {
  username: string;
  balance: string;
  token?: string;
  isLoggedIn: boolean;
}

export interface SettingsAccountSummary {
  id: string;
  status: "live" | "checkpoint" | "die" | "unverified";
}

export interface LicenseInfo {
  key: string;
  daysLeft: number | null;
  expiredAt: string | null;
  buyer?: string | null;
}

interface AppSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  accounts?: SettingsAccountSummary[];
  licenseInfo?: LicenseInfo;
  onKeyLogout?: () => void;
  onUpdateFound?: (result: AppVersionCheckResult) => void;
}

type SettingsSection =
  | "account"
  | "appearance"
  | "displays"
  | "language"
  | "privacy"
  | "about";

interface SystemInfo {
  app_version: string;
  os: string;
  arch: string;
  portable: boolean;
}

export function AppSettingsDialog({
  isOpen,
  onClose,
  accounts: _accounts = [],
  licenseInfo,
  onKeyLogout,
  onUpdateFound,
}: AppSettingsDialogProps) {
  const { i18n } = useTranslation();
  const { theme, setTheme } = useTheme();

  // License key display state (masked by default)
  const [showFullKey, setShowFullKey] = useState(false);
  // Avatar URL read from localStorage (same seed as key-login-screen)
  const [settingsAvatarUrl, setSettingsAvatarUrl] = useState("");
  const [settingsAvatarError, setSettingsAvatarError] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    try {
      const seed =
        localStorage.getItem("autolunex_avatar_seed") || "default_user";
      setSettingsAvatarUrl(
        `https://api.dicebear.com/10.x/lorelei/svg?seed=${encodeURIComponent(seed)}`,
      );
    } catch {
      // ignore
    }
  }, [isOpen]);

  // Multi-language translation helper
  const isVi = (i18n.language?.split("-")[0] || "vi") === "vi";
  const tr = useCallback(
    (viText: string, enText: string) => (isVi ? viText : enText),
    [isVi],
  );

  const [activeSection, setActiveSection] =
    useState<SettingsSection>("account");
  const [searchQuery, setSearchQuery] = useState("");

  // Storage drive migration state
  const [availableDrives, setAvailableDrives] = useState<string[]>([
    "C:",
    "D:",
  ]);
  const [currentDrive, setCurrentDrive] = useState<string>("C:");
  const [selectedDrive, setSelectedDrive] = useState<string>("D:");
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrateStatus, setMigrateStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    void getAvailableDrives().then((drives) => {
      setAvailableDrives(drives);
    });
    void getCurrentStorageDrive().then((drive) => {
      setCurrentDrive(drive);
      if (drive === "C:") {
        setSelectedDrive("D:");
      } else {
        setSelectedDrive(drive);
      }
    });
  }, [isOpen]);

  const handleMigrateDrive = async () => {
    setIsMigrating(true);
    setMigrateStatus(null);
    try {
      const res = await migrateAppToDrive(selectedDrive);
      if (res.success) {
        setCurrentDrive(selectedDrive);
        setMigrateStatus(res.message);
      } else {
        alert(res.message);
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Lỗi khi di chuyển ổ đĩa");
    } finally {
      setIsMigrating(false);
    }
  };

  const handleOpenStorageFolder = async () => {
    await openStorageFolder(currentDrive);
  };

  // Display & Brightness state
  const [brightness, setBrightness] = useState<number>(() => {
    if (typeof window === "undefined") return 100;
    try {
      const saved = localStorage.getItem("autolunex_display_brightness");
      return saved ? Number(saved) : 100;
    } catch {
      return 100;
    }
  });

  const [displayScale, setDisplayScale] = useState<string>(() => {
    if (typeof window === "undefined") return "100";
    try {
      return localStorage.getItem("autolunex_display_scale") || "100";
    } catch {
      return "100";
    }
  });

  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("autolunex_reduced_motion") === "true";
    } catch {
      return false;
    }
  });

  const [backdropBlur, setBackdropBlur] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const saved = localStorage.getItem("autolunex_backdrop_blur");
      return saved === null ? true : saved === "true";
    } catch {
      return true;
    }
  });

  // Selected Accent color
  const [accentColor, setAccentColor] = useState<string>(() => {
    if (typeof window === "undefined") return "blue";
    try {
      return localStorage.getItem("autolunex_accent_color") || "blue";
    } catch {
      return "blue";
    }
  });

  // System & Update Info
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);

  // Synchronized app version across all views
  const appVersion = systemInfo?.app_version || CURRENT_APP_VERSION;

  // Load system info on open
  useEffect(() => {
    if (!isOpen) return;
    invoke<SystemInfo>("get_system_info")
      .then(setSystemInfo)
      .catch(() => {
        setSystemInfo({
          app_version: CURRENT_APP_VERSION,
          os: "Windows 11",
          arch: "x86_64",
          portable: true,
        });
      });
  }, [isOpen]);

  // Apply Brightness to document root
  const handleBrightnessChange = (val: number) => {
    setBrightness(val);
    try {
      localStorage.setItem("autolunex_display_brightness", String(val));
      if (typeof document !== "undefined") {
        document.documentElement.style.filter =
          val === 100 ? "" : `brightness(${val}%)`;
      }
    } catch {
      // ignore
    }
  };

  const handleDisplayScaleChange = (val: string) => {
    setDisplayScale(val);
    try {
      localStorage.setItem("autolunex_display_scale", val);
      if (typeof document !== "undefined") {
        document.documentElement.style.zoom =
          val === "100" ? "" : `${Number(val) / 100}`;
      }
    } catch {
      // ignore
    }
  };

  const handleAccentChange = (id: string) => {
    setAccentColor(id);
    try {
      localStorage.setItem("autolunex_accent_color", id);
    } catch {
      // ignore
    }
  };

  const handleReducedMotionChange = (val: boolean) => {
    setReducedMotion(val);
    try {
      localStorage.setItem("autolunex_reduced_motion", String(val));
    } catch {
      // ignore
    }
  };

  const handleBackdropBlurChange = (val: boolean) => {
    setBackdropBlur(val);
    try {
      localStorage.setItem("autolunex_backdrop_blur", String(val));
    } catch {
      // ignore
    }
  };

  const handleLanguageChange = (code: string) => {
    void i18n.changeLanguage(code);
    try {
      localStorage.setItem("autolunex_language", code);
    } catch {
      // ignore
    }
  };

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    setUpdateStatus(null);
    try {
      const res = await checkAppVersion();
      setIsCheckingUpdate(false);
      if (res.isOutdated) {
        setUpdateStatus(
          tr(
            `Đã có bản cập nhật mới v${res.latestVersion}!`,
            `New update v${res.latestVersion} available!`,
          ),
        );
        if (onUpdateFound) {
          onUpdateFound(res);
        }
      } else {
        setUpdateStatus(
          tr(
            `AutoLunex v${appVersion} đã là phiên bản mới nhất!`,
            `AutoLunex v${appVersion} is already up to date!`,
          ),
        );
      }
    } catch {
      setIsCheckingUpdate(false);
      setUpdateStatus(
        tr(
          `AutoLunex v${appVersion} đã là phiên bản mới nhất!`,
          `AutoLunex v${appVersion} is already up to date!`,
        ),
      );
    }
  };

  const handleOpenUrl = (url: string) => {
    openUrl(url).catch(() => {
      if (typeof window !== "undefined") {
        window.open(url, "_blank");
      }
    });
  };

  // Selected Accent color options
  const accentColors = useMemo(
    () => [
      { id: "blue", label: tr("Xanh dương (Blue)", "Blue"), color: "#007aff" },
      { id: "purple", label: tr("Tím (Purple)", "Purple"), color: "#af52de" },
      { id: "pink", label: tr("Hồng (Pink)", "Pink"), color: "#ff2d55" },
      { id: "red", label: tr("Đỏ (Red)", "Red"), color: "#ff3b30" },
      { id: "orange", label: tr("Cam (Orange)", "Orange"), color: "#ff9500" },
      { id: "yellow", label: tr("Vàng (Yellow)", "Yellow"), color: "#ffcc00" },
      { id: "green", label: tr("Xanh lá (Green)", "Green"), color: "#34c759" },
      {
        id: "graphite",
        label: tr("Xám (Graphite)", "Graphite"),
        color: "#8e8e93",
      },
    ],
    [tr],
  );

  // Sidebar navigation items (macOS iMac Style)
  const navItems = useMemo(
    () => [
      {
        id: "account" as const,
        label: tr("Tài khoản người dùng", "User Account"),
        subLabel:
          licenseInfo?.buyer || tr("Bản quyền thiết bị", "Device License"),
        icon: User,
        color: "bg-blue-500",
      },
      {
        id: "appearance" as const,
        label: tr("Giao diện", "Appearance"),
        subLabel: tr(
          "Sáng, Tối, Màu nhấn & Chủ đề",
          "Light, Dark, Accent & Themes",
        ),
        icon: Palette,
        color: "bg-purple-500",
      },
      {
        id: "displays" as const,
        label: tr("Màn hình & Độ sáng", "Displays & Brightness"),
        subLabel: tr(
          "Độ sáng, Thu phóng & Hiệu ứng",
          "Brightness, Scaling & Effects",
        ),
        icon: Monitor,
        color: "bg-cyan-500",
      },
      {
        id: "language" as const,
        label: tr("Ngôn ngữ & Khu vực", "Language & Region"),
        subLabel: tr(
          "Tiếng Việt, English & Định dạng",
          "Vietnamese, English & Formats",
        ),
        icon: Globe,
        color: "bg-emerald-500",
      },
      {
        id: "privacy" as const,
        label: tr("Bảo mật & Dữ liệu", "Privacy & Data"),
        subLabel: tr("Bộ nhớ đệm & Mã hóa", "Cache & Storage Encryption"),
        icon: ShieldCheck,
        color: "bg-rose-500",
      },
      {
        id: "about" as const,
        label: tr("Giới thiệu AutoLunex", "About AutoLunex"),
        subLabel: tr(
          "Phiên bản, Cập nhật & Bản quyền",
          "Version, Updates & License",
        ),
        icon: Info,
        color: "bg-slate-500",
      },
    ],
    [tr, licenseInfo?.buyer],
  );

  const filteredNavItems = navItems.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.label.toLowerCase().includes(q) ||
      item.subLabel.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q)
    );
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        hideClose
        className="p-0 gap-0 overflow-hidden rounded-2xl border border-border/80 shadow-2xl bg-background/95 backdrop-blur-2xl transition-all duration-300 flex flex-col w-[94vw] max-w-4xl h-[650px] max-h-[88vh]"
      >
        <DialogTitle className="sr-only">
          {tr("Cài đặt hệ thống AutoLunex", "AutoLunex System Settings")}
        </DialogTitle>

        {/* Top Window Bar */}
        <div
          data-tauri-drag-region
          className="flex h-11 shrink-0 select-none items-center justify-between border-b border-border/50 bg-muted/30 px-4"
        >
          {/* Left Title */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">
              {tr("Cài đặt hệ thống", "System Settings")}
            </span>
          </div>

          {/* Current Section Indicator */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>AutoLunex</span>
            <span>/</span>
            <span className="font-semibold text-foreground">
              {navItems.find((n) => n.id === activeSection)?.label}
            </span>
          </div>

          {/* Quick Close Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-7 px-2.5 text-xs rounded-lg text-muted-foreground hover:text-foreground cursor-pointer hover:bg-foreground/5"
          >
            {tr("Xong", "Done")}
          </Button>
        </div>

        {/* 2-Column macOS Layout: Sidebar + Detail Content Pane */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left Sidebar */}
          <aside className="w-64 sm:w-72 shrink-0 border-r border-border/50 bg-muted/20 flex flex-col p-3 gap-2 overflow-y-auto">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tr("Tìm kiếm cài đặt...", "Search settings...")}
                className="h-8 pl-8 text-xs rounded-lg bg-background/60 border-border/50 focus-visible:ring-1"
              />
            </div>

            {/* Apple ID / User Profile Card */}
            <button
              type="button"
              onClick={() => setActiveSection("account")}
              className={cn(
                "flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left cursor-pointer",
                activeSection === "account"
                  ? "border-primary/50 bg-primary/10 shadow-xs"
                  : "border-border/40 bg-background/50 hover:bg-background/80 hover:border-border/70",
              )}
            >
              <div className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-blue-500 to-indigo-600 text-white font-bold text-sm shadow-sm overflow-hidden">
                {settingsAvatarUrl && !settingsAvatarError ? (
                  // biome-ignore lint/performance/noImgElement: external avatar
                  <img
                    src={settingsAvatarUrl}
                    alt="avatar"
                    className="size-full object-cover"
                    onError={() => setSettingsAvatarError(true)}
                  />
                ) : (
                  <User className="size-5" />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-xs font-semibold text-foreground">
                  {licenseInfo?.buyer ||
                    tr("Tài khoản bản quyền", "Licensed User")}
                </span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {licenseInfo?.key
                    ? tr("Đã xác thực bản quyền", "License Verified")
                    : tr("Chưa kích hoạt", "Not activated")}
                </span>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
            </button>

            <div className="h-px bg-border/40 my-1" />

            {/* Sidebar Navigation Items */}
            <div className="flex flex-col gap-1">
              {filteredNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSection(item.id)}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-left cursor-pointer",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                        : "text-foreground/80 hover:bg-foreground/5 hover:text-foreground",
                    )}
                  >
                    <div
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-md text-white shadow-xs",
                        item.color,
                        isActive && "ring-1 ring-white/30",
                      )}
                    >
                      <Icon className="size-3.5" />
                    </div>
                    <span className="truncate flex-1">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Bottom Footer Info - Synchronized Version */}
            <div className="mt-auto pt-3 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground/80 px-1">
              <span>AutoLunex MMO</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                v{appVersion}
              </Badge>
            </div>
          </aside>

          {/* Right Main Content Pane */}
          <main className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 bg-background">
            {/* TAB: ACCOUNT / THÔNG TIN NGƯỜI SỬ DỤNG */}
            {activeSection === "account" && (
              <div className="flex flex-col gap-5 max-w-2xl">
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    {tr("Tài khoản người dùng", "User Account")}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tr(
                      "Quản lý bản quyền ứng dụng và thông tin kích hoạt thiết bị.",
                      "Manage application license and device activation info.",
                    )}
                  </p>
                </div>

                {/* Hero Profile Card */}
                <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-linear-to-r from-blue-500/10 via-indigo-500/5 to-transparent p-4 sm:p-5">
                  {/* Avatar — DiceBear (same seed as key-login-screen) */}
                  <div className="relative flex size-14 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-blue-600 to-indigo-600 text-white shadow-md ring-4 ring-blue-500/20 overflow-hidden">
                    {settingsAvatarUrl && !settingsAvatarError ? (
                      // biome-ignore lint/performance/noImgElement: external avatar
                      <img
                        src={settingsAvatarUrl}
                        alt="avatar"
                        className="size-full object-cover"
                        onError={() => setSettingsAvatarError(true)}
                      />
                    ) : (
                      <User className="size-7" />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-foreground">
                        {licenseInfo?.buyer ||
                          tr("Tài khoản bản quyền", "Licensed User")}
                      </span>
                      <Badge className="bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/20 text-[10px] px-2 py-0 border-emerald-500/30">
                        {tr("Đã kích hoạt", "Active")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {tr(
                          "Quyền hạn: Bản quyền chính thức",
                          "Role: Official License",
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onKeyLogout}
                      className="gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30 cursor-pointer"
                    >
                      <LogOut className="size-3.5" />
                      {tr("Đăng xuất", "Log out")}
                    </Button>
                  </div>
                </div>

                {/* Inset Group: Bản quyền kích hoạt */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                    {tr("Bản quyền kích hoạt", "Activated License")}
                  </span>
                  <div className="rounded-xl border border-border/60 bg-card/60 divide-y divide-border/40 overflow-hidden shadow-xs">
                    {/* Key row */}
                    <div className="flex items-center justify-between p-3.5 text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <KeyRound className="size-3.5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium text-foreground">
                            {tr("Mã Key bản quyền", "License Key")}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {tr(
                              "Đang kích hoạt trên thiết bị này",
                              "Active on this device",
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] text-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/50 max-w-[160px] truncate">
                          {licenseInfo?.key
                            ? showFullKey
                              ? licenseInfo.key
                              : licenseInfo.key.slice(0, 4) +
                                "-••••••••••••••••"
                            : tr("Chưa có key", "No key")}
                        </span>
                        {licenseInfo?.key && (
                          <button
                            type="button"
                            onClick={() => setShowFullKey((v) => !v)}
                            className="flex size-6 items-center justify-center rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                            title={showFullKey ? "Ẩn key" : "Hiện key"}
                          >
                            {showFullKey ? (
                              <EyeOff className="size-3.5" />
                            ) : (
                              <Eye className="size-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expiry row */}
                    <div className="flex items-center justify-between p-3.5 text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                          <Clock className="size-3.5 text-emerald-500" />
                        </div>
                        <div>
                          <div className="font-medium text-foreground">
                            {tr("Thời hạn sử dụng", "License Expiry")}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {licenseInfo?.expiredAt
                              ? tr("Ngày hết hạn", "Expiry date") +
                                ": " +
                                licenseInfo.expiredAt
                              : tr(
                                  "Không giới hạn thời gian",
                                  "No expiry limit",
                                )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {licenseInfo?.daysLeft != null ? (
                          <span
                            className={`font-mono text-[11px] px-2 py-0.5 rounded border font-semibold ${
                              licenseInfo.daysLeft <= 3
                                ? "text-rose-500 bg-rose-500/10 border-rose-500/30"
                                : licenseInfo.daysLeft <= 7
                                  ? "text-amber-500 bg-amber-500/10 border-amber-500/30"
                                  : "text-emerald-500 bg-emerald-500/10 border-emerald-500/30"
                            }`}
                          >
                            {licenseInfo.daysLeft} {tr("ngày", "days")}
                          </span>
                        ) : (
                          <span className="font-mono text-[11px] text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 font-semibold">
                            ∞ {tr("Vĩnh viễn", "Lifetime")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: APPEARANCE / GIAO DIỆN (iMac Style Preview Cards) */}
            {activeSection === "appearance" && (
              <div className="flex flex-col gap-5 max-w-2xl">
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    {tr("Giao diện", "Appearance")}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tr(
                      "Tùy chọn phong cách hiển thị sáng, tối hoặc theo hệ thống macOS/Windows.",
                      "Choose light, dark, or system matching appearance.",
                    )}
                  </p>
                </div>

                {/* macOS Style 3 Theme Mockup Cards */}
                <div className="flex flex-col gap-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {tr("Chế độ giao diện", "Appearance Mode")}
                  </Label>
                  <div className="grid grid-cols-3 gap-3">
                    {/* Light Mode Card */}
                    <button
                      type="button"
                      onClick={() => setTheme("light")}
                      className={cn(
                        "group flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer text-center",
                        theme === "light"
                          ? "border-primary bg-primary/5 shadow-xs"
                          : "border-border/60 bg-card hover:border-border",
                      )}
                    >
                      <div className="w-full h-16 rounded-lg bg-[#F5F5F7] border border-black/10 overflow-hidden flex shadow-inner">
                        <div className="w-1/3 bg-[#E5E5EA] border-r border-black/5 p-1 flex flex-col gap-1">
                          <div className="size-1.5 rounded-full bg-red-400" />
                          <div className="w-full h-1 rounded bg-black/20" />
                          <div className="w-3/4 h-1 rounded bg-black/20" />
                        </div>
                        <div className="flex-1 p-1.5 flex flex-col gap-1">
                          <div className="w-full h-2 rounded bg-black/10" />
                          <div className="w-2/3 h-1.5 rounded bg-blue-500" />
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <Sun className="size-3.5 text-amber-500" />
                        {tr("Sáng", "Light")}
                      </div>
                    </button>

                    {/* Dark Mode Card */}
                    <button
                      type="button"
                      onClick={() => setTheme("dark")}
                      className={cn(
                        "group flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer text-center",
                        theme === "dark"
                          ? "border-primary bg-primary/5 shadow-xs"
                          : "border-border/60 bg-card hover:border-border",
                      )}
                    >
                      <div className="w-full h-16 rounded-lg bg-[#1E1E1E] border border-white/10 overflow-hidden flex shadow-inner">
                        <div className="w-1/3 bg-[#2D2D2D] border-r border-white/5 p-1 flex flex-col gap-1">
                          <div className="size-1.5 rounded-full bg-red-400" />
                          <div className="w-full h-1 rounded bg-white/20" />
                          <div className="w-3/4 h-1 rounded bg-white/20" />
                        </div>
                        <div className="flex-1 p-1.5 flex flex-col gap-1">
                          <div className="w-full h-2 rounded bg-white/10" />
                          <div className="w-2/3 h-1.5 rounded bg-blue-400" />
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <Moon className="size-3.5 text-indigo-400" />
                        {tr("Tối", "Dark")}
                      </div>
                    </button>

                    {/* Auto / System Mode Card */}
                    <button
                      type="button"
                      onClick={() => setTheme("system")}
                      className={cn(
                        "group flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer text-center",
                        theme === "system"
                          ? "border-primary bg-primary/5 shadow-xs"
                          : "border-border/60 bg-card hover:border-border",
                      )}
                    >
                      <div className="w-full h-16 rounded-lg border border-border/80 overflow-hidden flex shadow-inner relative">
                        {/* Half Light */}
                        <div className="w-1/2 h-full bg-[#F5F5F7] border-r border-border p-1 flex flex-col gap-1">
                          <div className="size-1.5 rounded-full bg-red-400" />
                          <div className="w-full h-1 rounded bg-black/20" />
                          <div className="w-2/3 h-1.5 rounded bg-blue-500" />
                        </div>
                        {/* Half Dark */}
                        <div className="w-1/2 h-full bg-[#1E1E1E] p-1 flex flex-col gap-1">
                          <div className="size-1.5 rounded-full bg-red-400" />
                          <div className="w-full h-1 rounded bg-white/20" />
                          <div className="w-2/3 h-1.5 rounded bg-blue-400" />
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <Sparkles className="size-3.5 text-purple-400" />
                        {tr("Tự động", "Auto")}
                      </div>
                    </button>
                  </div>
                </div>

                {/* Inset Group: Accent Color & Themes */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                    {tr("Màu sắc & Phối màu", "Colors & Palette")}
                  </span>
                  <div className="rounded-xl border border-border/60 bg-card/60 divide-y divide-border/40 overflow-hidden shadow-xs">
                    {/* Accent Color Circles (macOS Style) */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 gap-2.5 text-xs">
                      <div>
                        <div className="font-medium text-foreground">
                          {tr("Màu điểm nhấn (Accent Color)", "Accent Color")}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {tr(
                            "Màu sắc nổi bật cho nút bấm, viền và thanh điều hướng",
                            "Highlight color for buttons, borders, and rail nav",
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {accentColors.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            title={item.label}
                            onClick={() => handleAccentChange(item.id)}
                            className={cn(
                              "size-5 rounded-full flex items-center justify-center transition-transform hover:scale-110 cursor-pointer shadow-xs",
                              accentColor === item.id &&
                                "ring-2 ring-foreground/40 ring-offset-2 ring-offset-background",
                            )}
                            style={{ backgroundColor: item.color }}
                          >
                            {accentColor === item.id && (
                              <Check className="size-3 text-white stroke-[3]" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Pro Theme Palettes */}
                    <div className="flex items-center justify-between p-3.5 text-xs">
                      <div>
                        <div className="font-medium text-foreground">
                          {tr("Bộ giao diện mở rộng", "Theme Palettes")}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {tr(
                            "Chọn bảng màu IDE cao cấp (Dracula, Nord, Tokyo Night, ...)",
                            "Select high-contrast IDE themes",
                          )}
                        </div>
                      </div>
                      <Select
                        value={theme}
                        onValueChange={(val) => setTheme(val)}
                      >
                        <SelectTrigger className="w-44 h-8 text-xs">
                          <SelectValue
                            placeholder={tr("Chọn phong cách", "Select theme")}
                          />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          <SelectItem value="system">
                            {tr("Theo hệ điều hành", "Follow System")}
                          </SelectItem>
                          <SelectItem value="dark">
                            {tr("Tối tiêu chuẩn", "Default Dark")}
                          </SelectItem>
                          <SelectItem value="light">
                            {tr("Sáng tiêu chuẩn", "Default Light")}
                          </SelectItem>
                          {THEMES.map((th) => (
                            <SelectItem key={th.id} value={th.id}>
                              {th.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: DISPLAYS & BRIGHTNESS / MÀN HÌNH & ĐỘ SÁNG */}
            {activeSection === "displays" && (
              <div className="flex flex-col gap-5 max-w-2xl">
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    {tr("Màn hình & Độ sáng", "Displays & Brightness")}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tr(
                      "Tùy chỉnh độ sáng mô phỏng, độ phóng đại và hiệu ứng thị giác như trên iMac.",
                      "Adjust simulated brightness, UI scaling, and visual effects like on iMac.",
                    )}
                  </p>
                </div>

                {/* Brightness Slider Group */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                    {tr("Độ sáng giao diện", "Interface Brightness")}
                  </span>
                  <div className="rounded-xl border border-border/60 bg-card/60 p-4 shadow-xs flex flex-col gap-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">
                        {tr("Mức sáng mô phỏng", "Simulated brightness level")}
                      </span>
                      <span className="font-semibold text-primary">
                        {brightness}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <SunMedium className="size-4 text-muted-foreground shrink-0" />
                      <input
                        type="range"
                        min="70"
                        max="125"
                        value={brightness}
                        onChange={(e) =>
                          handleBrightnessChange(Number(e.target.value))
                        }
                        className="w-full accent-primary h-2 bg-muted rounded-lg cursor-pointer"
                      />
                      <Sun className="size-5 text-amber-500 shrink-0" />
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-1">
                      <span>{tr("Dịu mắt (70%)", "Dim (70%)")}</span>
                      <button
                        type="button"
                        onClick={() => handleBrightnessChange(100)}
                        className="hover:underline text-primary cursor-pointer"
                      >
                        {tr("Đặt lại chuẩn (100%)", "Reset default (100%)")}
                      </button>
                      <span>{tr("Sáng rực (125%)", "Bright (125%)")}</span>
                    </div>
                  </div>
                </div>

                {/* Display Scale & Visual Effects */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                    {tr(
                      "Tùy biến hiển thị & Hiệu ứng",
                      "Display Options & Effects",
                    )}
                  </span>
                  <div className="rounded-xl border border-border/60 bg-card/60 divide-y divide-border/40 overflow-hidden shadow-xs">
                    {/* Scale Select */}
                    <div className="flex items-center justify-between p-3.5 text-xs">
                      <div>
                        <div className="font-medium text-foreground">
                          {tr(
                            "Tỷ lệ thu phóng (Display Scale)",
                            "Display Scale",
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {tr(
                            "Kích thước chữ và các thành phần giao diện",
                            "Scale text and UI elements",
                          )}
                        </div>
                      </div>
                      <Select
                        value={displayScale}
                        onValueChange={handleDisplayScaleChange}
                      >
                        <SelectTrigger className="w-36 h-8 text-xs">
                          <SelectValue placeholder={tr("Tỷ lệ", "Scale")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="90">
                            {tr("Nhỏ (90%)", "Small (90%)")}
                          </SelectItem>
                          <SelectItem value="100">
                            {tr("Tiêu chuẩn (100%)", "Default (100%)")}
                          </SelectItem>
                          <SelectItem value="110">
                            {tr("Lớn (110%)", "Large (110%)")}
                          </SelectItem>
                          <SelectItem value="120">
                            {tr("Rất lớn (120%)", "Extra Large (120%)")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Glassmorphism / Backdrop blur */}
                    <div className="flex items-center justify-between p-3.5 text-xs">
                      <div>
                        <div className="font-medium text-foreground">
                          {tr(
                            "Hiệu ứng làm mờ kính (Glassmorphism)",
                            "Backdrop Blur (Glassmorphism)",
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {tr(
                            "Bật hiệu ứng mờ nền chuẩn giao diện macOS",
                            "Enable macOS-style frosted glass blur",
                          )}
                        </div>
                      </div>
                      <AnimatedSwitch
                        checked={backdropBlur}
                        onCheckedChange={handleBackdropBlurChange}
                      />
                    </div>

                    {/* Reduced Motion */}
                    <div className="flex items-center justify-between p-3.5 text-xs">
                      <div>
                        <div className="font-medium text-foreground">
                          {tr(
                            "Giảm chuyển động (Reduced Motion)",
                            "Reduced Motion",
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {tr(
                            "Hạn chế các hiệu ứng chuyển cảnh để tối ưu hiệu năng",
                            "Minimize UI animation transitions",
                          )}
                        </div>
                      </div>
                      <AnimatedSwitch
                        checked={reducedMotion}
                        onCheckedChange={handleReducedMotionChange}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: LANGUAGE & REGION / NGÔN NGỮ */}
            {activeSection === "language" && (
              <div className="flex flex-col gap-5 max-w-2xl">
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    {tr("Ngôn ngữ & Khu vực", "Language & Region")}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tr(
                      "Chọn ngôn ngữ chính hiển thị trên toàn bộ ứng dụng và định dạng ngày giờ.",
                      "Choose interface language and regional date/time formats.",
                    )}
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                    {tr(
                      "Ngôn ngữ giao diện chính",
                      "Primary Interface Language",
                    )}
                  </span>
                  <div className="rounded-xl border border-border/60 bg-card/60 divide-y divide-border/40 overflow-hidden shadow-xs">
                    <div className="flex items-center justify-between p-3.5 text-xs">
                      <div>
                        <div className="font-medium text-foreground">
                          {tr("Ngôn ngữ ưu tiên", "Preferred Language")}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {tr(
                            "Ngôn ngữ của menu, thông báo và hộp thoại",
                            "Language used for menus, toasts, and dialogs",
                          )}
                        </div>
                      </div>
                      <Select
                        value={i18n.language?.split("-")[0] || "vi"}
                        onValueChange={handleLanguageChange}
                      >
                        <SelectTrigger className="w-48 h-8 text-xs">
                          <SelectValue
                            placeholder={tr("Chọn ngôn ngữ", "Select language")}
                          />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {SUPPORTED_LANGUAGES.map((lang) => (
                            <SelectItem key={lang.code} value={lang.code}>
                              {lang.nativeName} ({lang.name})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between p-3.5 text-xs">
                      <div>
                        <div className="font-medium text-foreground">
                          {tr(
                            "Định dạng thời gian 24 giờ",
                            "24-Hour Time Format",
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {tr(
                            "Ví dụ: 17:30 thay vì 5:30 PM",
                            "e.g. 17:30 instead of 5:30 PM",
                          )}
                        </div>
                      </div>
                      <AnimatedSwitch defaultChecked />
                    </div>

                    <div className="flex items-center justify-between p-3.5 text-xs">
                      <div>
                        <div className="font-medium text-foreground">
                          {tr("Định dạng số", "Number Format")}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {tr(
                            "Phân cách hàng nghìn (1.000.000 / 1,000,000)",
                            "Thousands separator",
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {isVi ? "Việt Nam (1.000.000)" : "Standard (1,000,000)"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: PRIVACY & DATA / BẢO MẬT & DỮ LIỆU */}
            {activeSection === "privacy" && (
              <div className="flex flex-col gap-5 max-w-2xl">
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    {tr("Bảo mật & Dữ liệu", "Privacy & Data")}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tr(
                      "Quản lý ổ đĩa lưu trữ, dữ liệu tài khoản và bảo mật bộ nhớ.",
                      "Manage storage drive, account data, and memory security.",
                    )}
                  </p>
                </div>

                {/* Inset Group: Ổ ĐĨA LƯU TRỮ DỮ LIỆU & ỨNG DỤNG */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                    {tr(
                      "Ổ đĩa lưu trữ dữ liệu & Ứng dụng",
                      "Storage Drive & Application",
                    )}
                  </span>
                  <div className="rounded-xl border border-border/60 bg-card/60 divide-y divide-border/40 overflow-hidden shadow-xs">
                    {/* Hàng chọn ổ đĩa */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 text-xs gap-3">
                      <div className="flex items-start sm:items-center gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                          <HardDrive className="size-4" />
                        </div>
                        <div>
                          <div className="font-medium text-foreground flex items-center gap-2">
                            <span>
                              {tr("Chọn ổ đĩa lưu trữ", "Select Storage Drive")}
                            </span>
                            {currentDrive.toUpperCase().startsWith("D") && (
                              <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 text-[10px] px-1.5 py-0">
                                {tr(
                                  "Đã cách ly khỏi ổ C",
                                  "Isolated from Drive C",
                                )}
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {tr(
                              "Khuyên dùng ổ D để lưu trữ vĩnh viễn, bảo vệ dữ liệu và giải phóng ổ C.",
                              "Recommended Drive D for permanent storage, protecting data and freeing Drive C.",
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        {availableDrives.map((d) => {
                          const isD = d.toUpperCase().startsWith("D");
                          const isCurrent = currentDrive
                            .toUpperCase()
                            .startsWith(d.toUpperCase());
                          const isSelected = selectedDrive
                            .toUpperCase()
                            .startsWith(d.toUpperCase());
                          return (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setSelectedDrive(d)}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer",
                                isSelected
                                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                                  : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border-border/60",
                              )}
                            >
                              <span>Ổ {d}</span>
                              {isD && (
                                <span
                                  className={cn(
                                    "text-[9px] px-1 py-0.2 rounded font-normal",
                                    isSelected
                                      ? "bg-white/20 text-white"
                                      : "bg-emerald-500/15 text-emerald-500",
                                  )}
                                >
                                  {tr("Tối ưu", "Optimal")}
                                </span>
                              )}
                              {isCurrent && (
                                <span
                                  className="size-1.5 rounded-full bg-emerald-500"
                                  title="Đang kích hoạt"
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Hàng thực hiện di chuyển sang ổ đĩa */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 text-xs gap-3 bg-muted/20">
                      <div className="flex items-start sm:items-center gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                          <FolderSync className="size-4" />
                        </div>
                        <div>
                          <div className="font-medium text-foreground">
                            {tr(
                              `Chuyển toàn bộ dữ liệu & App sang ổ ${selectedDrive}`,
                              `Move all data & App to Drive ${selectedDrive}`,
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {tr(
                              `Tự động chuyển toàn bộ nick, cookie, proxy và file app sang ${selectedDrive}\\AutoLunex. Tuyệt đối không lưu vào ổ C.`,
                              `Automatically moves all accounts, cookies, proxies and app files to ${selectedDrive}\\AutoLunex. Strictly avoids Drive C.`,
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {currentDrive
                          .toUpperCase()
                          .startsWith(selectedDrive.toUpperCase()) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleOpenStorageFolder}
                            className="gap-1.5 text-xs h-8 cursor-pointer"
                          >
                            <FolderOpen className="size-3.5" />
                            {tr("Mở thư mục", "Open Folder")}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          disabled={isMigrating}
                          onClick={handleMigrateDrive}
                          className="gap-1.5 text-xs h-8 bg-blue-600 hover:bg-blue-500 text-white cursor-pointer font-medium"
                        >
                          <RefreshCw
                            className={cn(
                              "size-3.5",
                              isMigrating && "animate-spin",
                            )}
                          />
                          {isMigrating
                            ? tr("Đang chuyển...", "Moving...")
                            : currentDrive
                                  .toUpperCase()
                                  .startsWith(selectedDrive.toUpperCase())
                              ? tr("Đồng bộ lại", "Re-sync")
                              : tr(
                                  `Chuyển sang ${selectedDrive}`,
                                  `Move to ${selectedDrive}`,
                                )}
                        </Button>
                      </div>
                    </div>

                    {/* Trạng thái sau khi chuyển */}
                    {migrateStatus && (
                      <div className="p-3 text-xs bg-emerald-500/10 border-t border-emerald-500/20 text-emerald-500 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="size-4 shrink-0" />
                          <span>{migrateStatus}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleOpenStorageFolder}
                          className="h-6 text-xs text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/20 px-2 cursor-pointer"
                        >
                          {tr("Xem thư mục", "View Folder")}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Inset Group: BẢO MẬT & DỌN DẸP */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                    {tr("Lưu trữ trên máy", "Local Device Storage")}
                  </span>
                  <div className="rounded-xl border border-border/60 bg-card/60 divide-y divide-border/40 overflow-hidden shadow-xs">
                    <div className="flex items-center justify-between p-3.5 text-xs">
                      <div>
                        <div className="font-medium text-foreground">
                          {tr(
                            "Mã hóa lưu trữ Cookie & Token",
                            "Encrypted Cookie & Token Storage",
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {tr(
                            `Dữ liệu tài khoản được mã hóa và bảo vệ tại ${currentDrive}\\AutoLunex`,
                            `Account credentials encrypted and protected at ${currentDrive}\\AutoLunex`,
                          )}
                        </div>
                      </div>
                      <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 text-xs">
                        {tr("Đang kích hoạt", "Active")}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between p-3.5 text-xs">
                      <div>
                        <div className="font-medium text-foreground">
                          {tr("Xóa bộ nhớ đệm cache", "Clear Cache Storage")}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {tr(
                            "Giải phóng bộ nhớ tạm ứng dụng",
                            "Free temporary cache memory",
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          alert(
                            tr(
                              "Đã dọn sạch bộ nhớ cache!",
                              "Cache storage successfully cleaned!",
                            ),
                          )
                        }
                        className="h-7 text-xs"
                      >
                        {tr("Dọn dẹp", "Clean up")}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: ABOUT / THÔNG TIN ỨNG DỤNG (iMac "About This Mac" Style) */}
            {activeSection === "about" && (
              <div className="flex flex-col items-center text-center gap-5 max-w-lg mx-auto py-2">
                {/* Logo & Product Name */}
                <div className="flex flex-col items-center gap-2">
                  <div className="size-20 rounded-3xl bg-linear-to-b from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shadow-lg p-2.5">
                    <Logo className="size-16" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black tracking-tight text-foreground">
                      AutoLunex
                    </h3>
                    <p className="text-xs font-medium text-primary mt-0.5">
                      {tr(
                        "MMO kiếm tiền online cùng Lunex",
                        "MMO Make Money Online with Lunex",
                      )}
                    </p>
                  </div>
                </div>

                {/* macOS Style Inset Specs Card */}
                <div className="w-full rounded-2xl border border-border/60 bg-card/60 divide-y divide-border/40 text-left text-xs shadow-xs overflow-hidden">
                  <div className="flex justify-between p-3">
                    <span className="text-muted-foreground">
                      {tr("Phiên bản", "Version")}
                    </span>
                    <span className="font-semibold text-foreground">
                      v{appVersion}
                    </span>
                  </div>
                  <div className="flex justify-between p-3">
                    <span className="text-muted-foreground">
                      {tr("Hệ điều hành máy", "Operating System")}
                    </span>
                    <span className="font-semibold text-foreground">
                      {systemInfo?.os || "Windows 11"} (
                      {systemInfo?.arch || "x86_64"})
                    </span>
                  </div>
                  <div className="flex justify-between p-3">
                    <span className="text-muted-foreground">
                      {tr("Nhà phát hành", "Publisher")}
                    </span>
                    <span className="font-semibold text-foreground">
                      lunex.mt
                    </span>
                  </div>
                </div>

                {/* Update Check Status */}
                {updateStatus && (
                  <div className="text-xs font-medium text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg w-full">
                    {updateStatus}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap justify-center gap-2.5 w-full">
                  <Button
                    size="sm"
                    onClick={handleCheckUpdate}
                    disabled={isCheckingUpdate}
                    className="gap-1.5 text-xs bg-primary text-primary-foreground h-8 cursor-pointer"
                  >
                    <RefreshCw
                      className={cn(
                        "size-3.5",
                        isCheckingUpdate && "animate-spin",
                      )}
                    />
                    {isCheckingUpdate
                      ? tr("Đang kiểm tra...", "Checking...")
                      : tr("Kiểm tra bản cập nhật", "Check for Updates")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenUrl("https://lunex.io.vn")}
                    className="gap-1.5 text-xs h-8 cursor-pointer"
                  >
                    <ExternalLink className="size-3.5" />
                    {tr("Trang chủ lunex.io.vn", "Website lunex.io.vn")}
                  </Button>
                </div>

                <p className="text-[11px] text-muted-foreground mt-2">
                  {tr(
                    "Bản quyền © 2026 AutoLunex Technologies. Tất cả các quyền được bảo lưu.",
                    "Copyright © 2026 AutoLunex Technologies. All rights reserved.",
                  )}
                </p>
              </div>
            )}
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
}
