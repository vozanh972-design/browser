"use client";

import { Coins, Key, LayoutGrid, LayoutList, LogOut, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaFacebook, FaInstagram } from "react-icons/fa";
import { Logo } from "@/components/icons/logo";
import { Button } from "@/components/ui/button";
import { UsbDeviceHub } from "@/components/usb-device-hub";
import { getCurrentOS, type OperatingSystem } from "@/lib/platform";
import { cn } from "@/lib/utils";

export interface XsmmAccountInfo {
  username: string;
  balance: string;
  isLoggedIn: boolean;
}

export interface NvcAccountInfo {
  username: string;
  balance: string;
  isLoggedIn: boolean;
}

export interface DolikeAccountInfo {
  username: string;
  balance: string;
  isLoggedIn: boolean;
  userId?: string | number;
  email?: string;
}

export function TiktokIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 3 15.69 6.34 6.34 0 0 0 9.35 22a6.33 6.33 0 0 0 6.34-6.31V9.22a8.16 8.16 0 0 0 4.9 1.62V7.4a4.85 4.85 0 0 1-1-.71z" />
    </svg>
  );
}

export type SocialPlatform = "tiktok" | "facebook" | "instagram";

interface AppHeaderProps {
  pageTitle?: string;
  activePlatform?: SocialPlatform;
  onPlatformChange?: (platform: SocialPlatform) => void;
  xsmmAccount?: XsmmAccountInfo;
  onXsmmLoginClick?: () => void;
  onXsmmLogoutClick?: () => void;
  nvcAccount?: NvcAccountInfo;
  onNvcLoginClick?: () => void;
  onNvcLogoutClick?: () => void;
  dolikeAccount?: DolikeAccountInfo;
  onDolikeLoginClick?: () => void;
  onDolikeLogoutClick?: () => void;
  onNewClick?: () => void;
  showXsmm?: boolean;
  showNvc?: boolean;
  showDolike?: boolean;
  hideTiktok?: boolean;
  hideInstagram?: boolean;
  hideFacebook?: boolean;
}

export function AppHeader({
  pageTitle,
  activePlatform = "facebook",
  onPlatformChange,
  xsmmAccount,
  onXsmmLoginClick,
  onXsmmLogoutClick,
  nvcAccount,
  onNvcLoginClick,
  onNvcLogoutClick,
  dolikeAccount,
  onDolikeLoginClick,
  onDolikeLogoutClick,
  onNewClick,
  showXsmm = true,
  showNvc = false,
  showDolike = false,
  hideTiktok = false,
  hideInstagram = false,
  hideFacebook = false,
}: AppHeaderProps) {
  const { i18n } = useTranslation();
  const isVi = (i18n.language?.split("-")[0] || "vi") === "vi";
  const [platform, setPlatform] = useState<OperatingSystem>("macos");

  useEffect(() => {
    setPlatform(getCurrentOS());
  }, []);

  const isMacOS = platform === "macos";

  return (
    <header
      data-tauri-drag-region
      className={cn(
        "relative flex h-11 w-full shrink-0 select-none items-center justify-between border-b border-border/40 bg-background/80 px-4 backdrop-blur-md",
        isMacOS ? "pl-20" : "pr-[136px]",
      )}
    >
      {/* Left: App Logo + Platform Tabs (TikTok, Facebook & Instagram) */}
      <div
        data-tauri-drag-region
        className="flex items-center gap-2 pointer-events-auto"
      >
        {!isMacOS && (
          <div
            data-tauri-drag-region
            className="flex items-center gap-1.5 mr-2 font-semibold text-xs tracking-wide text-foreground/85 select-none pointer-events-none"
          >
            <Logo className="size-4.5 rounded-sm" />
            <span>AutoLunex</span>
          </div>
        )}
        {!hideTiktok && (
          <button
            type="button"
            onClick={() => onPlatformChange?.("tiktok")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-medium transition-all cursor-pointer",
              activePlatform === "tiktok"
                ? "border-foreground/35 bg-foreground/15 text-foreground font-semibold shadow-xs"
                : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <TiktokIcon className="size-3.5 text-foreground" />
            <span>TikTok</span>
          </button>
        )}

        {!hideFacebook && (
          <button
            type="button"
            onClick={() => onPlatformChange?.("facebook")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-medium transition-all cursor-pointer",
              activePlatform === "facebook"
                ? "border-[#1877F2]/40 bg-[#1877F2]/15 text-[#1877F2] font-semibold shadow-xs"
                : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <FaFacebook className="size-3.5 text-[#1877F2]" />
            <span>Facebook</span>
          </button>
        )}

        {!hideInstagram && (
          <button
            type="button"
            onClick={() => onPlatformChange?.("instagram")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-medium transition-all cursor-pointer",
              activePlatform === "instagram"
                ? "border-[#E1306C]/40 bg-[#E1306C]/15 text-[#E1306C] font-semibold shadow-xs"
                : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <FaInstagram className="size-3.5 text-[#E1306C]" />
            <span>Instagram</span>
          </button>
        )}

        {pageTitle && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-1">
            <span className="text-muted-foreground/30">/</span>
            <span>{pageTitle}</span>
          </div>
        )}
      </div>

      {/* Right: XSMM & NVC & DoLike User + Balance & Action */}
      <div className="flex items-center gap-2.5 pointer-events-auto">
        {showXsmm &&
          (xsmmAccount?.isLoggedIn ? (
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1 text-xs">
              {/* User */}
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <User className="size-3.5 text-primary" />
                <span className="max-w-[120px] truncate">
                  {xsmmAccount.username}
                </span>
              </div>

              <span className="h-3 w-px bg-border" />

              {/* Balance */}
              <div className="flex items-center gap-1 font-semibold text-emerald-400">
                <Coins className="size-3.5 text-amber-400" />
                <span>{xsmmAccount.balance}</span>
              </div>

              {/* Logout button */}
              {onXsmmLogoutClick && (
                <button
                  type="button"
                  onClick={onXsmmLogoutClick}
                  title={isVi ? "Đăng xuất XSMM" : "Sign out XSMM"}
                  className="ml-0.5 text-muted-foreground/60 hover:text-destructive transition-colors cursor-pointer"
                >
                  <LogOut className="size-3.5" />
                </button>
              )}
            </div>
          ) : (
            onXsmmLoginClick && (
              <button
                type="button"
                onClick={onXsmmLoginClick}
                className="flex h-7 items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer"
              >
                <Key className="size-3" />
                <span>{isVi ? "Đăng nhập XSMM" : "Sign in XSMM"}</span>
              </button>
            )
          ))}

        {showNvc &&
          (nvcAccount?.isLoggedIn ? (
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1 text-xs">
              {/* User */}
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <User className="size-3.5 text-blue-400" />
                <span className="max-w-[120px] truncate">
                  {nvcAccount.username}
                </span>
              </div>

              <span className="h-3 w-px bg-border" />

              {/* Balance */}
              <div className="flex items-center gap-1 font-semibold text-blue-400">
                <Coins className="size-3.5 text-amber-400" />
                <span>{nvcAccount.balance}</span>
              </div>

              {/* Logout button */}
              {onNvcLogoutClick && (
                <button
                  type="button"
                  onClick={onNvcLogoutClick}
                  title={isVi ? "Đăng xuất NVC" : "Sign out NVC"}
                  className="ml-0.5 text-muted-foreground/60 hover:text-destructive transition-colors cursor-pointer"
                >
                  <LogOut className="size-3.5" />
                </button>
              )}
            </div>
          ) : (
            onNvcLoginClick && (
              <button
                type="button"
                onClick={onNvcLoginClick}
                className="flex h-7 items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 text-xs font-medium text-blue-400 hover:bg-blue-500/20 transition-colors cursor-pointer"
              >
                <Key className="size-3" />
                <span>{isVi ? "Đăng nhập NVC" : "Sign in NVC"}</span>
              </button>
            )
          ))}

        {showDolike &&
          (dolikeAccount?.isLoggedIn ? (
            <div
              className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1 text-xs"
              title={`Tài khoản DoLike: ${dolikeAccount.email || dolikeAccount.username}${dolikeAccount.userId ? ` | UID: ${dolikeAccount.userId}` : ""} | Số dư: ${dolikeAccount.balance}`}
            >
              {/* User */}
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <User className="size-3.5 text-fuchsia-400" />
                <span className="max-w-[120px] truncate">
                  {dolikeAccount.username}
                </span>
              </div>

              <span className="h-3 w-px bg-border" />

              {/* Balance */}
              <div className="flex items-center gap-1 font-semibold text-fuchsia-400">
                <Coins className="size-3.5 text-amber-400" />
                <span>{dolikeAccount.balance}</span>
              </div>

              {/* Logout button */}
              {onDolikeLogoutClick && (
                <button
                  type="button"
                  onClick={onDolikeLogoutClick}
                  title={isVi ? "Đăng xuất DoLike" : "Sign out DoLike"}
                  className="ml-0.5 text-muted-foreground/60 hover:text-destructive transition-colors cursor-pointer"
                >
                  <LogOut className="size-3.5" />
                </button>
              )}
            </div>
          ) : (
            onDolikeLoginClick && (
              <button
                type="button"
                onClick={onDolikeLoginClick}
                className="flex h-7 items-center gap-1.5 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 px-2.5 text-xs font-medium text-fuchsia-400 hover:bg-fuchsia-500/20 transition-colors cursor-pointer"
              >
                <Key className="size-3" />
                <span>{isVi ? "Kết nối DoLike" : "Connect DoLike"}</span>
              </button>
            )
          ))}

        {/* Quản lý thiết bị Android USB (ADB) */}
        <UsbDeviceHub />

        {onNewClick && (
          <Button
            size="sm"
            onClick={onNewClick}
            className="flex h-7 items-center gap-1 px-2.5 text-xs cursor-pointer shadow-xs font-medium"
          >
            <span>{isVi ? "+ Mới" : "+ New"}</span>
          </Button>
        )}
      </div>
    </header>
  );
}
