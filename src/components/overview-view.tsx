"use client";

import {
  ArrowRight,
  CheckCircle2,
  Coins,
  Cpu,
  Key,
  Layers,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  User,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FaFacebook, FaInstagram } from "react-icons/fa";
import { TiktokIcon } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import type { FacebookAccount } from "@/app/page";
import type { AppPage } from "./rail-nav";
import { cn } from "@/lib/utils";

interface OverviewViewProps {
  accounts: FacebookAccount[];
  xsmmAccount: {
    username: string;
    balance: string;
    token: string;
    isLoggedIn: boolean;
  };
  nvcAccount: {
    username: string;
    balance: string;
    sessionCookie: string;
    isLoggedIn: boolean;
  };
  dolikeAccount: {
    email: string;
    balance: string;
    isLoggedIn: boolean;
  };
  licenseInfo: {
    key: string;
    daysLeft: number | null;
    expiredAt: string | null;
    buyer: string | null;
  };
  onNavigate: (page: AppPage) => void;
  onSelectPlatform: (platform: "tiktok" | "facebook" | "instagram") => void;
  onOpenJobConfig?: () => void;
  onOpenXsmmLogin?: () => void;
  onOpenNvcLogin?: () => void;
  onOpenDolikeLogin?: () => void;
}

export function OverviewView({
  accounts,
  xsmmAccount,
  nvcAccount,
  dolikeAccount,
  licenseInfo,
  onNavigate,
  onSelectPlatform,
  onOpenJobConfig,
  onOpenXsmmLogin,
  onOpenNvcLogin,
  onOpenDolikeLogin,
}: OverviewViewProps) {
  const { i18n } = useTranslation();
  const isVi = (i18n.language?.split("-")[0] || "vi") === "vi";
  const tr = (vi: string, en: string) => (isVi ? vi : en);

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Thống kê tài khoản
  const fbAccounts = accounts.filter(
    (a) => (a.platform || "facebook") === "facebook",
  );
  const tiktokDevices = accounts.filter((a) => a.platform === "tiktok");
  const igAccounts = accounts.filter((a) => a.platform === "instagram");

  // Đếm tổng số tài khoản TikTok (mỗi thiết bị có thể chứa nhiều tài khoản)
  const totalTikTokAccs = tiktokDevices.reduce((sum, dev) => {
    return sum + (dev.tiktokAccounts?.length || 1);
  }, 0);

  const totalAccounts = fbAccounts.length + totalTikTokAccs + igAccounts.length;

  const liveAccounts = accounts.filter(
    (a) => a.isLive === true || a.status === "live",
  ).length;
  const livePercent =
    accounts.length > 0
      ? Math.round((liveAccounts / accounts.length) * 100)
      : 100;

  const fbLiveCount = fbAccounts.filter(
    (a) => a.isLive === true || a.status === "live",
  ).length;
  const fbPagesCount = fbAccounts.reduce(
    (sum, a) => sum + (a.pages?.length || 0),
    0,
  );

  const igLinkedCount = igAccounts.filter(
    (a) => a.dolikeLinked || a.isDolike,
  ).length;

  // Lấy tên hiển thị chào mừng
  const greetingName =
    licenseInfo.buyer ||
    xsmmAccount.username ||
    nvcAccount.username ||
    (isVi ? "Bạn" : "User");

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 sm:py-6 select-none max-w-6xl mx-auto w-full space-y-6">
      {/* 1. Header Chào Mừng & Nút Hành Động Nhanh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              {tr(`Xin chào, ${greetingName} 👋`, `Hello, ${greetingName} 👋`)}
            </h1>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              {tr(
                "Hệ thống AutoLunex đang hoạt động • Tự động hóa mạng xã hội",
                "AutoLunex system active • Social automation engine",
              )}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-8 text-xs gap-1.5 cursor-pointer border-border hover:bg-muted"
          >
            <RefreshCw
              className={cn("size-3.5", isRefreshing && "animate-spin")}
            />
            <span>{tr("Làm mới", "Refresh")}</span>
          </Button>

          {onOpenJobConfig && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onOpenJobConfig}
              className="h-8 text-xs gap-1.5 cursor-pointer border-border hover:bg-muted"
            >
              <SlidersHorizontal className="size-3.5 text-primary" />
              <span>{tr("Cài đặt Job", "Job Config")}</span>
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            onClick={() => onNavigate("profiles")}
            className="h-8 text-xs font-semibold gap-1.5 cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
          >
            <span>{tr("Danh sách tài khoản", "Account List")}</span>
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* 2. Dải Thông Số Tóm Tắt (Pill Stats tương tự ảnh mẫu) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* Tổng tài khoản */}
        <div className="rounded-xl border border-border/70 bg-card/50 p-3.5 flex flex-col justify-between gap-1 shadow-2xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>{tr("Tổng tài khoản", "Total Accounts")}</span>
            <Layers className="size-3.5 text-blue-400" />
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
              {totalAccounts}
            </span>
            <span className="text-[11px] text-muted-foreground font-medium">
              {tr("tài khoản", "accounts")}
            </span>
          </div>
          <span className="text-[10.5px] text-muted-foreground/80 truncate">
            {fbAccounts.length} FB • {totalTikTokAccs} TikTok • {igAccounts.length} IG
          </span>
        </div>

        {/* Thiết bị USB ADB */}
        <div className="rounded-xl border border-border/70 bg-card/50 p-3.5 flex flex-col justify-between gap-1 shadow-2xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>{tr("Cổng USB (ADB)", "USB ADB Ports")}</span>
            <Smartphone className="size-3.5 text-emerald-400" />
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
              {tiktokDevices.length}
            </span>
            <span className="text-[11px] text-muted-foreground font-medium">
              {tr("máy cắm cáp", "phones")}
            </span>
          </div>
          <span className="text-[10.5px] text-emerald-500 font-medium truncate flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            <span>
              {tiktokDevices.length > 0
                ? tr("Tự động nhận diện sẵn sàng", "Auto-detected & ready")
                : tr("Chưa cắm máy nào", "No devices connected")}
            </span>
          </span>
        </div>

        {/* Sức khỏe tài khoản */}
        <div className="rounded-xl border border-border/70 bg-card/50 p-3.5 flex flex-col justify-between gap-1 shadow-2xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>{tr("Tỷ lệ Sẵn sàng", "Live Ratio")}</span>
            <ShieldCheck className="size-3.5 text-amber-400" />
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
              {livePercent}%
            </span>
            <span className="text-[11px] text-muted-foreground font-medium">
              {liveAccounts}/{accounts.length || 0}
            </span>
          </div>
          <span className="text-[10.5px] text-muted-foreground/80 truncate">
            {tr("Tài khoản live & khả dụng", "Healthy & available")}
          </span>
        </div>

        {/* Bản quyền ứng dụng */}
        <div className="rounded-xl border border-border/70 bg-card/50 p-3.5 flex flex-col justify-between gap-1 shadow-2xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>{tr("Bản quyền AutoLunex", "App License")}</span>
            <Key className="size-3.5 text-purple-400" />
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-base sm:text-lg font-bold text-foreground tracking-tight truncate">
              {licenseInfo.daysLeft !== null
                ? `${licenseInfo.daysLeft} ngày`
                : tr("Đã kích hoạt", "Activated")}
            </span>
          </div>
          <span className="text-[10.5px] text-emerald-500 font-medium truncate">
            {licenseInfo.buyer ? `Sở hữu: ${licenseInfo.buyer}` : tr("Bản quyền chính thức", "Official license")}
          </span>
        </div>
      </div>

      {/* 3. Ba Thẻ Nền Tảng Trực Quan (TikTok, Facebook, Instagram) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-foreground uppercase tracking-wider">
            {tr("Hệ sinh thái nền tảng", "Platform Ecosystem")}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {tr("Nhấp vào thẻ để quản lý tài khoản", "Click card to manage")}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Card TikTok */}
          <div
            onClick={() => {
              onSelectPlatform("tiktok");
              onNavigate("profiles");
            }}
            className="group rounded-xl border border-border/70 bg-card/40 hover:bg-card/75 hover:border-pink-500/40 p-4 transition-all cursor-pointer flex flex-col justify-between gap-3 shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-pink-500/15 text-pink-400 flex items-center justify-center shrink-0">
                  <TiktokIcon className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground group-hover:text-pink-400 transition-colors">
                    TikTok
                  </h3>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    com.ss.android.ugc.trill
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-pink-500/10 text-pink-400 border border-pink-500/25">
                Bản VN
              </span>
            </div>

            <div className="space-y-1 py-1">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground">{tr("Số thiết bị cắm cáp:", "Connected phones:")}</span>
                <span className="font-bold text-foreground">{tiktokDevices.length} máy</span>
              </div>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground">{tr("Tổng tài khoản TikTok:", "TikTok accounts:")}</span>
                <span className="font-bold text-foreground">{totalTikTokAccs} acc</span>
              </div>
            </div>

            <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-pink-400 font-semibold group-hover:translate-x-0.5 transition-transform">
              <span>{tr("Mở danh sách TikTok", "Open TikTok")}</span>
              <ArrowRight className="size-3" />
            </div>
          </div>

          {/* Card Facebook */}
          <div
            onClick={() => {
              onSelectPlatform("facebook");
              onNavigate("profiles");
            }}
            className="group rounded-xl border border-border/70 bg-card/40 hover:bg-card/75 hover:border-blue-500/40 p-4 transition-all cursor-pointer flex flex-col justify-between gap-3 shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
                  <FaFacebook className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground group-hover:text-blue-400 transition-colors">
                    Facebook
                  </h3>
                  <span className="text-[10px] text-muted-foreground">
                    XSMM • NVC • TTC
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/25">
                Token EAAAA
              </span>
            </div>

            <div className="space-y-1 py-1">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground">{tr("Tài khoản khả dụng:", "Active accounts:")}</span>
                <span className="font-bold text-foreground">{fbLiveCount}/{fbAccounts.length} Live</span>
              </div>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground">{tr("Số Fanpage liên kết:", "Linked Pages:")}</span>
                <span className="font-bold text-foreground">{fbPagesCount} pages</span>
              </div>
            </div>

            <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-blue-400 font-semibold group-hover:translate-x-0.5 transition-transform">
              <span>{tr("Mở danh sách Facebook", "Open Facebook")}</span>
              <ArrowRight className="size-3" />
            </div>
          </div>

          {/* Card Instagram */}
          <div
            onClick={() => {
              onSelectPlatform("instagram");
              onNavigate("dolike");
            }}
            className="group rounded-xl border border-border/70 bg-card/40 hover:bg-card/75 hover:border-[#E1306C]/40 p-4 transition-all cursor-pointer flex flex-col justify-between gap-3 shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-[#E1306C]/15 text-[#E1306C] flex items-center justify-center shrink-0">
                  <FaInstagram className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground group-hover:text-[#E1306C] transition-colors">
                    Instagram
                  </h3>
                  <span className="text-[10px] text-muted-foreground">
                    DoLike Automation
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E1306C]/10 text-[#E1306C] border border-[#E1306C]/25">
                DoLike API
              </span>
            </div>

            <div className="space-y-1 py-1">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground">{tr("Tài khoản Instagram:", "Instagram accounts:")}</span>
                <span className="font-bold text-foreground">{igAccounts.length} acc</span>
              </div>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground">{tr("Đã liên kết DoLike:", "Linked DoLike:")}</span>
                <span className="font-bold text-foreground">{igLinkedCount} acc</span>
              </div>
            </div>

            <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-[#E1306C] font-semibold group-hover:translate-x-0.5 transition-transform">
              <span>{tr("Mở danh sách Instagram", "Open Instagram")}</span>
              <ArrowRight className="size-3" />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Sàn Kiếm Tiền & Trạng Thái Tài Khoản Sàn */}
      <div className="rounded-xl border border-border/70 bg-card/40 p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
          <div className="flex items-center gap-2">
            <Coins className="size-4 text-amber-400" />
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">
              {tr("Sàn kiếm tiền & Liên kết trao đổi", "Exchange Platforms & Balances")}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {tr("Tự động nhận job & cộng xu", "Auto job execution & balance")}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* XSMM */}
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">XSMM</span>
              {xsmmAccount.isLoggedIn ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  <CheckCircle2 className="size-2.5" />
                  <span>{tr("Đã đăng nhập", "Logged in")}</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onOpenXsmmLogin}
                  className="text-[10px] text-primary hover:underline cursor-pointer font-medium"
                >
                  {tr("Đăng nhập", "Sign in")}
                </button>
              )}
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground truncate">
                {xsmmAccount.username ? `@${xsmmAccount.username}` : tr("Chưa kết nối tài khoản", "Not connected")}
              </div>
              <div className="text-sm font-bold text-amber-400 mt-0.5">
                {xsmmAccount.balance ? `${xsmmAccount.balance} xu` : "0 xu"}
              </div>
            </div>
          </div>

          {/* Nhiệm Vụ Chéo (NVC) */}
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">Nhiệm Vụ Chéo</span>
              {nvcAccount.isLoggedIn ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  <CheckCircle2 className="size-2.5" />
                  <span>{tr("Đã đăng nhập", "Logged in")}</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onOpenNvcLogin}
                  className="text-[10px] text-primary hover:underline cursor-pointer font-medium"
                >
                  {tr("Đăng nhập", "Sign in")}
                </button>
              )}
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground truncate">
                {nvcAccount.username ? `@${nvcAccount.username}` : tr("Chưa kết nối tài khoản", "Not connected")}
              </div>
              <div className="text-sm font-bold text-blue-400 mt-0.5">
                {nvcAccount.balance ? `${nvcAccount.balance} xu` : "0 xu"}
              </div>
            </div>
          </div>

          {/* DoLike */}
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">DoLike</span>
              {dolikeAccount.isLoggedIn ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  <CheckCircle2 className="size-2.5" />
                  <span>{tr("Đã đăng nhập", "Logged in")}</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onOpenDolikeLogin}
                  className="text-[10px] text-primary hover:underline cursor-pointer font-medium"
                >
                  {tr("Đăng nhập", "Sign in")}
                </button>
              )}
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground truncate">
                {dolikeAccount.email || tr("Chưa kết nối tài khoản", "Not connected")}
              </div>
              <div className="text-sm font-bold text-fuchsia-400 mt-0.5">
                {dolikeAccount.balance ? `${dolikeAccount.balance} xu` : "0 xu"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
