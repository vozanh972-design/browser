"use client";

import { Headset, Key } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

// Tạo seed ngẫu nhiên lần đầu, lưu localStorage để dùng mãi mãi cho mỗi máy
function getOrCreateAvatarSeed(): string {
  const SEED_KEY = "autolunex_avatar_seed";
  try {
    const existing = localStorage.getItem(SEED_KEY);
    if (existing) return existing;
    let seed = "";
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      seed = crypto.randomUUID();
    } else if (
      typeof crypto !== "undefined" &&
      typeof crypto.getRandomValues === "function"
    ) {
      seed = Array.from(crypto.getRandomValues(new Uint8Array(8)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } else {
      seed = `user_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }
    localStorage.setItem(SEED_KEY, seed);
    return seed;
  } catch {
    return "default_user";
  }
}

// Dicebear HTTP API v10 — style "notionists-neutral" (tối giản, sang trọng, hợp theme tối)
function buildAvatarUrl(seed: string): string {
  return `https://api.dicebear.com/10.x/notionists-neutral/svg?seed=${encodeURIComponent(seed)}&backgroundColor=transparent`;
}

interface KeyLoginScreenProps {
  onUnlock: (key: string) => void;
}

export function KeyLoginScreen({ onUnlock }: KeyLoginScreenProps) {
  const [key, setKey] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const seed = getOrCreateAvatarSeed();
    setAvatarUrl(buildAvatarUrl(seed));
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      inputRef.current?.focus();
      return;
    }
    onUnlock(trimmed);
  }

  function handleChange(v: string) {
    setKey(v);
    if (error) setError(false);
  }

  function openUrl(url: string) {
    import("@tauri-apps/plugin-opener")
      .then(({ openUrl: open }) => open(url))
      .catch(() => window.open(url, "_blank"));
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background select-none overflow-hidden">
      {/* Center content — floats on raw bg like macOS */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="flex flex-col items-center gap-4"
      >
        {/* Avatar circle — Dicebear API, duy nhất cho mỗi máy cài đặt */}
        <div className="size-[88px] rounded-full bg-muted/80 border border-border/60 flex items-center justify-center shadow-lg overflow-hidden">
          {avatarUrl ? (
            // biome-ignore lint/performance/noImgElement: dynamic external avatar URL
            <img
              src={avatarUrl}
              alt="User avatar"
              className="size-full object-cover"
              draggable={false}
            />
          ) : (
            // Fallback silhouette khi chưa load xong
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
        </div>

        {/* Giữ nguyên mô tả, đã bỏ chữ AutoLunex */}
        <p className="text-[12px] text-muted-foreground -mt-1">
          Nhập key kích hoạt để tiếp tục
        </p>

        {/* Input + submit — pill style like macOS */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col items-center gap-2.5 w-[280px]"
        >
          <div
            className={`relative w-full transition-all duration-200 ${shake ? "animate-[shake_0.4s_ease-in-out]" : ""}`}
          >
            <input
              ref={inputRef}
              type="text"
              value={key}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="Nhập license key"
              autoComplete="off"
              spellCheck={false}
              className={`w-full rounded-full border px-5 py-2 text-[13px] text-center font-mono tracking-widest placeholder:text-muted-foreground/40 placeholder:tracking-normal placeholder:font-sans outline-none transition-all bg-muted/40 backdrop-blur-sm ${
                error
                  ? "border-destructive/60 ring-2 ring-destructive/20 bg-destructive/5"
                  : "border-border/50 focus:border-primary/30 focus:ring-2 focus:ring-primary/10 dark:focus:border-white/20"
              }`}
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-full bg-foreground/10 hover:bg-foreground/15 active:scale-[0.97] border border-border/40 text-foreground text-[13px] font-medium py-2 transition-all cursor-pointer"
          >
            Xác nhận
          </button>
        </form>
      </motion.div>

      {/* Bottom bar — Mua Key + CSKH (đều mở lunex.io.vn) */}
      <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-10">
        {/* Mua Key — link lunex.io.vn */}
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

        {/* CSKH — link lunex.io.vn */}
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

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-6px); }
          40%       { transform: translateX(6px); }
          60%       { transform: translateX(-4px); }
          80%       { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}
