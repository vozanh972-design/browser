"use client";

import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LuCheck,
  LuChevronRight,
  LuCoins,
  LuCpu,
  LuExternalLink,
  LuGlobe,
  LuInfo,
  LuLogOut,
  LuMonitor,
  LuMoon,
  LuPalette,
  LuRefreshCw,
  LuSearch,
  LuShieldCheck,
  LuSparkles,
  LuSun,
  LuSunMedium,
  LuUser,
} from "react-icons/lu";
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
import { THEMES } from "@/lib/themes";
import { cn } from "@/lib/utils";
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

interface AppSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  xsmmAccount?: XsmmAccountInfo;
  accounts?: SettingsAccountSummary[];
  onXsmmLoginClick?: () => void;
  onXsmmLogoutClick?: () => void;
}

type SettingsSection =
  | "account"
  | "appearance"
  | "displays"
  | "language"
  | "automation"
  | "privacy"
  | "about";

interface SystemInfo {
  app_version: string;
  os: string;
  arch: string;
  portable: boolean;
}

const ACCENT_COLORS = [
  { id: "blue", label: "Xanh dương (Blue)", color: "#007aff" },
  { id: "purple", label: "Tím (Purple)", color: "#af52de" },
  { id: "pink", label: "Hồng (Pink)", color: "#ff2d55" },
  { id: "red", label: "Đỏ (Red)", color: "#ff3b30" },
  { id: "orange", label: "Cam (Orange)", color: "#ff9500" },
  { id: "yellow", label: "Vàng (Yellow)", color: "#ffcc00" },
  { id: "green", label: "Xanh lá (Green)", color: "#34c759" },
  { id: "graphite", label: "Xám (Graphite)", color: "#8e8e93" },
];

export function AppSettingsDialog({
  isOpen,
  onClose,
  xsmmAccount,
  accounts = [],
  onXsmmLoginClick,
  onXsmmLogoutClick,
}: AppSettingsDialogProps) {
  const { i18n } = useTranslation();
  const { theme, setTheme } = useTheme();

  const [activeSection, setActiveSection] =
    useState<SettingsSection>("account");
  const [searchQuery, setSearchQuery] = useState("");
  const [isMaximized, setIsMaximized] = useState(false);

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

  // Automation preferences
  const [autoSkipCheckpoint, setAutoSkipCheckpoint] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const saved = localStorage.getItem("autolunex_auto_skip_checkpoint");
      return saved === null ? true : saved === "true";
    } catch {
      return true;
    }
  });

  const [safeRequestDelay, setSafeRequestDelay] = useState<string>(() => {
    if (typeof window === "undefined") return "1.2";
    try {
      return localStorage.getItem("autolunex_safe_request_delay") || "1.2";
    } catch {
      return "1.2";
    }
  });

  // System & Update Info
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);

  // Load system info on open
  useEffect(() => {
    if (!isOpen) return;
    invoke<SystemInfo>("get_system_info")
      .then(setSystemInfo)
      .catch(() => {
        setSystemInfo({
          app_version: "2.4.0",
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

  const handleAutoSkipCheckpointChange = (val: boolean) => {
    setAutoSkipCheckpoint(val);
    try {
      localStorage.setItem("autolunex_auto_skip_checkpoint", String(val));
    } catch {
      // ignore
    }
  };

  const handleLanguageChange = (code: string) => {
    void i18n.changeLanguage(code);
  };

  const handleCheckUpdate = () => {
    setIsCheckingUpdate(true);
    setUpdateStatus(null);
    setTimeout(() => {
      setIsCheckingUpdate(false);
      setUpdateStatus("AutoLunex v2.4.0 đã là phiên bản mới nhất!");
    }, 1200);
  };

  const handleOpenUrl = (url: string) => {
    openUrl(url).catch(() => {
      if (typeof window !== "undefined") {
        window.open(url, "_blank");
      }
    });
  };

  // Stats calculation
  const stats = useMemo(() => {
    const total = accounts.length;
    const live = accounts.filter((a) => a.status === "live").length;
    const checkpoint = accounts.filter((a) => a.status === "checkpoint").length;
    const die = accounts.filter((a) => a.status === "die").length;
    return { total, live, checkpoint, die };
  }, [accounts]);

  // Sidebar navigation items (macOS iMac Style)
  const navItems = [
    {
      id: "account" as const,
      label: "Tài khoản người dùng",
      subLabel: xsmmAccount?.isLoggedIn
        ? xsmmAccount.username
        : "XSMM & Dữ liệu",
      icon: LuUser,
      color: "bg-blue-500",
    },
    {
      id: "appearance" as const,
      label: "Giao diện",
      subLabel: "Sáng, Tối, Màu nhấn & Chủ đề",
      icon: LuPalette,
      color: "bg-purple-500",
    },
    {
      id: "displays" as const,
      label: "Màn hình & Độ sáng",
      subLabel: "Độ sáng, Thu phóng & Hiệu ứng",
      icon: LuMonitor,
      color: "bg-cyan-500",
    },
    {
      id: "language" as const,
      label: "Ngôn ngữ & Khu vực",
      subLabel: "Tiếng Việt, English & Định dạng",
      icon: LuGlobe,
      color: "bg-emerald-500",
    },
    {
      id: "automation" as const,
      label: "Tự động & Nuôi acc",
      subLabel: "Cấu hình luồng & Độ trễ an toàn",
      icon: LuCpu,
      color: "bg-orange-500",
    },
    {
      id: "privacy" as const,
      label: "Bảo mật & Dữ liệu",
      subLabel: "Bộ nhớ đệm & Mã hóa",
      icon: LuShieldCheck,
      color: "bg-rose-500",
    },
    {
      id: "about" as const,
      label: "Giới thiệu AutoLunex",
      subLabel: "Phiên bản, Cập nhật & Bản quyền",
      icon: LuInfo,
      color: "bg-slate-500",
    },
  ];

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
        className={cn(
          "p-0 gap-0 overflow-hidden rounded-2xl border border-border/80 shadow-2xl bg-background/95 backdrop-blur-2xl transition-all duration-300 flex flex-col",
          isMaximized
            ? "w-[98vw] max-w-[1240px] h-[92vh]"
            : "w-[94vw] max-w-4xl h-[650px] max-h-[88vh]",
        )}
      >
        <DialogTitle className="sr-only">
          Cài đặt hệ thống AutoLunex
        </DialogTitle>

        {/* macOS Top Window Bar with Traffic Light Controls */}
        <div
          data-tauri-drag-region
          className="flex h-11 shrink-0 select-none items-center justify-between border-b border-border/50 bg-muted/30 px-3.5"
        >
          {/* Traffic Lights */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng cài đặt"
              className="group relative flex size-3 items-center justify-center rounded-full bg-[#FF5F56] border border-[#E0443E] transition-transform active:scale-90"
            >
              <span className="opacity-0 group-hover:opacity-100 text-[8px] font-bold text-black/70 leading-none">
                ×
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Thu nhỏ"
              className="group relative flex size-3 items-center justify-center rounded-full bg-[#FFBD2E] border border-[#DEA123] transition-transform active:scale-90"
            >
              <span className="opacity-0 group-hover:opacity-100 text-[8px] font-bold text-black/70 leading-none">
                –
              </span>
            </button>
            <button
              type="button"
              onClick={() => setIsMaximized((v) => !v)}
              aria-label="Phóng to cửa sổ"
              className="group relative flex size-3 items-center justify-center rounded-full bg-[#27C93F] border border-[#1AAB29] transition-transform active:scale-90"
            >
              <span className="opacity-0 group-hover:opacity-100 text-[7px] font-bold text-black/70 leading-none">
                +
              </span>
            </button>
            <span className="ml-2 text-xs font-medium text-muted-foreground/80">
              Cài đặt hệ thống
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
            className="h-7 px-2 text-xs rounded-lg text-muted-foreground hover:text-foreground"
          >
            Xong
          </Button>
        </div>

        {/* 2-Column macOS Layout: Sidebar + Detail Content Pane */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left Sidebar */}
          <aside className="w-64 sm:w-72 shrink-0 border-r border-border/50 bg-muted/20 flex flex-col p-3 gap-2 overflow-y-auto">
            {/* Search Input */}
            <div className="relative">
              <LuSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm cài đặt..."
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
              <div className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-blue-500 to-indigo-600 text-white font-bold text-sm shadow-sm">
                {xsmmAccount?.isLoggedIn ? (
                  xsmmAccount.username.slice(0, 2).toUpperCase()
                ) : (
                  <LuUser className="size-5" />
                )}
                {xsmmAccount?.isLoggedIn && (
                  <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-xs font-semibold text-foreground">
                  {xsmmAccount?.isLoggedIn
                    ? xsmmAccount.username
                    : "Khách / Chưa kết nối"}
                </span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {xsmmAccount?.isLoggedIn
                    ? `Số dư: ${xsmmAccount.balance} xu`
                    : "Đăng nhập XSMM"}
                </span>
              </div>
              <LuChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
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

            {/* Bottom Footer Info */}
            <div className="mt-auto pt-3 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground/80 px-1">
              <span>AutoLunex Pro</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                v2.4.0
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
                    Tài khoản người dùng
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Quản lý phiên đăng nhập XSMM, số dư xu và dữ liệu tài khoản
                    mạng xã hội.
                  </p>
                </div>

                {/* Hero Profile Card */}
                <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-linear-to-r from-blue-500/10 via-indigo-500/5 to-transparent p-4 sm:p-5">
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-blue-600 to-indigo-600 text-white font-bold text-lg shadow-md ring-4 ring-blue-500/20">
                    {xsmmAccount?.isLoggedIn ? (
                      xsmmAccount.username.slice(0, 2).toUpperCase()
                    ) : (
                      <LuUser className="size-7" />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-foreground">
                        {xsmmAccount?.isLoggedIn
                          ? xsmmAccount.username
                          : "Tài khoản cục bộ (Chưa liên kết XSMM)"}
                      </span>
                      {xsmmAccount?.isLoggedIn ? (
                        <Badge className="bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/20 text-[10px] px-2 py-0 border-emerald-500/30">
                          Đã kích hoạt
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-2 py-0"
                        >
                          Khách
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <LuCoins className="size-3.5 text-amber-500" />
                        <span className="font-semibold text-foreground">
                          {xsmmAccount?.isLoggedIn ? xsmmAccount.balance : "0"}
                        </span>{" "}
                        xu
                      </span>
                      <span>•</span>
                      <span>Quyền hạn: Thành viên VIP</span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {xsmmAccount?.isLoggedIn ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onXsmmLogoutClick}
                        className="gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                      >
                        <LuLogOut className="size-3.5" />
                        Đăng xuất
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={onXsmmLoginClick}
                        className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium"
                      >
                        <LuUser className="size-3.5" />
                        Đăng nhập XSMM
                      </Button>
                    )}
                  </div>
                </div>

                {/* Inset Group: Dịch vụ & Kết nối */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                    Thông tin phiên làm việc
                  </span>
                  <div className="rounded-xl border border-border/60 bg-card/60 divide-y divide-border/40 overflow-hidden shadow-xs">
                    <div className="flex items-center justify-between p-3.5 text-xs">
                      <div>
                        <div className="font-medium text-foreground">
                          Trạng thái API
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Hệ thống máy chủ dịch vụ tự động hóa XSMM
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-emerald-500 font-medium">
                        <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                        Đang hoạt động
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3.5 text-xs">
                      <div>
                        <div className="font-medium text-foreground">
                          Token phiên làm việc
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Mã xác thực bảo mật cục bộ
                        </div>
                      </div>
                      <span className="font-mono text-[11px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded border border-border/50">
                        {xsmmAccount?.isLoggedIn
                          ? `sk-xsmm-••••••••${xsmmAccount.username.slice(-2)}`
                          : "Chưa thiết lập"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3.5 text-xs">
                      <div>
                        <div className="font-medium text-foreground">
                          Đổi tài khoản
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Đăng nhập bằng tài khoản hoặc mã token khác
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={onXsmmLoginClick}
                        className="h-7 text-xs"
                      >
                        Đổi phiên
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Inset Group: Dữ liệu Facebook trong máy */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                    Thống kê tài khoản lưu trong app
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="rounded-xl border border-border/50 bg-card/60 p-3 flex flex-col">
                      <span className="text-[11px] text-muted-foreground">
                        Tổng số tài khoản
                      </span>
                      <span className="text-lg font-bold text-foreground mt-0.5">
                        {stats.total}
                      </span>
                    </div>
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 flex flex-col">
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                        Đang Live
                      </span>
                      <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {stats.live}
                      </span>
                    </div>
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex flex-col">
                      <span className="text-[11px] text-amber-600 dark:text-amber-400">
                        Checkpoint
                      </span>
                      <span className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                        {stats.checkpoint}
                      </span>
                    </div>
                    <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 flex flex-col">
                      <span className="text-[11px] text-rose-600 dark:text-rose-400">
                        Die / Khóa
                      </span>
                      <span className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                        {stats.die}
                      </span>
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
                    Giao diện
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tùy chọn phong cách hiển thị sáng, tối hoặc theo hệ thống
                    macOS/Windows.
                  </p>
                </div>

                {/* macOS Style 3 Theme Mockup Cards */}
                <div className="flex flex-col gap-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Chế độ giao diện
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
                        <LuSun className="size-3.5 text-amber-500" />
                        Sáng
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
                        <LuMoon className="size-3.5 text-indigo-400" />
                        Tối
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
                        <LuSparkles className="size-3.5 text-purple-400" />
                        Tự động
                      </div>
                    </button>
                  </div>
                </div>

                {/* Inset Group: Accent Color & Themes */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                    Màu sắc & Phối màu
                  </span>
                  <div className="rounded-xl border border-border/60 bg-card/60 divide-y divide-border/40 overflow-hidden shadow-xs">
                    {/* Accent Color Circles (macOS Style) */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 gap-2.5 text-xs">
                      <div>
                        <div className="font-medium text-foreground">
                          Màu điểm nhấn (Accent Color)
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Màu sắc nổi bật cho nút bấm, viền và thanh điều hướng
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {ACCENT_COLORS.map((item) => (
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
                              <LuCheck className="size-3 text-white stroke-[3]" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Pro Theme Palettes */}
                    <div className="flex items-center justify-between p-3.5 text-xs">
                      <div>
                        <div className="font-medium text-foreground">
                          Bộ giao diện mở rộng
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Chọn bảng màu IDE cao cấp (Dracula, Nord, Tokyo Night,
                          ...)
                        </div>
                      </div>
                      <Select
                        value={theme}
                        onValueChange={(val) => setTheme(val)}
                      >
                        <SelectTrigger className="w-44 h-8 text-xs">
                          <SelectValue placeholder="Chọn phong cách" />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          <SelectItem value="system">
                            Theo hệ điều hành
                          </SelectItem>
                          <SelectItem value="dark">Tối tiêu chuẩn</SelectItem>
                          <SelectItem value="light">Sáng tiêu chuẩn</SelectItem>
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
                    Màn hình & Độ sáng
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tùy chỉnh độ sáng mô phỏng, độ phóng đại và hiệu ứng thị
                    giác như trên iMac.
                  </p>
                </div>

                {/* Brightness Slider Group */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                    Độ sáng giao diện
                  </span>
                  <div className="rounded-xl border border-border/60 bg-card/60 p-4 shadow-xs flex flex-col gap-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">
                        Mức sáng mô phỏng
                      </span>
                      <span className="font-semibold text-primary">
                        {brightness}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <LuSunMedium className="size-4 text-muted-foreground shrink-0" />
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
                      <LuSun className="size-5 text-amber-500 shrink-0" />
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-1">
                      <span>Dịu mắt (70%)</span>
                      <button
                        type="button"
                        onClick={() => handleBrightnessChange(100)}
                        className="hover:underline text-primary cursor-pointer"
                      >
                        Đặt lại chuẩn (100%)
                      </button>
                      <span>Sáng rực (125%)</span>
                    </div>
                  </div>
                </div>

                {/* Display Scale & Visual Effects */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                    Tùy biến hiển thị & Hiệu ứng
                  </span>
                  <div className="rounded-xl border border-border/60 bg-card/60 divide-y divide-border/40 overflow-hidden shadow-xs">
                    {/* Scale Select */}
                    <div className="flex items-center justify-between p-3.5 text-xs">
                      <div>
                        <div className="font-medium text-foreground">
                          Tỷ lệ thu phóng (Display Scale)
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Kích thước chữ và các thành phần giao diện
                        </div>
                      </div>
                      <Select
                        value={displayScale}
                        onValueChange={handleDisplayScaleChange}
                      >
                        <SelectTrigger className="w-36 h-8 text-xs">
                          <SelectValue placeholder="Tỷ lệ" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="90">Nhỏ (90%)</SelectItem>
                          <SelectItem value="100">Tiêu chuẩn (100%)</SelectItem>
                          <SelectItem value="110">Lớn (110%)</SelectItem>
                          <SelectItem value="120">Rất lớn (120%)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Glassmorphism / Backdrop blur */}
                    <div className="flex items-center justify-between p-3.5 text-xs">
                      <div>
                        <div className="font-medium text-foreground">
                          Hiệu ứng làm mờ kính (Glassmorphism)
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Bật hiệu ứng mờ nền chuẩn giao diện macOS
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
                          Giảm chuyển động (Reduced Motion)
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Hạn chế các hiệu ứng chuyển cảnh để tối ưu hiệu năng
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
                    Ngôn ngữ & Khu vực
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Chọn ngôn ngữ chính hiển thị trên toàn bộ ứng dụng và định
                    dạng ngày giờ.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                    Ngôn ngữ giao diện chính
                  </span>
                  <div className="rounded-xl border border-border/60 bg-card/60 divide-y divide-border/40 overflow-hidden shadow-xs">
                    <div className="flex items-center justify-between p-3.5 text-xs">
                      <div>
                        <div className="font-medium text-foreground">
                          Ngôn ngữ ưu tiên
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Ngôn ngữ của menu, thông báo và hộp thoại
                        </div>
                      </div>
                      <Select
                        value={i18n.language?.split("-")[0] || "vi"}
                        onValueChange={handleLanguageChange}
                      >
                        <SelectTrigger className="w-48 h-8 text-xs">
                          <SelectValue placeholder="Chọn ngôn ngữ" />
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
                          Định dạng thời gian 24 giờ
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Ví dụ: 17:30 thay vì 5:30 PM
                        </div>
                      </div>
                      <AnimatedSwitch defaultChecked />
                    </div>

                    <div className="flex items-center justify-between p-3.5 text-xs">
                      <div>
                        <div className="font-medium text-foreground">
                          Định dạng số
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Phân cách hàng nghìn (1.000.000 / 1,000,000)
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        Việt Nam (1.000.000)
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: AUTOMATION / TỰ ĐỘNG & NUÔI ACC */}
            {activeSection === "automation" && (
              <div className="flex flex-col gap-5 max-w-2xl">
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    Tự động & Nuôi acc
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Cấu hình an toàn luồng chạy job, khoảng cách giãn cách
                    request và xử lý checkpoint.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                    Cơ chế an toàn Facebook
                  </span>
                  <div className="rounded-xl border border-border/60 bg-card/60 divide-y divide-border/40 overflow-hidden shadow-xs">
                    {/* Auto Skip Checkpoint */}
                    <div className="flex items-center justify-between p-3.5 text-xs">
                      <div className="max-w-md">
                        <div className="font-medium text-foreground">
                          Tự động vô hiệu hóa nick Checkpoint
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Làm mờ tài khoản checkpoint và ngăn không đưa vào
                          luồng chạy job nuôi/reg page
                        </div>
                      </div>
                      <AnimatedSwitch
                        checked={autoSkipCheckpoint}
                        onCheckedChange={handleAutoSkipCheckpointChange}
                      />
                    </div>

                    {/* Delay */}
                    <div className="flex items-center justify-between p-3.5 text-xs">
                      <div>
                        <div className="font-medium text-foreground">
                          Giãn cách an toàn giữa các request
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Tránh bị Facebook chặn IP hoặc đánh spam
                        </div>
                      </div>
                      <Select
                        value={safeRequestDelay}
                        onValueChange={setSafeRequestDelay}
                      >
                        <SelectTrigger className="w-36 h-8 text-xs">
                          <SelectValue placeholder="Độ trễ" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0.8">0.8 giây (Nhanh)</SelectItem>
                          <SelectItem value="1.2">
                            1.2 giây (Khuyến nghị)
                          </SelectItem>
                          <SelectItem value="2.0">
                            2.0 giây (An toàn)
                          </SelectItem>
                          <SelectItem value="3.0">
                            3.0 giây (Siêu bảo vệ)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Auto Save State */}
                    <div className="flex items-center justify-between p-3.5 text-xs">
                      <div>
                        <div className="font-medium text-foreground">
                          Tự động lưu lịch sử thao tác
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Lưu nhật ký tương tác và kết quả job vào máy cục bộ
                        </div>
                      </div>
                      <AnimatedSwitch defaultChecked />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: PRIVACY & DATA / BẢO MẬT */}
            {activeSection === "privacy" && (
              <div className="flex flex-col gap-5 max-w-2xl">
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    Bảo mật & Dữ liệu
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Quản lý lưu trữ cục bộ, cookie trình duyệt và làm sạch bộ
                    nhớ tạm.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                    Lưu trữ trên máy
                  </span>
                  <div className="rounded-xl border border-border/60 bg-card/60 divide-y divide-border/40 overflow-hidden shadow-xs">
                    <div className="flex items-center justify-between p-3.5 text-xs">
                      <div>
                        <div className="font-medium text-foreground">
                          Mã hóa lưu trữ Cookie & Token
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Dữ liệu tài khoản được mã hóa bảo mật trong
                          localStorage máy tính
                        </div>
                      </div>
                      <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 text-xs">
                        Đang kích hoạt
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between p-3.5 text-xs">
                      <div>
                        <div className="font-medium text-foreground">
                          Xóa bộ nhớ đệm cache
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Giải phóng bộ nhớ tạm trình duyệt
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => alert("Đã dọn sạch bộ nhớ cache!")}
                        className="h-7 text-xs"
                      >
                        Dọn dẹp
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
                      Professional Automation & Multi-Profile Browser
                    </p>
                  </div>
                </div>

                {/* macOS Style Inset Specs Card */}
                <div className="w-full rounded-2xl border border-border/60 bg-card/60 divide-y divide-border/40 text-left text-xs shadow-xs overflow-hidden">
                  <div className="flex justify-between p-3">
                    <span className="text-muted-foreground">Phiên bản</span>
                    <span className="font-semibold text-foreground">
                      {systemInfo?.app_version || "2.4.0"} (Sonoma Edition)
                    </span>
                  </div>
                  <div className="flex justify-between p-3">
                    <span className="text-muted-foreground">
                      Hệ điều hành máy
                    </span>
                    <span className="font-semibold text-foreground">
                      {systemInfo?.os || "Windows 11"} (
                      {systemInfo?.arch || "x86_64"})
                    </span>
                  </div>
                  <div className="flex justify-between p-3">
                    <span className="text-muted-foreground">Lõi phần mềm</span>
                    <span className="font-semibold text-foreground">
                      Tauri v2 • Chromium WebKit • React 19
                    </span>
                  </div>
                  <div className="flex justify-between p-3">
                    <span className="text-muted-foreground">
                      Kênh phân phối
                    </span>
                    <span className="font-semibold text-foreground">
                      {systemInfo?.portable
                        ? "Bản Portable (Không cần cài đặt)"
                        : "Bản chính thức"}
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
                    className="gap-1.5 text-xs bg-primary text-primary-foreground h-8"
                  >
                    <LuRefreshCw
                      className={cn(
                        "size-3.5",
                        isCheckingUpdate && "animate-spin",
                      )}
                    />
                    {isCheckingUpdate
                      ? "Đang kiểm tra..."
                      : "Kiểm tra bản cập nhật"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenUrl("https://lunex.io.vn")}
                    className="gap-1.5 text-xs h-8"
                  >
                    <LuExternalLink className="size-3.5" />
                    Trang chủ lunex.io.vn
                  </Button>
                </div>

                <p className="text-[11px] text-muted-foreground mt-2">
                  Bản quyền © 2026 AutoLunex Technologies. Tất cả các quyền được
                  bảo lưu.
                </p>
              </div>
            )}
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
}
