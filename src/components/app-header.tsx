"use client";

import { useEffect, useState } from "react";
import { LuCoins, LuKey, LuLogOut, LuPlus, LuUser } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { getCurrentOS, type OperatingSystem } from "@/lib/platform";
import { cn } from "@/lib/utils";
import { Logo } from "./icons/logo";

export interface XsmmAccountInfo {
  username: string;
  balance: string;
  isLoggedIn: boolean;
}

interface AppHeaderProps {
  pageTitle?: string;
  xsmmAccount?: XsmmAccountInfo;
  onXsmmLoginClick?: () => void;
  onXsmmLogoutClick?: () => void;
  onNewClick?: () => void;
}

export function AppHeader({
  pageTitle,
  xsmmAccount,
  onXsmmLoginClick,
  onXsmmLogoutClick,
  onNewClick,
}: AppHeaderProps) {
  const [platform, setPlatform] = useState<OperatingSystem>("macos");

  useEffect(() => {
    setPlatform(getCurrentOS());
  }, []);

  const isMacOS = platform === "macos";
  const isWindows = platform === "windows";

  return (
    <header
      data-tauri-drag-region
      className={cn(
        "relative flex h-11 w-full shrink-0 select-none items-center justify-between border-b border-border/40 bg-background/80 px-4 backdrop-blur-md",
        isMacOS && "pl-20",
        isWindows && "pr-36",
      )}
    >
      {/* Left: Branding & Breadcrumb */}
      <div
        data-tauri-drag-region
        className="flex items-center gap-2.5 pointer-events-none"
      >
        <div className="flex items-center gap-2">
          <Logo className="size-4.5 shrink-0" />
          <span className="text-xs font-semibold tracking-tight text-foreground">
            AutoLunex
          </span>
        </div>
        {pageTitle && (
          <>
            <span className="text-muted-foreground/30">/</span>
            <span className="text-xs font-medium text-muted-foreground">
              {pageTitle}
            </span>
          </>
        )}
      </div>

      {/* Right: XSMM User + Balance & Action */}
      <div className="flex items-center gap-2.5 pointer-events-auto">
        {xsmmAccount?.isLoggedIn ? (
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1 text-xs">
            {/* User */}
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <LuUser className="size-3.5 text-primary" />
              <span className="max-w-[120px] truncate">
                {xsmmAccount.username}
              </span>
            </div>

            <span className="h-3 w-px bg-border" />

            {/* Balance */}
            <div className="flex items-center gap-1 font-semibold text-emerald-400">
              <LuCoins className="size-3.5 text-amber-400" />
              <span>{xsmmAccount.balance}</span>
            </div>

            {/* Logout button */}
            {onXsmmLogoutClick && (
              <button
                type="button"
                onClick={onXsmmLogoutClick}
                title="Đăng xuất XSMM"
                className="ml-0.5 text-muted-foreground/60 hover:text-destructive transition-colors cursor-pointer"
              >
                <LuLogOut className="size-3.5" />
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
              <LuKey className="size-3" />
              <span>Đăng nhập XSMM</span>
            </button>
          )
        )}

        {onNewClick && (
          <Button
            size="sm"
            onClick={onNewClick}
            className="flex h-7 items-center gap-1 px-2.5 text-xs cursor-pointer shadow-xs font-medium"
          >
            <LuPlus className="size-3.5" />
            <span>+ Mới</span>
          </Button>
        )}
      </div>
    </header>
  );
}
