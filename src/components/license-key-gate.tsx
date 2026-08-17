"use client";

import { openUrl } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  LuArrowRight,
  LuExternalLink,
  LuKeyRound,
  LuLoaderCircle,
} from "react-icons/lu";
import { useTitleBarDrag } from "@/hooks/use-titlebar-drag";
import { checkLicenseKey, markLicenseValid } from "@/lib/license";
import { cn } from "@/lib/utils";

const GET_KEY_URL = "https://lunex.io.vn";

// However fast the real check comes back, keep the "verifying" screen up at
// least this long — a check that resolves in 80ms reads as broken/skipped,
// not as "verified".
const MIN_CHECK_DISPLAY_MS = 1400;

const FALLBACK_MESSAGES: Record<string, string> = {
  invalid: "This key doesn't exist. Double-check it and try again.",
  expired: "This key has expired.",
  revoked: "This key has been revoked.",
  device_mismatch: "This key is already activated on another device.",
  error:
    "Couldn't reach the license server. Check your connection and try again.",
};

interface LicenseKeyGateProps {
  onContinue: (key: string) => void;
}

type Phase = "form" | "checking";

/**
 * Pre-app gate screen: the very first thing shown before the main profiles
 * interface. Collects a license key, verifies it against the Lunex key-check
 * API, and — once valid — hands it back to the caller via `onContinue`.
 */
export function LicenseKeyGate({ onContinue }: LicenseKeyGateProps) {
  const [key, setKey] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragHandlers = useTitleBarDrag();

  useEffect(() => {
    if (phase === "form") inputRef.current?.focus();
  }, [phase]);

  const handleContinue = useCallback(() => {
    const trimmed = key.trim();
    if (!trimmed) {
      setErrorMessage("Please enter your key.");
      return;
    }

    setErrorMessage(null);
    setPhase("checking");

    const started = Date.now();
    void checkLicenseKey(trimmed).then((result) => {
      const elapsed = Date.now() - started;
      const wait = Math.max(0, MIN_CHECK_DISPLAY_MS - elapsed);

      window.setTimeout(() => {
        if (result.status === "valid" || result.status === "ok") {
          markLicenseValid(trimmed);
          onContinue(trimmed);
          return;
        }
        setErrorMessage(
          result.msg?.trim() ||
            FALLBACK_MESSAGES[result.status] ||
            "Something went wrong. Please try again.",
        );
        setPhase("form");
      }, wait);
    });
  }, [key, onContinue]);

  return (
    <div
      className="flex h-dvh flex-col items-center justify-center bg-[#050505] px-6 text-white select-none"
      {...dragHandlers}
    >
      <div className="flex w-full max-w-[560px] flex-col items-center">
        <div
          className="mb-4 flex size-16 items-center justify-center rounded-full border lg:mb-6 lg:size-[88px]"
          style={{
            borderColor: "rgba(226, 111, 81, 0.55)",
            backgroundColor: "#141212",
            boxShadow:
              "0 0 0 1px rgba(226,111,81,0.08), 0 0 40px 4px rgba(226,111,81,0.25)",
          }}
        >
          {phase === "checking" ? (
            <LuLoaderCircle className="size-7 animate-spin text-[#d97757] lg:size-9" />
          ) : (
            <LuKeyRound className="size-7 text-white lg:size-9" />
          )}
        </div>

        {phase === "checking" ? (
          <>
            <h1 className="text-center text-xl font-bold tracking-tight text-white lg:text-[28px]">
              Verifying Your Key
            </h1>
            <p className="mt-2 text-center text-xs text-[#9a9a9a] lg:mt-2.5 lg:text-sm">
              Hang on a moment while we check this with the server.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-center text-xl font-bold tracking-tight text-white lg:text-[28px]">
              Enter Your Key
            </h1>
            <p className="mt-2 text-center text-xs text-[#9a9a9a] lg:mt-2.5 lg:text-sm">
              Enter your license key to continue and access your profiles.
            </p>
          </>
        )}

        {phase === "form" && (
          <>
            <div className="mt-5 w-full lg:mt-7">
              <div
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border bg-[#0d0d0d] px-4 py-3 transition-colors lg:py-3.5",
                  errorMessage ? "border-destructive" : "border-white/10",
                )}
              >
                <LuKeyRound className="size-4 shrink-0 text-[#8a8a8a]" />
                <input
                  ref={inputRef}
                  value={key}
                  onChange={(e) => {
                    setKey(e.target.value);
                    if (errorMessage) setErrorMessage(null);
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
              {errorMessage && (
                <p className="mt-2 text-xs text-destructive">{errorMessage}</p>
              )}
            </div>

            <button
              type="button"
              onClick={handleContinue}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-lg transition-opacity hover:opacity-90 active:opacity-80 lg:mt-4 lg:py-3.5 lg:text-[15px]"
              style={{
                background: "linear-gradient(90deg, #d97757 0%, #b3554a 100%)",
              }}
            >
              Continue
              <LuArrowRight className="size-4" />
            </button>

            <div className="mt-5 flex w-full items-center gap-3 lg:mt-7">
              <div className="h-px flex-1 bg-white/10" />
              <span className="shrink-0 text-xs text-[#7a7a7a]">
                Don&apos;t have a key?
              </span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <button
              type="button"
              onClick={() => void openUrl(GET_KEY_URL)}
              className="mt-4 flex items-center gap-2 rounded-lg border border-white/10 bg-transparent px-4 py-2 text-sm text-white transition-colors hover:bg-white/5 lg:mt-5"
            >
              Get a Key
              <LuExternalLink className="size-3.5 text-[#9a9a9a]" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
