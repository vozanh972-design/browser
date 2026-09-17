"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getCurrentOS, type OperatingSystem } from "@/lib/platform";
import { cn } from "@/lib/utils";
import { Logo } from "./icons/logo";

interface AppHeaderProps {
  pageTitle?: string;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
}

export function AppHeader({
  pageTitle,
  searchQuery,
  onSearchQueryChange,
}: AppHeaderProps) {
  const { t } = useTranslation();
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

      {/* Center/Right: Action or Search Bar */}
      {onSearchQueryChange !== undefined && (
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="relative">
            <input
              type="text"
              value={searchQuery ?? ""}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder={t("common.labels.search", "Search...")}
              className="h-7 w-48 rounded-lg border border-border bg-muted/30 px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      )}
    </header>
  );
}
