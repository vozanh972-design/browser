"use client";

import { Loader2, Lock, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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

const GOLIKE_LOGIN_URL = "https://app.golike.net/login";
const BRIDGE_API = "http://127.0.0.1:18899";

export function GolikeLoginDialog({
  isOpen,
  onClose,
  onLoginSuccess,
}: GolikeLoginDialogProps) {
  const [iframeKey, setIframeKey] = useState(0);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [isProcessingLogin, setIsProcessingLogin] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isCompletedRef = useRef(false);

  // Trích xuất session từ Bridge / LevelDB
  const checkSessionFromBridge = async () => {
    try {
      const res = await fetch(`${BRIDGE_API}/extract-session`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data?.success && data?.user?.token) {
        return {
          username: data.user.username || "GoLike User",
          balance: data.user.balance || "0 coin",
          token: data.user.token,
          coin: data.user.coin,
          session: data.session || {},
        };
      }
    } catch {
      // Bridge server có thể chưa mở nếu chạy độc lập
    }
    return null;
  };

  // Tự động hoàn tất đăng nhập, lưu đủ 17 trường và tự động đóng webview
  const handleAutoLoginSuccess = async (
    user: { username: string; balance: string; token: string; coin?: number },
    sessionData?: Partial<GolikeSessionData>,
  ) => {
    if (isCompletedRef.current) return;
    isCompletedRef.current = true;

    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    setIsProcessingLogin(true);

    try {
      let tokenToUse = user.token.trim();
      if (!tokenToUse.startsWith("Bearer ")) {
        tokenToUse = `Bearer ${tokenToUse}`;
      }

      // Lưu đầy đủ 17 trường chuẩn GoMax
      const fullSession: GolikeSessionData = saveGolikeSession({
        ...(sessionData || {}),
        golike_token: tokenToUse,
        golike_username: user.username,
      });

      // Đồng bộ protocol trong nền
      try {
        await syncGolikeProtocol(fullSession);
      } catch {
        // ignore
      }

      let username = user.username;
      let balance = user.balance;

      // Nếu username hoặc balance chưa có, truy vấn API để lấy số coin chính xác
      if (!username || username === "GoLike User" || !balance) {
        try {
          const userRes = await getGolikeUser(fullSession);
          if (userRes.success && userRes.user) {
            username = userRes.user.username;
            balance = `${userRes.user.coin.toLocaleString("vi-VN")} coin`;
          }
        } catch {
          // ignore
        }
      }

      if (!username) username = "GoLike User";
      if (!balance) balance = "0 coin";

      // Lưu vào localStorage
      saveGolikeSession({
        ...fullSession,
        golike_username: username,
      });

      try {
        localStorage.setItem("golike_username", username);
        localStorage.setItem("golike_balance", balance);
        localStorage.setItem("golike_token", fullSession.golike_token);
      } catch {
        // ignore
      }

      // Thông báo thành công
      showSuccessToast(`Đăng nhập GoLike thành công: ${username} (${balance})`);

      // Cập nhật state app
      onLoginSuccess({
        username,
        balance,
        token: fullSession.golike_token,
      });

      // Tự động đóng webview ngay lập tức
      onClose();
    } catch {
      setIsProcessingLogin(false);
      isCompletedRef.current = false;
    }
  };

  // Reset và kích hoạt polling khi mở dialog
  useEffect(() => {
    if (!isOpen) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      setIsProcessingLogin(false);
      isCompletedRef.current = false;
      return;
    }

    // 8. Khi đăng nhập thì xóa bộ nhớ trở về ban đầu hết (fresh start)
    isCompletedRef.current = false;
    setIsProcessingLogin(false);
    setIframeLoading(true);
    setIframeKey((prev) => prev + 1);

    // Kích hoạt lại Bridge và reset danh sách đã xóa nếu có
    (async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("start_golike_bridge");
      } catch {
        // ignore
      }

      try {
        await fetch(`${BRIDGE_API}/reset-clear`, { method: "POST" });
      } catch {
        // ignore
      }
    })();

    // 9. Tự động lắng nghe và phát hiện đăng nhập thành công mỗi 1s
    pollingRef.current = setInterval(async () => {
      if (isCompletedRef.current) return;
      const detected = await checkSessionFromBridge();
      if (detected && detected.token) {
        await handleAutoLoginSuccess(detected, detected.session);
      }
    }, 1000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [isOpen]);

  // Lắng nghe postMessage từ iframe (nếu có hook)
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      try {
        const data = event.data;
        if (!data || isCompletedRef.current) return;

        if (
          (data.type === "GOLIKE_SESSION" || data.type === "GOLIKE_HEADERS") &&
          data.session?.golike_token
        ) {
          await handleAutoLoginSuccess(
            {
              username: data.session.golike_username || "GoLike User",
              balance: "0 coin",
              token: data.session.golike_token,
            },
            data.session,
          );
        } else if (data.golike_token) {
          await handleAutoLoginSuccess(
            {
              username: data.golike_username || "GoLike User",
              balance: "0 coin",
              token: data.golike_token,
            },
            data,
          );
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {/* hideClose={true} ngăn chặn việc hiển thị dấu X mặc định của Radix để tránh bị chồng chéo 2 dấu X */}
      <DialogContent
        hideClose={true}
        className="p-0 border-0 bg-transparent shadow-none max-w-sm w-full focus:outline-none flex flex-col items-center justify-center"
      >
        {/* ================= macOS iPhone Mirroring / Liquid Glass Window ================= */}
        <div className="relative w-[380px] bg-zinc-950/80 backdrop-blur-3xl rounded-[34px] border border-white/20 shadow-[0_30px_90px_rgba(0,0,0,0.85)] ring-1 ring-white/10 overflow-hidden flex flex-col select-none">
          {/* 1. THANH TIÊU ĐỀ TRÊN: macOS Window Header với nút đóng duy nhất */}
          <div className="relative z-30 h-11 w-full px-4 bg-zinc-900/60 backdrop-blur-xl border-b border-white/10 flex items-center justify-between shrink-0">
            {/* macOS Window Dots */}
            <div className="flex items-center gap-1.5">
              <div className="size-2.5 rounded-full bg-white/20" />
              <div className="size-2.5 rounded-full bg-white/20" />
              <div className="size-2.5 rounded-full bg-white/20" />
            </div>

            {/* Title / Dynamic Pill */}
            <span className="text-[12px] font-medium text-zinc-300 tracking-wide">
              GoLike
            </span>

            {/* Nút Đóng cửa sổ duy nhất ở góc trên bên phải */}
            <button
              type="button"
              onClick={onClose}
              className="size-7 rounded-full bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Đóng cửa sổ"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* 2. MÀN HÌNH NỘI DUNG WEBVIEW GOLIKE */}
          <div className="relative w-full h-[600px] bg-white overflow-hidden">
            {(iframeLoading || isProcessingLogin) && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-950/85 backdrop-blur-xs gap-3">
                <Loader2 className="size-8 text-cyan-400 animate-spin" />
                <span className="text-xs text-zinc-200 font-medium text-center px-4">
                  {isProcessingLogin
                    ? "Đang tự động lưu phiên và đồng bộ..."
                    : "Đang tải giao diện GoLike..."}
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
              title="GoLike View"
            />
          </div>

          {/* 3. THANH TRUY CẬP DƯỚI (SAFARI LIQUID GLASS NHƯ IPHONE) */}
          <div className="relative z-30 bg-zinc-950/90 backdrop-blur-2xl px-4 pt-2.5 pb-3 flex flex-col items-center justify-center shrink-0 border-t border-white/10">
            {/* Thanh địa chỉ Safari Floating Capsule đưa xuống dưới */}
            <div className="h-9 w-full max-w-[280px] rounded-full bg-zinc-900/90 border border-white/15 px-3.5 flex items-center justify-center gap-2 text-xs text-zinc-300 shadow-inner">
              <Lock className="size-3 text-emerald-400 shrink-0" />
              <span className="font-medium tracking-tight text-[12px] text-zinc-200">
                app.golike.net
              </span>
            </div>

            {/* Thanh Home Indicator iPhone */}
            <div className="w-32 h-1 bg-white/30 rounded-full mt-2" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
