"use client";

import {
  AlertCircle,
  Loader2,
  Lock,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
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

const BRIDGE_URL = "http://127.0.0.1:18899";
const GOLIKE_FALLBACK_URL = "https://app.golike.net/login";

export function GolikeLoginDialog({
  isOpen,
  onClose,
  onLoginSuccess,
}: GolikeLoginDialogProps) {
  const [iframeKey, setIframeKey] = useState(0);
  const [iframeSrc, setIframeSrc] = useState(`${BRIDGE_URL}/login`);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isCompletedRef = useRef(false);

  // Khởi tạo bridge và dọn dẹp khi đóng dialog
  useEffect(() => {
    if (!isOpen) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      setLoading(false);
      setStatusMessage("");
      setError("");
      isCompletedRef.current = false;
      return;
    }

    // Khi mở dialog: reset và kiểm tra kết nối bridge
    isCompletedRef.current = false;
    setIframeLoading(true);
    setError("");
    setStatusMessage("");

    const checkAndInitBridge = async () => {
      try {
        const pingRes = await fetch(`${BRIDGE_URL}/ping`, { cache: "no-store" });
        if (pingRes.ok) {
          setIframeSrc(`${BRIDGE_URL}/login`);
          startPollingSession();
          return;
        }
      } catch {
        // bridge chưa mở
      }

      // Thử gọi command Tauri để mở bridge ngầm
      try {
        await invoke("start_golike_bridge");
        await new Promise((resolve) => setTimeout(resolve, 500));
        const retryRes = await fetch(`${BRIDGE_URL}/ping`, { cache: "no-store" });
        if (retryRes.ok) {
          setIframeSrc(`${BRIDGE_URL}/login`);
          startPollingSession();
          return;
        }
      } catch {
        // Không gọi được invoke hoặc lỗi
      }

      // Fallback sang URL chính nếu không kết nối được bridge cục bộ
      setIframeSrc(`${BRIDGE_URL}/login`);
      startPollingSession();
    };

    void checkAndInitBridge();

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isOpen]);

  // Lắng nghe postMessage từ iframe (script tiêm tự động gửi khi đăng nhập thành công)
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      try {
        const data = event.data;
        if (!data || isCompletedRef.current) return;

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

  const startPollingSession = () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      if (isCompletedRef.current) return;

      try {
        const res = await fetch(`${BRIDGE_URL}/session`, { cache: "no-store" });
        if (!res.ok) return;

        const data = await res.json();
        if (data?.hasSession && data?.session?.golike_token) {
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
          await handleCompleteLogin(data.session);
        }
      } catch {
        // bridge chưa sẵn sàng
      }
    }, 1000);
  };

  const handleReloadIframe = () => {
    setIframeLoading(true);
    setIframeKey((prev) => prev + 1);
  };

  // Hoàn tất lưu phiên làm việc, đồng bộ và tự động đóng webview
  const handleCompleteLogin = async (sessionData: Partial<GolikeSessionData>) => {
    if (isCompletedRef.current) return;
    isCompletedRef.current = true;

    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    setLoading(true);
    setStatusMessage("Đã đăng nhập thành công! Đang lưu phiên làm việc...");

    try {
      // 1. Lưu đủ 17 trường chuẩn GoMax vào storage
      const fullSession = saveGolikeSession(sessionData);

      // 2. Đồng bộ Protocol với Gateway GoLike
      try {
        await syncGolikeProtocol(fullSession);
      } catch {
        // ignore
      }

      // 3. Lấy thông tin user (username & số coin)
      const userRes = await getGolikeUser(fullSession);
      let username = fullSession.golike_username || "GoLike User";
      let balance = "0 coin";

      if (userRes.success && userRes.user) {
        username = userRes.user.username;
        balance = `${userRes.user.coin.toLocaleString("vi-VN")} coin`;
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
        token: fullSession.golike_token,
      });

      // 4. Tự động đóng webview sau khi lưu xong
      onClose();
    } catch (err: unknown) {
      setLoading(false);
      isCompletedRef.current = false;
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Lỗi lưu phiên làm việc: ${msg}`);
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

        {/* Khung WebView Mobile trực tiếp trong app */}
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
                      ? "Đang tải WebView GoLike..."
                      : "Đang lưu phiên làm việc...")}
                </span>
              </div>
            )}

            <iframe
              key={iframeKey}
              ref={iframeRef}
              src={iframeSrc}
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
        <DialogFooter className="p-3 bg-muted/20 border-t border-border/40">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs cursor-pointer"
          >
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
