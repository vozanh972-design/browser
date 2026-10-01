"use client";

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ArrowDownToLine, CheckCircle2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { AppVersionCheckResult } from "@/lib/version-checker";

interface ForceUpdateModalProps {
  updateInfo: AppVersionCheckResult;
  onRecheck?: () => void;
}

interface UpdateProgressPayload {
  downloaded: number;
  total: number;
  percent: number;
  status: string;
  message: string;
}

export function ForceUpdateModal({
  updateInfo,
  onRecheck,
}: ForceUpdateModalProps) {
  const [status, setStatus] = useState<
    "idle" | "downloading" | "launching" | "error"
  >("idle");
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [percent, setPercent] = useState(0);
  const [statusMessage, setStatusMessage] = useState("Chuẩn bị cập nhật…");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCheckingManual, setIsCheckingManual] = useState(false);
  const isStartedRef = useRef(false);

  const startDownload = useCallback(async () => {
    setStatus("downloading");
    setErrorMessage(null);
    setStatusMessage("Đang kết nối…");
    setPercent(0);
    setDownloadedBytes(0);
    setTotalBytes(0);

    try {
      const isTauri =
        typeof window !== "undefined" &&
        ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

      if (isTauri) {
        await invoke("start_app_update", {
          downloadUrl: updateInfo.downloadUrl,
        });
      } else {
        // Dev preview simulation
        let current = 0;
        const fakeTotal = 45 * 1024 * 1024;
        setTotalBytes(fakeTotal);
        const timer = setInterval(() => {
          current += 3 * 1024 * 1024;
          if (current >= fakeTotal) {
            clearInterval(timer);
            setDownloadedBytes(fakeTotal);
            setPercent(100);
            setStatus("launching");
            setStatusMessage("Cài đặt hoàn tất");
          } else {
            setDownloadedBytes(current);
            setPercent(Math.floor((current / fakeTotal) * 100));
            setStatusMessage("Đang tải…");
          }
        }, 300);
      }
    } catch (err: unknown) {
      setStatus("error");
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "Không thể kết nối. Vui lòng thử lại.";
      setErrorMessage(msg);
      setStatusMessage("Tải thất bại");
    }
  }, [updateInfo.downloadUrl]);

  useEffect(() => {
    let unlistenFn: (() => void) | null = null;

    const setupListener = async () => {
      try {
        const isTauri =
          typeof window !== "undefined" &&
          ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

        if (isTauri) {
          unlistenFn = await listen<UpdateProgressPayload>(
            "app-update-progress",
            (event) => {
              const payload = event.payload;
              if (payload) {
                setDownloadedBytes(payload.downloaded);
                if (payload.total > 0) setTotalBytes(payload.total);
                setPercent(payload.percent);
                if (payload.message) setStatusMessage(payload.message);
                if (payload.status === "downloading") setStatus("downloading");
                else if (payload.status === "launching") {
                  setStatus("launching");
                  setPercent(100);
                } else if (payload.status === "error") {
                  setStatus("error");
                  setErrorMessage(payload.message || "Tải thất bại");
                }
              }
            },
          );
        }
      } catch {
        // ignore non-tauri env
      }
    };

    void setupListener();

    if (!isStartedRef.current) {
      isStartedRef.current = true;
      const t = setTimeout(() => void startDownload(), 800);
      return () => {
        clearTimeout(t);
        if (unlistenFn) unlistenFn();
      };
    }

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, [startDownload]);

  const handleManualRecheck = () => {
    setIsCheckingManual(true);
    setTimeout(() => {
      setIsCheckingManual(false);
      onRecheck?.();
    }, 1500);
  };

  const formatMB = (b: number) => (b / (1024 * 1024)).toFixed(1);

  const isLaunching = status === "launching";
  const isError = status === "error";
  const isDownloading = status === "downloading";

  return (
    <div className="fixed inset-0 z-[99999999] flex items-center justify-center bg-black/60 backdrop-blur-2xl p-4 select-none animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-2xl border border-white/[0.06] bg-zinc-900/95 shadow-2xl flex flex-col items-center gap-0 overflow-hidden">
        {/* Header */}
        <div className="flex flex-col items-center gap-4 px-8 pt-8 pb-6 w-full">
          {/* Icon */}
          <div
            className={`flex size-14 items-center justify-center rounded-2xl transition-all duration-500 ${
              isLaunching
                ? "bg-white/10"
                : isError
                  ? "bg-white/5"
                  : "bg-white/8"
            }`}
          >
            {isLaunching ? (
              <CheckCircle2 className="size-7 text-white/90" />
            ) : (
              <ArrowDownToLine
                className={`size-7 text-white/70 ${isDownloading ? "animate-bounce" : ""}`}
              />
            )}
          </div>

          {/* Title */}
          <div className="flex flex-col items-center gap-1.5 text-center">
            <h2 className="text-[17px] font-semibold text-white tracking-tight leading-snug">
              {isLaunching
                ? "Cập nhật hoàn tất"
                : isError
                  ? "Không thể tải cập nhật"
                  : "Có bản cập nhật mới"}
            </h2>
            <p className="text-[13px] text-white/40 font-normal">
              {isLaunching
                ? "Ứng dụng phiên bản mới đang mở lên"
                : isError
                  ? "Kiểm tra kết nối và thử lại"
                  : `AutoLunex ${updateInfo.latestVersion} sẵn sàng cài đặt`}
            </p>
          </div>

          {/* Version pills */}
          <div className="flex items-center gap-2 text-[11px] font-mono">
            <span className="px-2.5 py-0.5 rounded-full bg-white/8 text-white/35 line-through">
              v{updateInfo.currentVersion}
            </span>
            <span className="text-white/20 text-[10px]">→</span>
            <span className="px-2.5 py-0.5 rounded-full bg-white/12 text-white/70 font-medium">
              v{updateInfo.latestVersion}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-white/[0.06]" />

        {/* Progress section */}
        <div className="w-full px-8 py-5 flex flex-col gap-3">
          {/* Progress bar */}
          <div className="w-full h-1 rounded-full bg-white/8 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${
                isError ? "bg-white/25" : "bg-white/70"
              }`}
              style={{
                width: `${isError ? Math.max(percent, 4) : Math.max(percent, isDownloading ? 2 : 0)}%`,
              }}
            />
          </div>

          {/* Progress text */}
          <div className="flex items-center justify-between text-[11px] text-white/35">
            <span>
              {downloadedBytes > 0 && totalBytes > 0
                ? `${formatMB(downloadedBytes)} / ${formatMB(totalBytes)} MB`
                : statusMessage}
            </span>
            <span className="font-mono tabular-nums">
              {percent > 0 ? `${percent.toFixed(0)}%` : ""}
            </span>
          </div>
        </div>

        {/* Release notes */}
        {updateInfo.releaseNotes && updateInfo.releaseNotes.length > 0 && (
          <>
            <div className="w-full h-px bg-white/[0.06]" />
            <div className="w-full px-8 py-4 flex flex-col gap-2">
              <p className="text-[11px] font-medium text-white/30 uppercase tracking-wider">
                Có trong bản này
              </p>
              <ul className="flex flex-col gap-1.5">
                {updateInfo.releaseNotes.map((note) => (
                  <li
                    key={note}
                    className="flex items-start gap-2 text-[12px] text-white/50"
                  >
                    <span className="mt-0.5 shrink-0 size-1 rounded-full bg-white/30 mt-[6px]" />
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* Action buttons */}
        {(isError || !isLaunching) && (
          <>
            <div className="w-full h-px bg-white/[0.06]" />
            <div className="w-full px-8 py-5 flex flex-col gap-2">
              {isError ? (
                <>
                  <Button
                    onClick={() => void startDownload()}
                    className="w-full h-10 text-[13px] font-medium bg-white text-zinc-900 hover:bg-white/90 rounded-xl border-0 cursor-pointer"
                  >
                    Thử lại
                  </Button>
                  {errorMessage && (
                    <p className="text-[11px] text-white/30 text-center break-words mt-1">
                      {errorMessage}
                    </p>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleManualRecheck}
                  disabled={isCheckingManual || isDownloading}
                  className="flex items-center justify-center gap-1.5 text-[12px] text-white/30 hover:text-white/50 disabled:opacity-40 transition-colors mx-auto cursor-pointer py-1"
                >
                  <RefreshCw
                    className={`size-3 ${isCheckingManual ? "animate-spin" : ""}`}
                  />
                  {isCheckingManual ? "Đang kiểm tra…" : "Kiểm tra lại"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
