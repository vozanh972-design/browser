"use client";

import { useEffect, useState } from "react";
import { LuPlus } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { getCurrentOS, type OperatingSystem } from "@/lib/platform";
import { cn } from "@/lib/utils";
import { Logo } from "./icons/logo";

interface AppHeaderProps {
  pageTitle?: string;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  onNewClick?: () => void;
}

export function AppHeader({
  pageTitle,
  searchQuery,
  onSearchQueryChange,
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
        "relative flex h-12 w-full shrink-0 select-none items-center justify-between border-b border-border/40 bg-background/80 px-4 backdrop-blur-md",
        isMacOS && "pl-20",
        isWindows && "pr-36",
      )}
    >
      {/* Left: Branding & Breadcrumb */}
      <div
        data-tauri-drag-region
        className="flex items-center gap-3 pointer-events-none"
      >
        <div className="flex items-center gap-2">
          <Logo className="size-5 shrink-0" />
          <span className="text-sm font-semibold tracking-tight text-foreground">
            AutoLunex
          </span>
        </div>
        {pageTitle && (
          <>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-xs font-medium text-muted-foreground">
              {pageTitle}
            </span>
          </>
        )}
      </div>

      {/* Center/Right: Action & Search Bar */}
      <div className="flex items-center gap-2 pointer-events-auto">
        {onSearchQueryChange !== undefined && (
          <div className="relative">
            <input
              type="text"
              value={searchQuery ?? ""}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Tìm kiếm..."
              className="h-7 w-44 rounded-lg border border-border bg-muted/30 px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
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
