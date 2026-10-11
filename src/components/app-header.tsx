"use client";

import { Coins, Key, LogOut, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaFacebook, FaInstagram } from "react-icons/fa";
import { Logo } from "@/components/icons/logo";
import { Button } from "@/components/ui/button";
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
}

interface AppHeaderProps {
  pageTitle?: string;
  activePlatform?: "facebook" | "instagram";
  onPlatformChange?: (platform: "facebook" | "instagram") => void;
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
      {/* Left: App Logo + Platform Tabs (Facebook & Instagram) */}
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
