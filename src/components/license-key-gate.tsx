"use client";

import { openUrl } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  LuArrowRight,
  LuExternalLink,
  LuHeadset,
  LuKeyRound,
  LuShieldCheck,
  LuZap,
} from "react-icons/lu";
import { cn } from "@/lib/utils";

const GET_KEY_URL = "https://lunex.io.vn";

const LICENSE_KEY_STORAGE_KEY = "donut-license-key";

/** Reads any previously stored license key so the gate can be skipped. */
export function getStoredLicenseKey(): string | null {
  try {
    return localStorage.getItem(LICENSE_KEY_STORAGE_KEY);
  } catch {
    return null;
  }
}

interface LicenseKeyGateProps {
  onContinue: (key: string) => void;
}

const FOOTER_ITEMS = [
  {
    Icon: LuShieldCheck,
    title: "Secure & Encrypted",
    subtitle: "Your data is protected",
  },
  {
    Icon: LuZap,
    title: "Instant Access",
    subtitle: "Fast and reliable",
  },
  {
    Icon: LuHeadset,
    title: "24/7 Support",
    subtitle: "We're here to help",
  },
] as const;

/**
 * Pre-app gate screen: the very first thing shown before the main profiles
 * interface. Purely presentational — it collects a license key and hands it
 * back to the caller via `onContinue`, which decides how/whether to persist
 * or validate it. No other app functionality is touched.
 */
export function LicenseKeyGate({ onContinue }: LicenseKeyGateProps) {
  const [key, setKey] = useState("");
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleContinue = useCallback(() => {
    const trimmed = key.trim();
    if (!trimmed) {
      setError(true);
      return;
    }
    setError(false);
    try {
      localStorage.setItem(LICENSE_KEY_STORAGE_KEY, trimmed);
    } catch {
      // Non-fatal: proceed even if persistence fails.
    }
    onContinue(trimmed);
  }, [key, onContinue]);

  return (
    <div className="flex h-dvh flex-col bg-[#050505] text-white">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6">
        <div className="flex w-full max-w-[560px] flex-col items-center">
          <div
            className="mb-6 flex size-[88px] items-center justify-center rounded-full border"
            style={{
              borderColor: "rgba(226, 111, 81, 0.55)",
              backgroundColor: "#141212",
              boxShadow:
                "0 0 0 1px rgba(226,111,81,0.08), 0 0 40px 4px rgba(226,111,81,0.25)",
            }}
          >
            <LuKeyRound className="size-9 text-white" />
          </div>

          <h1 className="text-center text-[28px] font-bold tracking-tight text-white">
            Enter Your Key
          </h1>
          <p className="mt-2.5 text-center text-sm text-[#9a9a9a]">
            Enter your license key to continue and access your profiles.
          </p>

          <div className="mt-7 w-full">
            <div
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border bg-[#0d0d0d] px-4 py-3.5 transition-colors",
                error ? "border-destructive" : "border-white/10",
              )}
            >
              <LuKeyRound className="size-4 shrink-0 text-[#8a8a8a]" />
              <input
                ref={inputRef}
                value={key}
                onChange={(e) => {
                  setKey(e.target.value);
                  if (error) setError(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleContinue();
                  }
                }}
                placeholder="Paste or type your key here..."
                spellCheck={false}
                className="w-full min-w-0 bg-transparent text-sm text-white placeholder:text-[#6b6b6b] focus:outline-none"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleContinue}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-[15px] font-semibold text-white shadow-lg transition-opacity hover:opacity-90 active:opacity-80"
            style={{
              background: "linear-gradient(90deg, #d97757 0%, #b3554a 100%)",
            }}
          >
            Continue
            <LuArrowRight className="size-4" />
          </button>

          <div className="mt-7 flex w-full items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="shrink-0 text-xs text-[#7a7a7a]">
              Don&apos;t have a key?
            </span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <button
            type="button"
            onClick={() => void openUrl(GET_KEY_URL)}
            className="mt-5 flex items-center gap-2 rounded-lg border border-white/10 bg-transparent px-4 py-2 text-sm text-white transition-colors hover:bg-white/5"
          >
            Get a Key
            <LuExternalLink className="size-3.5 text-[#9a9a9a]" />
          </button>
        </div>
      </div>

      <div className="border-t border-white/10 px-6 py-6">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-x-14 gap-y-4">
          {FOOTER_ITEMS.map(({ Icon, title, subtitle }) => (
            <div key={title} className="flex items-center gap-2.5">
              <Icon
                className="size-[18px] shrink-0"
                style={{ color: "#d97757" }}
              />
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-medium text-white">{title}</span>
                <span className="text-xs text-[#8a8a8a]">{subtitle}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
