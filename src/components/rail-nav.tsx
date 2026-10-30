"use client";

import { Boxes, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { GoGear, GoKebabHorizontal } from "react-icons/go";
import { cn } from "@/lib/utils";
import { Logo } from "./icons/logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export type AppPage =
  | "overview"
  | "profiles"
  | "ttc"
  | "nvc"
  | "dolike"
  | "proxies"
  | "groups"
  | "vpns"
  | "settings"
  | "account"
  | "reg-page";

interface RailNavProps {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  onOpenAbout?: () => void;
  onOpenUtilities?: () => void;
}

interface RailItem {
  page: AppPage;
  Icon?: React.ComponentType<{ className?: string }>;
  textLabel?: string;
  labelKey: string;
}

const TOP_ITEMS: RailItem[] = [
  { page: "profiles", Icon: User, labelKey: "XSMM" },
  { page: "ttc", textLabel: "TTC", labelKey: "TTC" },
  { page: "nvc", textLabel: "NVC", labelKey: "NVC" },
  { page: "dolike", textLabel: "DL", labelKey: "DoLike" },
];

interface DockNavItemProps {
  page: AppPage;
  active: boolean;
  labelKey: string;
  textLabel?: string;
  isProfiles: boolean;
  isTtc: boolean;
  isNvc: boolean;
  isDolike: boolean;
  onNavigate: (page: AppPage) => void;
}

function DockNavItem({
  page,
  active,
  labelKey,
  textLabel,
  isProfiles,
  isTtc,
  isNvc,
  isDolike,
  onNavigate,
}: DockNavItemProps) {
  const { t } = useTranslation();

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => onNavigate(page)}
          aria-label={t(labelKey, labelKey)}
          aria-current={active ? "page" : undefined}
          className={cn(
            "relative flex h-8 px-2.5 shrink-0 cursor-pointer items-center justify-center rounded-xl select-none text-xs font-semibold transition-colors duration-150",
            active
              ? "bg-foreground/[0.08] dark:bg-white/[0.12] ring-1 ring-foreground/10 dark:ring-white/10 shadow-xs text-foreground"
              : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
          )}
        >
          <span
            className={cn(
              "text-[11px] font-bold tracking-tight whitespace-nowrap",
              active && isProfiles && "text-amber-400",
              active && isTtc && "text-emerald-400 lowercase",
              active && isNvc && "text-blue-400 lowercase",
              active && isDolike && "text-fuchsia-400 lowercase",
            )}
          >
            {active
              ? isProfiles
                ? "XSMM"
                : isTtc
                  ? "tuongtaccheo"
                  : isNvc
                    ? "nhiemvucheo"
                    : isDolike
                      ? "dolike"
                      : textLabel
              : textLabel || (isProfiles ? "XSMM" : labelKey)}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        {isDolike && active
          ? "dolike"
          : isNvc && active
            ? "nhiemvucheo"
            : isTtc && active
              ? "tuongtaccheo"
              : isProfiles && active
                ? "XSMM"
                : t(labelKey, labelKey)}
      </TooltipContent>
    </Tooltip>
  );
}

function DockSettingsButton({
  active,
  onNavigate,
}: {
  active: boolean;
  onNavigate: (page: AppPage) => void;
}) {
  const { t } = useTranslation();

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => onNavigate("settings")}
          aria-label={t("rail.settings")}
          aria-current={active ? "page" : undefined}
          className={cn(
            "grid size-8 shrink-0 cursor-pointer place-items-center rounded-xl transition-colors duration-150",
            active
              ? "bg-foreground/[0.08] dark:bg-white/[0.12] ring-1 ring-foreground/10 dark:ring-white/10 shadow-xs text-foreground"
              : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
          )}
        >
          <GoGear className="size-[17px]" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        {t("rail.settings")}
      </TooltipContent>
    </Tooltip>
  );
}

function DockMoreButton({
  moreOpen,
  setMoreOpen,
}: {
  moreOpen: boolean;
  setMoreOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { t } = useTranslation();

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          aria-label={t("rail.more.label", "More")}
          aria-expanded={moreOpen}
          className={cn(
            "grid size-8 shrink-0 cursor-pointer place-items-center rounded-xl transition-colors duration-150",
            moreOpen
              ? "bg-foreground/10 text-foreground"
              : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
          )}
        >
          <GoKebabHorizontal className="size-[17px]" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        {t("rail.more.label", "More")}
      </TooltipContent>
    </Tooltip>
  );
}

export function RailNav({
  currentPage,
  onNavigate,
  onOpenUtilities,
}: RailNavProps) {
  const { t, i18n } = useTranslation();
  const isVi = (i18n.language?.split("-")[0] || "vi") === "vi";
  const [moreOpen, setMoreOpen] = useState(false);
  const visibleTopItems = TOP_ITEMS;

  useEffect(() => {
    if (!moreOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [moreOpen]);

  return (
    <div
      className={cn(
        "relative flex w-full shrink-0 items-center justify-center",
        "bg-transparent px-4 pb-3.5 pt-1 select-none",
      )}
    >
      {/* Pill container — Simple, clean dock without physics/magnification */}
      <div
        className={cn(
          "flex items-center gap-1 rounded-2xl border border-border/50",
          "bg-card/85 px-2 py-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-2xl",
          "ring-1 ring-white/10 dark:ring-white/5",
        )}
      >
        {/* Logo -> Chuyển sang Trang Tổng Quan */}
        <div className="flex items-center justify-center px-0.5">
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={t("header.appLogo", "Trang Tổng quan")}
                className={cn(
                  "grid size-8 shrink-0 cursor-pointer place-items-center rounded-xl transition-all select-none",
                  currentPage === "overview"
                    ? "bg-primary/20 text-primary ring-1 ring-primary/40 shadow-xs"
                    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                )}
                onClick={() =>
                  onNavigate(currentPage === "overview" ? "profiles" : "overview")
                }
              >
                <Logo className="size-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={8}>
              {currentPage === "overview"
                ? (isVi ? "Quay lại danh sách tài khoản" : "Back to accounts")
                : (isVi ? "Trang tổng quan hệ thống" : "System Overview")}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Divider */}
        <div className="mx-1 h-5 w-px shrink-0 rounded-full bg-border/60" />

        {/* Main nav items */}
        {visibleTopItems.map(({ page, textLabel, labelKey }) => {
          const active = currentPage === page;
          const isProfiles = page === "profiles";
          const isTtc = page === "ttc";
          const isNvc = page === "nvc";
          const isDolike = page === "dolike";

          return (
            <DockNavItem
              key={page}
              page={page}
              active={active}
              labelKey={labelKey}
              textLabel={textLabel}
              isProfiles={isProfiles}
              isTtc={isTtc}
              isNvc={isNvc}
              isDolike={isDolike}
              onNavigate={onNavigate}
            />
          );
        })}

        {/* Divider */}
        <div className="mx-1 h-5 w-px shrink-0 rounded-full bg-border/60" />

        {/* Settings */}
        <DockSettingsButton
          active={currentPage === "settings"}
          onNavigate={onNavigate}
        />

        {/* More 3-dots button */}
        <DockMoreButton
          moreOpen={moreOpen}
          setMoreOpen={setMoreOpen}
        />
      </div>

      {/* More popup — Tiện ích */}
      {moreOpen && (
        <>
          <button
            type="button"
            aria-label={t("rail.more.closeAriaLabel", "Close")}
            className="fixed inset-0 z-30 cursor-default bg-transparent"
            onClick={() => setMoreOpen(false)}
          />
          <div
            role="menu"
            aria-label={t("rail.more.label", "More")}
            className="surface-material-card absolute bottom-16 left-1/2 z-40 w-52 -translate-x-1/2 animate-in rounded-xl border border-border p-1 shadow-2xl duration-100 fade-in-0 slide-in-from-bottom-2"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMoreOpen(false);
                if (onOpenUtilities) {
                  onOpenUtilities();
                } else {
                  onNavigate("account");
                }
              }}
              className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent"
            >
              <Boxes className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-xs font-medium text-foreground">
                  {isVi ? "Tiện ích" : "Utilities"}
                </span>
                <span className="truncate text-[10px] text-muted-foreground">
                  {isVi
                    ? "Quản lý tài khoản & công cụ"
                    : "Account management & tools"}
                </span>
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
