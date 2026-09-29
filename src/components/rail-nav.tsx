"use client";

import { Boxes, User } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { GoGear, GoKebabHorizontal } from "react-icons/go";
import { launchLogoClone } from "@/lib/logo-physics";
import { cn } from "@/lib/utils";
import { Logo } from "./icons/logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export type AppPage =
  | "profiles"
  | "ttc"
  | "nvc"
  | "gl"
  | "proxies"
  | "groups"
  | "vpns"
  | "settings"
  | "account"
  | "reg-page";

const CLICK_THRESHOLD = 5;
const CLICK_WINDOW_MS = 2000;
const LOGO_HIDDEN_KEY = "autolunex-logo-hidden";

function useLogoEasterEgg({
  currentPage,
  onNavigate,
}: {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
}) {
  const clickTimestamps = useRef<number[]>([]);
  const [isPressed, setIsPressed] = useState(false);
  const [wobbleKey, setWobbleKey] = useState(0);
  const [isFalling, setIsFalling] = useState(false);
  const [growStep, setGrowStep] = useState(0);
  const resetTimeoutRef = useRef<number | null>(null);
  const [isHidden, setIsHidden] = useState(() => {
    try {
      return sessionStorage.getItem(LOGO_HIDDEN_KEY) === "1";
    } catch {
      return false;
    }
  });
  const logoRef = useRef<HTMLButtonElement>(null);
  const cancelFallRef = useRef<(() => void) | null>(null);

  const triggerFall = useCallback(() => {
    const el = logoRef.current;
    if (!el || isFalling) return;
    setIsFalling(true);
    cancelFallRef.current = launchLogoClone(el, {
      onExit: () => {
        try {
          sessionStorage.setItem(LOGO_HIDDEN_KEY, "1");
        } catch {
          // ignore
        }
        setIsHidden(true);
        setIsFalling(false);
      },
    });
  }, [isFalling]);

  useEffect(() => {
    return () => {
      cancelFallRef.current?.();
    };
  }, []);

  const handleClick = useCallback(() => {
    if (isFalling || isHidden) return;
    if (currentPage !== "profiles") {
      onNavigate("profiles");
      clickTimestamps.current = [];
      setGrowStep(0);
      if (resetTimeoutRef.current !== null) {
        window.clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }
      return;
    }
    const now = Date.now();
    clickTimestamps.current = clickTimestamps.current.filter(
      (t) => now - t < CLICK_WINDOW_MS,
    );
    clickTimestamps.current.push(now);
    if (clickTimestamps.current.length >= CLICK_THRESHOLD) {
      clickTimestamps.current = [];
      setGrowStep(0);
      if (resetTimeoutRef.current !== null) {
        window.clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }
      triggerFall();
    } else {
      setGrowStep(
        Math.min(clickTimestamps.current.length, CLICK_THRESHOLD - 1),
      );
      setWobbleKey((k) => k + 1);
      if (resetTimeoutRef.current !== null) {
        window.clearTimeout(resetTimeoutRef.current);
      }
      resetTimeoutRef.current = window.setTimeout(() => {
        clickTimestamps.current = [];
        setGrowStep(0);
        resetTimeoutRef.current = null;
      }, CLICK_WINDOW_MS);
    }
  }, [currentPage, isFalling, isHidden, onNavigate, triggerFall]);

  useEffect(() => {
    if (currentPage !== "profiles") {
      clickTimestamps.current = [];
      setGrowStep(0);
      if (resetTimeoutRef.current !== null) {
        window.clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }
    }
  }, [currentPage]);

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current !== null) {
        window.clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  return {
    logoRef,
    isPressed,
    setIsPressed,
    wobbleKey,
    isFalling,
    isHidden,
    growStep,
    handleClick,
  };
}

interface RailNavProps {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  onOpenAbout: () => void;
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
  { page: "gl", textLabel: "GL", labelKey: "GL" },
];

export function RailNav({
  currentPage,
  onNavigate,
  onOpenUtilities,
}: RailNavProps) {
  const { t, i18n } = useTranslation();
  const isVi = (i18n.language?.split("-")[0] || "vi") === "vi";
  const [moreOpen, setMoreOpen] = useState(false);
  const visibleTopItems = TOP_ITEMS;

  const {
    logoRef,
    isPressed,
    setIsPressed,
    wobbleKey,
    isFalling,
    isHidden,
    growStep,
    handleClick,
  } = useLogoEasterEgg({ currentPage, onNavigate });

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
      {/* Pill container — Apple dock style */}
      <div
        className={cn(
          "flex items-center gap-1 rounded-2xl border border-border/50",
          "bg-card/60 px-2 py-1.5 shadow-[0_8px_30px_rgb(0,0,0,0.25)] backdrop-blur-xl",
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-center px-1">
          {!isHidden ? (
            <button
              ref={logoRef}
              type="button"
              aria-label={t("header.appLogo", "AutoLunex Logo")}
              className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-xl bg-transparent select-none"
              onClick={handleClick}
              onPointerDown={() => setIsPressed(true)}
              onPointerUp={() => setIsPressed(false)}
              onPointerLeave={() => setIsPressed(false)}
            >
              <span
                style={{
                  transform: isPressed
                    ? `scale(${(1 + growStep * 0.25) * 0.9})`
                    : `scale(${1 + growStep * 0.25})`,
                }}
                className="inline-grid place-items-center transition-transform duration-300 ease-out"
              >
                <span
                  key={wobbleKey}
                  className={cn(
                    "inline-grid place-items-center",
                    !isFalling &&
                      !isPressed &&
                      wobbleKey > 0 &&
                      "animate-[wiggle_0.3s_ease-in-out]",
                  )}
                >
                  <Logo className="size-5" />
                </span>
              </span>
            </button>
          ) : (
            <div className="size-8 shrink-0" />
          )}
        </div>

        {/* Divider */}
        <div className="mx-1 h-5 w-px shrink-0 rounded-full bg-border" />

        {/* Main nav items */}
        {visibleTopItems.map(({ page, Icon, textLabel, labelKey }) => {
          const active = currentPage === page;
          return (
            <Tooltip key={page} delayDuration={400}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onNavigate(page)}
                  aria-label={t(labelKey, labelKey)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl transition-colors duration-150",
                    active
                      ? "text-foreground font-semibold"
                      : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="dockActivePill"
                      className="absolute inset-0 rounded-xl bg-foreground/10"
                      transition={{
                        type: "spring",
                        stiffness: 450,
                        damping: 32,
                        mass: 0.6,
                      }}
                    />
                  )}
                  <span className="relative z-10 flex items-center justify-center">
                    {Icon ? (
                      <Icon className="size-[18px]" />
                    ) : (
                      <span className="text-[11px] font-bold tracking-tight">
                        {textLabel}
                      </span>
                    )}
                  </span>
                  {active && (
                    <motion.span
                      layoutId="dockActiveDot"
                      className="absolute bottom-1 left-1/2 z-10 size-1 -translate-x-1/2 rounded-full bg-foreground"
                      transition={{
                        type: "spring",
                        stiffness: 450,
                        damping: 32,
                        mass: 0.6,
                      }}
                    />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>
                {t(labelKey, labelKey)}
              </TooltipContent>
            </Tooltip>
          );
        })}

        {/* Divider */}
        <div className="mx-1 h-5 w-px shrink-0 rounded-full bg-border" />

        {/* Settings */}
        <Tooltip delayDuration={400}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onNavigate("settings")}
              aria-label={t("rail.settings")}
              aria-current={currentPage === "settings" ? "page" : undefined}
              className={cn(
                "relative grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl transition-colors duration-150",
                currentPage === "settings"
                  ? "text-foreground"
                  : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
              )}
            >
              {currentPage === "settings" && (
                <motion.div
                  layoutId="dockActivePill"
                  className="absolute inset-0 rounded-xl bg-foreground/10"
                  transition={{
                    type: "spring",
                    stiffness: 450,
                    damping: 32,
                    mass: 0.6,
                  }}
                />
              )}
              <GoGear className="relative z-10 size-[18px]" />
              {currentPage === "settings" && (
                <motion.span
                  layoutId="dockActiveDot"
                  className="absolute bottom-1 left-1/2 z-10 size-1 -translate-x-1/2 rounded-full bg-foreground"
                  transition={{
                    type: "spring",
                    stiffness: 450,
                    damping: 32,
                    mass: 0.6,
                  }}
                />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={8}>
            {t("rail.settings")}
          </TooltipContent>
        </Tooltip>

        {/* More 3-dots button */}
        <Tooltip delayDuration={400}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-label={t("rail.more.label", "More")}
              aria-expanded={moreOpen}
              className={cn(
                "grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl transition-all duration-150",
                moreOpen
                  ? "bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
              )}
            >
              <GoKebabHorizontal className="size-[18px]" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={8}>
            {t("rail.more.label", "More")}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* More popup — ONLY Tiện ích (About AutoLunex is removed!) */}
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
