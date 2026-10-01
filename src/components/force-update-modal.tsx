"use client";

import { openUrl } from "@tauri-apps/plugin-opener";
import {
  AlertTriangle,
  ArrowRight,
  Download,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { AppVersionCheckResult } from "@/lib/version-checker";

interface ForceUpdateModalProps {
  updateInfo: AppVersionCheckResult;
  onRecheck?: () => void;
}

export function ForceUpdateModal({
  updateInfo,
  onRecheck,
}: ForceUpdateModalProps) {
  const [isChecking, setIsChecking] = useState(false);

  const handleDownload = () => {
    const url =
      updateInfo.downloadUrl ||
      "https://github.com/vozanh972-design/browser/releases/latest";
    openUrl(url).catch(() => {
      if (typeof window !== "undefined") {
        window.open(url, "_blank");
      }
    });
  };

  const handleRecheck = () => {
    setIsChecking(true);
    setTimeout(() => {
      setIsChecking(false);
      if (onRecheck) {
        onRecheck();
      }
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[99999999] flex items-center justify-center bg-black/85 backdrop-blur-xl p-4 select-none animate-in fade-in duration-300">
      <div className="relative w-full max-w-md rounded-3xl border border-destructive/40 bg-card/95 p-6 sm:p-8 shadow-2xl shadow-destructive/20 text-center flex flex-col items-center gap-5">
        {/* Animated Glow Badge */}
        <div className="relative flex size-20 items-center justify-center rounded-2xl bg-destructive/15 text-destructive border border-destructive/30 shadow-lg">
          <div className="absolute inset-0 rounded-2xl bg-destructive/20 animate-ping opacity-30" />
          <ShieldAlert className="size-10 text-destructive relative z-10" />
        </div>

        {/* Title & Version Pills */}
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
            {updateInfo.title || "Yêu cầu cập nhật phiên bản mới"}
          </h2>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded-full bg-destructive/15 text-destructive border border-destructive/30 font-semibold line-through">
              v{updateInfo.currentVersion}
            </span>
            <ArrowRight className="size-3.5 text-muted-foreground" />
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 font-bold animate-pulse">
              v{updateInfo.latestVersion} (Bắt buộc)
            </span>
          </div>
        </div>

        {/* Message */}
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          {updateInfo.message ||
            `Phiên bản AutoLunex v${updateInfo.currentVersion} đã bị vô hiệu hóa vì lý do an toàn & đồng bộ hệ thống. Bạn không thể tiếp tục sử dụng phiên bản này.`}
        </p>

        {/* Release Notes if provided */}
        {updateInfo.releaseNotes && updateInfo.releaseNotes.length > 0 && (
          <div className="w-full rounded-xl border border-border/60 bg-muted/40 p-3 text-left">
            <div className="text-[11px] font-semibold text-foreground mb-1.5 uppercase tracking-wider">
              Nội dung cập nhật mới:
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

        {/* Warning Note */}
        <div className="flex items-center gap-2 text-[11px] text-amber-500 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl w-full text-left">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            Các phiên bản cũ đã bị khóa hoàn toàn từ máy chủ. Vui lòng tải bản
            mới nhất để tiếp tục.
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5 w-full pt-1">
          <Button
            size="lg"
            onClick={handleDownload}
            className="w-full gap-2 text-sm font-bold bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-lg shadow-destructive/25 h-11 cursor-pointer"
          >
            <Download className="size-4" />
            <span>Tải bản cập nhật mới ngay</span>
            <ExternalLink className="size-3.5 opacity-80" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRecheck}
            disabled={isChecking}
            className="w-full gap-2 text-xs h-9 cursor-pointer"
          >
            <RefreshCw
              className={`size-3.5 ${isChecking ? "animate-spin" : ""}`}
            />
            <span>
              {isChecking
                ? "Đang kiểm tra lại..."
                : "Đã cập nhật xong & Kiểm tra lại"}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}
