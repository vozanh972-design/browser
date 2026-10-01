"use client";

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
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
  const [statusMessage, setStatusMessage] = useState(
    "Sẵn sàng tải bản cập nhật mới",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCheckingManual, setIsCheckingManual] = useState(false);
  const isStartedRef = useRef(false);

  const startDownload = useCallback(async () => {
    setStatus("downloading");
    setErrorMessage(null);
    setStatusMessage("Đang kết nối tới máy chủ cập nhật...");
    setPercent(0);
    setDownloadedBytes(0);
    setTotalBytes(0);

    try {
      // Kiểm tra môi trường Tauri
      const isTauri =
        typeof window !== "undefined" &&
        ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

      if (isTauri) {
        await invoke("start_app_update", {
          downloadUrl: updateInfo.downloadUrl,
        });
      } else {
        // Fallback mô phỏng cho môi trường web preview
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
            setStatusMessage("Tải hoàn tất! Đang khởi chạy phiên bản mới...");
          } else {
            setDownloadedBytes(current);
            setPercent(Math.floor((current / fakeTotal) * 100));
            setStatusMessage("Đang tải dữ liệu bản mới...");
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
            : "Lỗi tải bản cập nhật ngầm";
      setErrorMessage(msg);
      setStatusMessage("Tải bản cập nhật thất bại. Vui lòng thử lại.");
    }
  }, [updateInfo.downloadUrl]);

  // Tự động lắng nghe sự kiện tiến độ tải từ Tauri backend
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
                if (payload.total > 0) {
                  setTotalBytes(payload.total);
                }
                setPercent(payload.percent);

                if (payload.message) {
                  setStatusMessage(payload.message);
                }

                if (payload.status === "downloading") {
                  setStatus("downloading");
                } else if (payload.status === "launching") {
                  setStatus("launching");
                  setPercent(100);
                } else if (payload.status === "error") {
                  setStatus("error");
                  setErrorMessage(
                    payload.message || "Tải bản cập nhật thất bại",
                  );
                }
              }
            },
          );
        }
      } catch {
        // Bỏ qua lỗi listener trong môi trường non-tauri
      }
    };

    void setupListener();

    // Tự động bắt đầu tải ngầm sau khi hiển thị popup
    if (!isStartedRef.current) {
      isStartedRef.current = true;
      const autoStartTimer = setTimeout(() => {
        void startDownload();
      }, 800);
      return () => {
        clearTimeout(autoStartTimer);
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
      if (onRecheck) {
        onRecheck();
      }
    }, 1500);
  };

  const formatMB = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(1);
  };

  return (
    <div className="fixed inset-0 z-[99999999] flex items-center justify-center bg-black/85 backdrop-blur-xl p-4 select-none animate-in fade-in duration-300">
      <div className="relative w-full max-w-md rounded-3xl border border-destructive/40 bg-card/95 p-6 sm:p-8 shadow-2xl shadow-destructive/20 text-center flex flex-col items-center gap-5">
        {/* Animated Status Icon */}
        <div className="relative flex size-20 items-center justify-center rounded-2xl bg-destructive/15 text-destructive border border-destructive/30 shadow-lg">
          {status === "downloading" ? (
            <>
              <div className="absolute inset-0 rounded-2xl bg-primary/20 animate-ping opacity-30" />
              <ArrowDownToLine className="size-10 text-primary relative z-10 animate-bounce" />
            </>
          ) : status === "launching" ? (
            <>
              <div className="absolute inset-0 rounded-2xl bg-emerald-500/20 animate-ping opacity-30" />
              <CheckCircle2 className="size-10 text-emerald-500 relative z-10" />
            </>
          ) : status === "error" ? (
            <>
              <div className="absolute inset-0 rounded-2xl bg-destructive/20 animate-ping opacity-30" />
              <AlertTriangle className="size-10 text-destructive relative z-10" />
            </>
          ) : (
            <>
              <div className="absolute inset-0 rounded-2xl bg-destructive/20 animate-ping opacity-30" />
              <ShieldAlert className="size-10 text-destructive relative z-10" />
            </>
          )}
        </div>

        {/* Title & Version Pills */}
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
            {status === "launching"
              ? "Đang khởi chạy bản mới"
              : status === "downloading"
                ? "Đang tải bản cập nhật ngầm"
                : updateInfo.title || "Yêu cầu cập nhật phiên bản mới"}
          </h2>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded-full bg-destructive/15 text-destructive border border-destructive/30 font-semibold line-through">
              v{updateInfo.currentVersion}
            </span>
            <ArrowRight className="size-3.5 text-muted-foreground" />
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 font-bold animate-pulse">
              v{updateInfo.latestVersion} (Mới nhất)
            </span>
          </div>
        </div>

        {/* Progress Panel */}
        <div className="w-full flex flex-col gap-2.5 rounded-2xl border border-border/70 bg-muted/30 p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground flex items-center gap-1.5">
              {status === "downloading" && (
                <Loader2 className="size-3.5 animate-spin text-primary" />
              )}
              {status === "launching" && (
                <Sparkles className="size-3.5 text-emerald-500 animate-pulse" />
              )}
              {statusMessage}
            </span>
            <span className="font-mono font-bold text-foreground">
              {percent.toFixed(0)}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-3 rounded-full bg-muted overflow-hidden border border-border/50 relative">
            <div
              className={`h-full transition-all duration-300 relative rounded-full ${
                status === "launching"
                  ? "bg-emerald-500"
                  : status === "error"
                    ? "bg-destructive"
                    : "bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500"
              }`}
              style={{ width: `${Math.max(percent, 4)}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            </div>
          </div>

          {/* Downloaded Stats (No raw URL displayed) */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
            <span>
              {downloadedBytes > 0
                ? totalBytes > 0
                  ? `${formatMB(downloadedBytes)} MB / ${formatMB(totalBytes)} MB`
                  : `Đã tải: ${formatMB(downloadedBytes)} MB`
                : "Đang chuẩn bị tải ngầm..."}
            </span>
            <span>
              {status === "downloading" && "Tải trực tiếp trong tool"}
              {status === "launching" && "Khởi chạy tự động"}
              {status === "error" && "Gặp lỗi kết nối"}
              {status === "idle" && "Tự động kích hoạt"}
            </span>
          </div>
        </div>

        {/* Release Notes if provided */}
        {updateInfo.releaseNotes && updateInfo.releaseNotes.length > 0 && (
          <div className="w-full rounded-xl border border-border/60 bg-muted/40 p-3 text-left">
            <div className="text-[11px] font-semibold text-foreground mb-1.5 uppercase tracking-wider">
              Nội dung nâng cấp:
            </div>
            <ul className="text-xs text-muted-foreground space-y-1">
              {updateInfo.releaseNotes.map((note) => (
                <li key={note} className="flex items-start gap-1.5">
                  <span className="text-emerald-500 mt-0.5">•</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Warning / Instruction Note */}
        <div className="flex items-center gap-2 text-[11px] text-amber-500 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl w-full text-left">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            {status === "launching"
              ? "Tải xong! Ứng dụng mới đang mở lên và phiên bản cũ sẽ tự đóng lại."
              : "Ứng dụng tự động tải ngầm ngay trong tool. Sau khi tải xong sẽ tự động mở lên."}
          </span>
        </div>

        {/* Actions when error or manual retry */}
        {status === "error" && (
          <div className="flex flex-col gap-2 w-full pt-1">
            <Button
              size="lg"
              onClick={() => void startDownload()}
              className="w-full gap-2 text-sm font-bold bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-lg shadow-destructive/25 h-11 cursor-pointer"
            >
              <RefreshCw className="size-4" />
              <span>Thử tải lại ngay</span>
            </Button>
            {errorMessage && (
              <span className="text-[11px] text-destructive break-words">
                {errorMessage}
              </span>
            )}
          </div>
        )}

        {status !== "error" && status !== "launching" && (
          <div className="flex flex-col gap-2 w-full pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRecheck}
              disabled={isCheckingManual || status === "downloading"}
              className="w-full gap-2 text-xs h-9 cursor-pointer"
            >
              <RefreshCw
                className={`size-3.5 ${isCheckingManual ? "animate-spin" : ""}`}
              />
              <span>
                {isCheckingManual
                  ? "Đang kiểm tra kết nối..."
                  : "Kiểm tra lại trạng thái"}
              </span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
