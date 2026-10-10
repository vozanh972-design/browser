"use client";

import { Loader2, Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { getGolikeUser } from "@/lib/golike-api";
import {
  type GolikeSessionData,
  clearGolikeSession,
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

  // Trích xuất session: ưu tiên Tauri native invoke, fallback sang HTTP bridge
  const checkSession = async () => {
    // 1. Thử gọi trực tiếp từ Rust Tauri (nhanh nhất, không phụ thuộc port)
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const data: any = await invoke("extract_golike_session");
      if ((data?.success || data?.hasSession) && data?.user?.token) {
        return {
          username: data.user.username || "GoLike User",
          balance: data.user.balance || "0 coin",
          token: data.user.token,
          coin: data.user.coin,
          session: data.session || {},
        };
      }
    } catch {
      // ignore
    }

    // 2. Thử gọi qua HTTP Bridge 18899
    try {
      const res = await fetch(`${BRIDGE_API}/extract-session`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return null;
      const data = await res.json();
      if ((data?.success || data?.hasSession) && data?.user?.token) {
        return {
          username: data.user.username || "GoLike User",
          balance: data.user.balance || "0 coin",
          token: data.user.token,
          coin: data.user.coin,
          session: data.session || {},
        };
      }
    } catch {
      // Bridge server có thể đang khởi động
    }
    return null;
  };

  // Tự động hoàn tất đăng nhập, lưu đủ 17 trường và tự động đóng webview ngay lập tức
  const handleAutoLoginSuccess = (
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
      let tokenToUse = (user.token || "").trim();
      if (tokenToUse && !tokenToUse.toLowerCase().startsWith("bearer ")) {
        tokenToUse = `Bearer ${tokenToUse}`;
      }

      const username =
        user.username && user.username !== "GoLike User"
          ? user.username
          : sessionData?.golike_username || "GoLike User";

      const balance =
        user.balance && user.balance !== "0 coin"
          ? user.balance
          : user.coin !== undefined
            ? `${user.coin.toLocaleString("vi-VN")} coin`
            : "0 coin";

      // Lưu đầy đủ 17 trường chuẩn GoMax
      const fullSession: GolikeSessionData = saveGolikeSession({
        ...(sessionData || {}),
        golike_token: tokenToUse,
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

      // Cập nhật state app ngay lập tức
      onLoginSuccess({
        username,
        balance,
        token: fullSession.golike_token,
      });

      // Tự động đóng webview ngay lập tức - Không đơ, không chờ đợi
      onClose();

      // Đồng bộ protocol và làm mới số dư nếu cần (chạy ngầm sau khi đã đóng webview)
      void (async () => {
        try {
          await syncGolikeProtocol(fullSession);
        } catch {
          // ignore
        }

        if (!balance || balance === "0 coin" || username === "GoLike User") {
          try {
            const userRes = await getGolikeUser(fullSession);
            if (userRes.success && userRes.user) {
              const freshBalance = `${userRes.user.coin.toLocaleString("vi-VN")} coin`;
              localStorage.setItem("golike_username", userRes.user.username);
              localStorage.setItem("golike_balance", freshBalance);
              onLoginSuccess({
                username: userRes.user.username,
                balance: freshBalance,
                token: fullSession.golike_token,
              });
            }
          } catch {
            // ignore
          }
        }
      })();
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

    isCompletedRef.current = false;
    setIsProcessingLogin(false);
    setIframeLoading(true);
    setIframeKey((prev) => prev + 1);

    // Kích hoạt lại Bridge nếu chưa bật
    (async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("start_golike_bridge");
      } catch {
        // ignore
      }

      // Kiểm tra ngay lập tức khi vừa mở dialog (nếu đã đăng nhập trên GoLike thì nhận diện và đóng luôn)
      const detected = await checkSession();
      if (detected && detected.token) {
        await handleAutoLoginSuccess(detected, detected.session);
      }
    })();

    // Tự động lắng nghe và phát hiện đăng nhập thành công mỗi 600ms
    pollingRef.current = setInterval(async () => {
      if (isCompletedRef.current) return;
      const detected = await checkSession();
      if (detected && detected.token) {
        await handleAutoLoginSuccess(detected, detected.session);
      }
    }, 600);

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
      {/* hideClose={true} ngăn chặn hiển thị dấu X mặc định của Radix */}
      <DialogContent
        hideClose={true}
        className="p-0 border-0 bg-transparent shadow-none max-w-sm w-full focus:outline-none flex flex-col items-center justify-center"
      >
        {/* ================= macOS iPhone Mirroring / Liquid Glass Window ================= */}
        <div className="relative w-[380px] bg-zinc-950/80 backdrop-blur-3xl rounded-[34px] border border-white/20 shadow-[0_30px_90px_rgba(0,0,0,0.85)] ring-1 ring-white/10 overflow-hidden flex flex-col select-none">
          {/* 1. THANH ĐỈNH DYNAMIC ISLAND: Không còn 3 dấu chấm, không còn dấu X */}
          <div className="relative z-30 h-8 w-full bg-zinc-950/90 backdrop-blur-xl border-b border-white/10 flex items-center justify-center shrink-0">
            <div className="h-4.5 w-24 bg-black/80 rounded-full border border-white/10 flex items-center justify-center gap-1.5 px-2">
              <div className="size-2 rounded-full bg-zinc-800" />
              <span className="text-[11px] font-medium tracking-tight text-zinc-300">
                GoLike
              </span>
            </div>
          </div>

          {/* 2. MÀN HÌNH NỘI DUNG WEBVIEW GOLIKE */}
          <div className="relative w-full h-[600px] bg-white overflow-hidden">
            {(iframeLoading || isProcessingLogin) && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-950/85 backdrop-blur-xs gap-3">
                <Loader2 className="size-8 text-cyan-400 animate-spin" />
                <span className="text-xs text-zinc-200 font-medium text-center px-4">
                  {isProcessingLogin
                    ? "Đang tự động lưu phiên và đóng cửa sổ..."
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
            {/* Thanh địa chỉ Safari Floating Capsule */}
            <div className="h-9 w-full max-w-[280px] rounded-full bg-zinc-900/90 border border-white/15 px-3.5 flex items-center justify-center gap-2 text-xs text-zinc-300 shadow-inner">
              <Lock className="size-3 text-emerald-400 shrink-0" />
              <span className="font-medium tracking-tight text-[12px] text-zinc-200">
                app.golike.net
              </span>
            </div>

            {/* Thanh Home Indicator iPhone (chạm để đóng nếu muốn thoát) */}
            <button
              type="button"
              onClick={onClose}
              className="w-32 h-1 bg-white/30 hover:bg-white/60 rounded-full mt-2 transition-colors cursor-pointer"
              title="Đóng cửa sổ"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
