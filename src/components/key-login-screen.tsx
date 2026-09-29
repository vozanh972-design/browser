"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { LuKey, LuShieldCheck } from "react-icons/lu";

interface KeyLoginScreenProps {
  onUnlock: (key: string) => void;
}

export function KeyLoginScreen({ onUnlock }: KeyLoginScreenProps) {
  const [key, setKey] = useState("");
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) {
      setError(true);
      return;
    }
    onUnlock(trimmed);
  }

  function handleChange(v: string) {
    setKey(v);
    if (error) setError(false);
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background select-none overflow-hidden">
      {/* Subtle ambient orb — top center */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 size-[520px] rounded-full opacity-[0.07] dark:opacity-[0.10]"
        style={{
          background:
            "radial-gradient(circle, #6c6cff 0%, #a78bfa 40%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
        className="relative z-10 w-full max-w-[340px] rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-2xl px-8 pt-10 pb-8 flex flex-col items-center gap-6"
        style={{
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.05) inset, 0 20px 60px rgba(0,0,0,0.25)",
        }}
      >
        {/* Icon badge */}
        <div className="flex items-center justify-center size-14 rounded-2xl bg-primary/8 dark:bg-white/6 border border-border/60 shadow-xs mb-1">
          <LuShieldCheck className="size-7 text-primary dark:text-white/80" />
        </div>

        {/* Heading */}
        <div className="text-center space-y-1">
          <h1 className="text-[17px] font-semibold tracking-tight text-foreground leading-tight">
            Nhập License Key
          </h1>
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            Vui lòng nhập key để tiếp tục sử dụng ứng dụng.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
          <div className="relative">
            <LuKey
              className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none"
              aria-hidden
            />
            <input
              ref={inputRef}
              type="text"
              value={key}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              autoComplete="off"
              spellCheck={false}
              className={`w-full rounded-xl border bg-input/60 dark:bg-white/[0.06] pl-9 pr-4 py-2.5 text-[13px] font-mono tracking-widest placeholder:text-muted-foreground/40 placeholder:tracking-normal outline-none transition-all ${
                error
                  ? "border-destructive/60 ring-2 ring-destructive/20"
                  : "border-border/60 focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
              }`}
            />
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[11px] text-destructive-text dark:text-destructive pl-1"
            >
              Vui lòng nhập key hợp lệ.
            </motion.p>
          )}

          <button
            type="submit"
            className="w-full mt-1 rounded-xl bg-primary text-primary-foreground py-2.5 text-[13px] font-semibold tracking-tight hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-xs"
          >
            Xác nhận
          </button>
        </form>
      </motion.div>

      {/* Bottom version hint */}
      <p className="absolute bottom-5 text-[11px] text-muted-foreground/40 tracking-wide select-none">
        Liên hệ admin để nhận key kích hoạt
      </p>
    </div>
  );
}
