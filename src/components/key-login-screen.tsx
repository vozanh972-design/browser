"use client";

import { invoke } from "@tauri-apps/api/core";
import { Headset, Key, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/icons/logo";

// ── Avatar seed (persistent per install) ─────────────────────────
function getOrCreateAvatarSeed(): string {
  const SEED_KEY = "autolunex_avatar_seed";
  try {
    const existing = localStorage.getItem(SEED_KEY);
    if (existing) return existing;
    const seed =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `user_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(SEED_KEY, seed);
    return seed;
  } catch {
    return "default_user";
  }
}

function buildAvatarUrl(seed: string): string {
  return `https://api.dicebear.com/10.x/lorelei/svg?seed=${encodeURIComponent(seed)}`;
}

// ── License API result type ───────────────────────────────────────
interface LicenseResult {
  success: boolean;
  status: string;
  message: string;
  days_left?: number | null;
  expired_at?: string | null;
}

// ── Status machine ────────────────────────────────────────────────
type VerifyStatus = "idle" | "loading" | "success" | "error";

// ── Props ─────────────────────────────────────────────────────────
interface KeyLoginScreenProps {
  onUnlock: (
    key: string,
    daysLeft: number | null,
    expiredAt: string | null,
  ) => void;
  /** If provided, the screen auto-submits this key on mount (recheck) */
  autoCheckKey?: string;
}

export function KeyLoginScreen({
  onUnlock,
  autoCheckKey,
}: KeyLoginScreenProps) {
  const [key, setKey] = useState("");
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>(
    autoCheckKey ? "loading" : "idle",
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [shakeCounter, setShakeCounter] = useState(0); // increment → re-trigger shake
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [avatarError, setAvatarError] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Init avatar + auto-focus
  useEffect(() => {
    const seed = getOrCreateAvatarSeed();
    setAvatarUrl(buildAvatarUrl(seed));
    if (!autoCheckKey) {
      inputRef.current?.focus();
    }
  }, [autoCheckKey]);

  // Auto-recheck saved key on mount (intentionally runs only once)
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only effect
  useEffect(() => {
    if (!autoCheckKey) return;
    void runVerify(autoCheckKey, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function openUrl(url: string) {
    import("@tauri-apps/plugin-opener")
      .then(({ openUrl: open }) => open(url))
      .catch(() => window.open(url, "_blank"));
  }

  // ── Core verify logic ─────────────────────────────────────────
  async function runVerify(keyToCheck: string, isAutoRecheck = false) {
    setVerifyStatus("loading");
    setErrorMsg("");

    try {
      const result = await invoke<LicenseResult>("verify_license", {
        key: keyToCheck,
      });

      if (result.success && result.status === "valid") {
        // ── SUCCESS animation ──
        setVerifyStatus("success");
        const dl =
          result.days_left != null ? Math.floor(result.days_left) : null;
        const ea = result.expired_at ?? null;
        if (dl != null) {
          setDaysLeft(dl);
        }
        // macOS-style: brief success state → dissolve out → unlock
        await delay(600);
        setIsExiting(true);
        await delay(450);
        onUnlock(keyToCheck, dl, ea);
      } else {
        if (isAutoRecheck) {
          // Failed recheck (network or invalid) — drop to input form
          if (result.status === "network_error") {
            // Offline tolerance: allow if key was previously saved
            onUnlock(keyToCheck, null, null);
            return;
          }
          setVerifyStatus("idle");
          setErrorMsg(result.message);
          inputRef.current?.focus();
          return;
        }
        triggerError(result.message);
      }
    } catch {
      if (isAutoRecheck) {
        // Tauri invoke failed (dev browser preview etc.) → allow
        onUnlock(keyToCheck, null, null);
        return;
      }
      triggerError(
        "Không thể kết nối đến máy chủ xác thực. Vui lòng kiểm tra mạng!",
      );
    }
  }

  function triggerError(msg: string) {
    setVerifyStatus("error");
    setErrorMsg(msg);
    setShakeCounter((n) => n + 1);
    setTimeout(() => {
      setVerifyStatus("idle");
      inputRef.current?.focus();
    }, 600);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) {
      triggerError("Vui lòng nhập mã key bản quyền!");
      return;
    }
    void runVerify(trimmed);
  }

  function handleChange(v: string) {
    setKey(v);
    if (verifyStatus === "error") {
      setVerifyStatus("idle");
      setErrorMsg("");
    }
  }

  const isLoading = verifyStatus === "loading";
  const isSuccess = verifyStatus === "success";
  const isError = verifyStatus === "error";

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background select-none overflow-hidden"
      animate={
        isExiting
          ? { opacity: 0, scale: 1.04, filter: "blur(4px)" }
          : { opacity: 1, scale: 1, filter: "blur(0px)" }
      }
      transition={
        isExiting
          ? { duration: 0.45, ease: [0.4, 0, 0.2, 1] }
          : { duration: 0.5, ease: [0.23, 1, 0.32, 1] }
      }
    >
      {/* Top Titlebar with app logo, app name, and drag region */}
      <div
        data-tauri-drag-region
        className="absolute top-0 inset-x-0 h-11 flex items-center justify-between px-4 select-none z-10 pointer-events-auto border-b border-border/20 bg-background/40 backdrop-blur-xs"
      >
        <div
          data-tauri-drag-region
          className="flex items-center gap-2 select-none pointer-events-none"
        >
          <Logo className="size-4.5 rounded-sm" />
          <span className="text-xs font-semibold tracking-wide text-foreground/85">
            AutoLunex
          </span>
        </div>
        <div data-tauri-drag-region className="flex-1 h-full" />
      </div>

      {/* Center content */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="flex flex-col items-center gap-4"
      >
        {/* Avatar circle */}
        <motion.div
          className="size-[88px] rounded-full bg-muted/80 border border-border/60 flex items-center justify-center shadow-lg overflow-hidden"
          animate={isSuccess ? { scale: [1, 1.08, 1] } : { scale: 1 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
        >
          {avatarUrl && !avatarError ? (
            // biome-ignore lint/performance/noImgElement: dynamic external avatar URL
            <img
              src={avatarUrl}
              alt="User avatar"
              className="size-full object-cover"
              draggable={false}
              onError={() => setAvatarError(true)}
            />
          ) : (
            <svg
              viewBox="0 0 88 88"
              fill="none"
              className="size-full"
              role="img"
              aria-label="User avatar"
            >
              <title>User avatar</title>
              <ellipse
                cx="44"
                cy="76"
                rx="26"
                ry="18"
                fill="currentColor"
                className="text-muted-foreground/40"
              />
              <circle
                cx="44"
                cy="34"
                r="18"
                fill="currentColor"
                className="text-muted-foreground/50"
              />
            </svg>
          )}
        </motion.div>

        {/* Description */}
        <p className="text-[12px] text-muted-foreground -mt-1">
          {isLoading && autoCheckKey
            ? "Đang xác minh bản quyền…"
            : isSuccess && daysLeft != null
              ? `Còn ${daysLeft} ngày sử dụng`
              : "Nhập key kích hoạt để tiếp tục"}
        </p>

        {/* Form — hidden when auto-rechecking */}
        {!(isLoading && autoCheckKey) && (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col items-center gap-2.5 w-[280px]"
          >
            {/* Input with macOS-style shake on error */}
            <motion.div
              key={shakeCounter}
              className="relative w-full"
              animate={
                isError
                  ? {
                      x: [0, -8, 8, -6, 6, -4, 4, -2, 2, 0],
                    }
                  : { x: 0 }
              }
              transition={{ duration: 0.45, ease: "easeInOut" }}
            >
              <input
                ref={inputRef}
                type="password"
                value={key}
                onChange={(e) => handleChange(e.target.value)}
                placeholder="Nhập license key"
                autoComplete="off"
                spellCheck={false}
                disabled={isLoading || isSuccess}
                className={`w-full rounded-full border px-5 py-2 text-[13px] text-center placeholder:text-muted-foreground/40 placeholder:font-sans outline-none transition-all bg-muted/40 backdrop-blur-sm disabled:opacity-50 ${
                  isError
                    ? "border-destructive/70 ring-2 ring-destructive/25 bg-destructive/5"
                    : "border-border/50 focus:border-primary/30 focus:ring-2 focus:ring-primary/10 dark:focus:border-white/20"
                }`}
              />
            </motion.div>

            {/* Error message */}
            <AnimatePresence>
              {errorMsg && (
                <motion.p
                  key="errmsg"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="text-[11px] text-destructive text-center px-2 -mt-1 leading-tight"
                >
                  {errorMsg}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Confirm button — macOS-style: loading spinner → success green */}
            <motion.button
              type="submit"
              disabled={isLoading || isSuccess}
              className={`w-full rounded-full border border-border/40 text-[13px] font-medium py-2 transition-colors duration-300 cursor-pointer flex items-center justify-center gap-2 ${
                isSuccess
                  ? "bg-green-500/20 border-green-500/40 text-green-400"
                  : "bg-foreground/10 hover:bg-foreground/15 active:scale-[0.97] text-foreground"
              } disabled:cursor-not-allowed`}
              animate={isSuccess ? { scale: [1, 0.97, 1.02, 1] } : { scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : isSuccess ? (
                <>
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-green-400"
                  >
                    ✓
                  </motion.span>
                  <span>Đã xác thực</span>
                </>
              ) : (
                "Xác nhận"
              )}
            </motion.button>
          </form>
        )}

        {/* Loading spinner for auto-recheck mode */}
        {isLoading && autoCheckKey && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-muted-foreground/60"
          >
            <Loader2 className="size-4 animate-spin" />
            <span className="text-[12px]">Vui lòng chờ…</span>
          </motion.div>
        )}
      </motion.div>

      {/* Bottom bar — Mua Key + CSKH (hidden when auto-rechecking) */}
      {!(isLoading && autoCheckKey) && (
        <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-10">
          <button
            type="button"
            onClick={() => openUrl("https://lunex.io.vn")}
            className="flex flex-col items-center gap-1.5 text-muted-foreground/60 hover:text-foreground transition-colors cursor-pointer group"
          >
            <div className="size-9 rounded-full border border-border/40 bg-muted/30 flex items-center justify-center group-hover:border-border/70 transition-colors">
              <Key className="size-4" />
            </div>
            <span className="text-[10px] tracking-wide">Mua Key</span>
          </button>

          <button
            type="button"
            onClick={() => openUrl("https://lunex.io.vn")}
            className="flex flex-col items-center gap-1.5 text-muted-foreground/60 hover:text-foreground transition-colors cursor-pointer group"
          >
            <div className="size-9 rounded-full border border-border/40 bg-muted/30 flex items-center justify-center group-hover:border-border/70 transition-colors">
              <Headset className="size-4" />
            </div>
            <span className="text-[10px] tracking-wide">CSKH</span>
          </button>
        </div>
      )}

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-6px); }
          40%       { transform: translateX(6px); }
          60%       { transform: translateX(-4px); }
          80%       { transform: translateX(4px); }
        }
      `}</style>
    </motion.div>
  );
}

// ── Tiny helper ───────────────────────────────────────────────────
function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
