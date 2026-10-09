"use client";

import {
  AlertCircle,
  Check,
  Loader2,
  Lock,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getGolikeUser } from "@/lib/golike-api";
import {
  type GolikeSessionData,
  loadGolikeSession,
  saveGolikeSession,
  syncGolikeProtocol,
} from "@/lib/golike-session";
import { showSuccessToast } from "@/lib/toast-utils";

interface GolikeLoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: {
    username: string;
    balance: string;
    token: string;
  }) => void;
}

const GOLIKE_LOGIN_URL = "https://app.golike.net/login";

export function GolikeLoginDialog({
  isOpen,
  onClose,
  onLoginSuccess,
}: GolikeLoginDialogProps) {
  const [iframeKey, setIframeKey] = useState(0);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Reset khi mở/đóng dialog
  useEffect(() => {
    if (!isOpen) {
      setLoading(false);
      setStatusMessage("");
      setError("");
      return;
    }

    setIframeLoading(true);
    setError("");
    setStatusMessage("");
  }, [isOpen]);

  // Lắng nghe postMessage từ iframe (nếu có sự kiện phiên đăng nhập)
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      try {
        const data = event.data;
        if (!data) return;

        if (
          (data.type === "GOLIKE_SESSION" || data.type === "GOLIKE_HEADERS") &&
          data.session?.golike_token
        ) {
          await handleCompleteLogin(data.session);
        } else if (data.golike_token) {
          await handleCompleteLogin(data);
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleReloadIframe = () => {
    setIframeLoading(true);
    setIframeKey((prev) => prev + 1);
  };

  // Hoàn tất lưu phiên làm việc, đồng bộ và tự động đóng webview
  const handleCompleteLogin = async (sessionData?: Partial<GolikeSessionData>) => {
    setLoading(true);
    setStatusMessage("Đang hoàn tất đăng nhập và kiểm tra tài khoản...");
    setError("");

    try {
      let fullSession: GolikeSessionData;

      if (sessionData?.golike_token) {
        fullSession = saveGolikeSession(sessionData);
        try {
          await syncGolikeProtocol(fullSession);
        } catch {
          // ignore
        }
      } else {
        const existing = loadGolikeSession();
        fullSession = existing || saveGolikeSession({});
      }

      // Xác thực hoặc lấy thông tin người dùng nếu có token
      let username = fullSession.golike_username || "GoLike User";
      let balance = "0 coin";

      if (fullSession.golike_token) {
        const userRes = await getGolikeUser(fullSession);
        if (userRes.success && userRes.user) {
          username = userRes.user.username;
          balance = `${userRes.user.coin.toLocaleString("vi-VN")} coin`;
        }
      }

      try {
        localStorage.setItem("golike_username", username);
        localStorage.setItem("golike_balance", balance);
      } catch {
        // ignore
      }

      setLoading(false);
      showSuccessToast(`Đăng nhập GoLike thành công! Chào mừng ${username}`);

      onLoginSuccess({
        username,
        balance,
        token: fullSession.golike_token || "",
      });

      onClose();
    } catch (err: unknown) {
      setLoading(false);
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Lỗi: ${msg}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="p-0 gap-0 overflow-hidden rounded-2xl border border-border/80 shadow-2xl bg-card max-w-md w-full transition-all duration-300">
        {/* Header Dialog */}
        <DialogHeader className="p-4 pb-3 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Smartphone className="size-4.5" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold text-foreground">
                Đăng nhập GoLike
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        {/* Khung WebView Mobile nạp trực tiếp */}
        <div className="flex flex-col bg-background/50">
          {/* Thanh điều hướng WebView */}
          <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border/50 text-xs">
            <div className="flex items-center gap-1.5 flex-1 min-w-0 mr-2">
              <Lock className="size-3 text-emerald-400 shrink-0" />
              <span className="font-mono text-[11px] text-muted-foreground truncate">
                app.golike.net/login
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleReloadIframe}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
                title="Tải lại trang"
              >
                <RefreshCw className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Vùng WebView Mobile */}
          <div className="relative w-full h-[540px] bg-white overflow-hidden">
            {(iframeLoading || loading) && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/85 backdrop-blur-xs gap-3">
                <Loader2 className="size-7 text-cyan-400 animate-spin" />
                <span className="text-xs text-foreground font-medium">
                  {statusMessage ||
                    (iframeLoading
                      ? "Đang tải giao diện GoLike..."
                      : "Đang xử lý...")}
                </span>
              </div>
            )}

            <iframe
              key={iframeKey}
              ref={iframeRef}
              src={GOLIKE_LOGIN_URL}
              onLoad={() => setIframeLoading(false)}
              className="w-full h-full border-0"
              allow="clipboard-read; clipboard-write"
              title="GoLike Login WebView"
            />
          </div>

          {/* Thông báo lỗi nếu có */}
          {error && (
            <div className="p-3 bg-destructive/10 border-t border-destructive/20 text-[11px] text-destructive flex items-start gap-2">
              <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
              <span className="leading-tight font-medium">{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-3 bg-muted/20 border-t border-border/40 flex items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs cursor-pointer"
          >
            Đóng
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => handleCompleteLogin()}
            disabled={loading}
            className="text-xs cursor-pointer bg-cyan-600 hover:bg-cyan-700 text-white gap-1.5 shadow-sm"
          >
            <Check className="size-3.5" />
            <span>Hoàn tất đăng nhập</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
