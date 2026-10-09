"use client";

import {
  AlertCircle,
  Battery,
  Check,
  Key,
  Loader2,
  RefreshCw,
  Signal,
  Wifi,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
  const [currentTime, setCurrentTime] = useState("9:41");
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [tokenInput, setTokenInput] = useState("");

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Cập nhật giờ thời gian thực theo chuẩn iPhone
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, "0");
      const minutes = now.getMinutes().toString().padStart(2, "0");
      setCurrentTime(`${hours}:${minutes}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  // Reset khi mở/đóng dialog
  useEffect(() => {
    if (!isOpen) {
      setLoading(false);
      setStatusMessage("");
      setError("");
      setShowTokenInput(false);
      setTokenInput("");
      return;
    }

    setIframeLoading(true);
    setError("");
    setStatusMessage("");
  }, [isOpen]);

  // Lắng nghe postMessage từ iframe (nếu có script hook gửi phiên)
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

  // Hoàn tất lưu phiên làm việc, đồng bộ và tự động đóng
  const handleCompleteLogin = async (sessionData?: Partial<GolikeSessionData>) => {
    setLoading(true);
    setStatusMessage("Đang kiểm tra và đồng bộ tài khoản GoLike...");
    setError("");

    try {
      let tokenToUse = sessionData?.golike_token || tokenInput.trim();
      let fullSession: GolikeSessionData;

      if (tokenToUse) {
        if (!tokenToUse.startsWith("Bearer ")) {
          tokenToUse = `Bearer ${tokenToUse}`;
        }
        fullSession = saveGolikeSession({
          ...sessionData,
          golike_token: tokenToUse,
        });

        try {
          await syncGolikeProtocol(fullSession);
        } catch {
          // ignore
        }
      } else {
        const existing = loadGolikeSession();
        if (existing?.golike_token) {
          fullSession = existing;
        } else {
          setLoading(false);
          setError("Chưa nhận được phiên đăng nhập. Vui lòng đăng nhập trên điện thoại hoặc nhập Token.");
          return;
        }
      }

      // Xác thực API và lấy tên + số coin thực tế
      const userRes = await getGolikeUser(fullSession);

      if (!userRes.success || !userRes.user) {
        setLoading(false);
        setError(
          userRes.error ||
            "Không thể xác thực số coin. Vui lòng kiểm tra lại tài khoản hoặc nhập mã Token."
        );
        return;
      }

      const username = userRes.user.username;
      const balance = `${userRes.user.coin.toLocaleString("vi-VN")} coin`;

      try {
        localStorage.setItem("golike_username", username);
        localStorage.setItem("golike_balance", balance);
      } catch {
        // ignore
      }

      setLoading(false);
      showSuccessToast(`Đăng nhập GoLike thành công! ${username} (${balance})`);

      onLoginSuccess({
        username,
        balance,
        token: fullSession.golike_token,
      });

      onClose();
    } catch (err: unknown) {
      setLoading(false);
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Lỗi đồng bộ: ${msg}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="p-0 border-0 bg-transparent shadow-none max-w-sm w-full focus:outline-none flex flex-col items-center justify-center">
        {/* ================= KHUNG ĐIỆN THOẠI iPHONE (iMAC MIRRORING VIEW) ================= */}
        <div className="relative w-[360px] bg-[#1c1c1e] p-[10px] rounded-[52px] border-[5px] border-[#3a3a3c] shadow-[0_25px_80px_rgba(0,0,0,0.85)] ring-1 ring-white/10 select-none">
          {/* Nút vật lý sườn máy (iPhone Hardware Buttons) */}
          {/* Phím Action & Âm lượng bên trái */}
          <div className="absolute -left-[9px] top-[105px] w-[5px] h-[26px] bg-[#3a3a3c] rounded-l-md border-r border-black/40" />
          <div className="absolute -left-[9px] top-[145px] w-[5px] h-[48px] bg-[#3a3a3c] rounded-l-md border-r border-black/40" />
          <div className="absolute -left-[9px] top-[205px] w-[5px] h-[48px] bg-[#3a3a3c] rounded-l-md border-r border-black/40" />
          {/* Phím Nguồn bên phải */}
          <div className="absolute -right-[9px] top-[155px] w-[5px] h-[64px] bg-[#3a3a3c] rounded-r-md border-l border-black/40" />

          {/* Màn hình OLED viền cong bên trong */}
          <div className="relative w-full h-[620px] bg-black rounded-[42px] overflow-hidden flex flex-col border border-white/5 shadow-inner">
            {/* 1. THANH TRẠNG THÁI iOS (STATUS BAR & DYNAMIC ISLAND) */}
            <div className="relative z-30 h-10 w-full px-6 flex items-center justify-between text-white text-[12px] font-semibold bg-black shrink-0">
              {/* Giờ hiện tại */}
              <span className="tracking-tight">{currentTime}</span>

              {/* Dynamic Island (Viên thuốc đen đặc trưng iPhone) */}
              <div className="absolute left-1/2 -translate-x-1/2 top-2 h-[22px] w-[95px] bg-[#0c0c0e] rounded-full flex items-center justify-between px-2.5 border border-white/10 shadow-sm">
                {/* Camera trước */}
                <div className="size-2.5 rounded-full bg-[#18181b] border border-white/5 flex items-center justify-center">
                  <div className="size-1 rounded-full bg-blue-950/70" />
                </div>
                {/* Cảm biến FaceID */}
                <div className="size-2 rounded-full bg-[#121214]" />
              </div>

              {/* Biểu tượng Sóng 5G, Wi-Fi & Pin iOS */}
              <div className="flex items-center gap-1.5 text-white/90">
                <Signal className="size-3" />
                <Wifi className="size-3" />
                <div className="flex items-center gap-0.5">
                  <Battery className="size-4 text-emerald-400" />
                </div>
              </div>
            </div>

            {/* 2. MÀN HÌNH NỘI DUNG WEBVIEW GOLIKE */}
            <div className="relative flex-1 w-full bg-white overflow-hidden">
              {(iframeLoading || loading) && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/85 backdrop-blur-xs gap-3">
                  <Loader2 className="size-8 text-cyan-400 animate-spin" />
                  <span className="text-xs text-foreground font-medium text-center px-4">
                    {statusMessage ||
                      (iframeLoading
                        ? "Đang nạp màn hình GoLike..."
                        : "Đang lưu và đồng bộ...")}
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
                title="GoLike iPhone Mirroring View"
              />
            </div>

            {/* 3. THANH ĐÁY iPHONE (HOME INDICATOR BAR & NÚT ĐIỀU KHIỂN NHANH) */}
            <div className="relative z-30 bg-black/95 px-4 pt-2 pb-2.5 flex flex-col gap-2 shrink-0 border-t border-white/10">
              {/* Form nhập Token nhanh nếu cần đồng bộ coin chính xác */}
              {showTokenInput && (
                <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-zinc-900 border border-white/10 animate-in fade-in zoom-in-95 duration-200">
                  <input
                    type="text"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Dán mã Authorization Token..."
                    className="flex-1 h-7 text-[11px] font-mono px-2 rounded-lg bg-black/50 text-white border border-white/10 focus:outline-none"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleCompleteLogin()}
                    disabled={loading || !tokenInput.trim()}
                    className="h-7 text-[11px] bg-cyan-600 hover:bg-cyan-700 text-white px-2.5 rounded-lg cursor-pointer"
                  >
                    Lưu
                  </Button>
                </div>
              )}

              {/* Thông báo lỗi nếu có */}
              {error && (
                <div className="px-2.5 py-1.5 rounded-lg bg-destructive/15 border border-destructive/30 text-[10px] text-red-400 flex items-start gap-1.5">
                  <AlertCircle className="size-3 shrink-0 mt-0.5" />
                  <span className="leading-tight">{error}</span>
                </div>
              )}

              {/* Nút hành động */}
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleReloadIframe}
                  className="size-7 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-white/80 flex items-center justify-center cursor-pointer transition-colors"
                  title="Tải lại trang"
                >
                  <RefreshCw className="size-3.5" />
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowTokenInput(!showTokenInput)}
                    className="h-7 px-2.5 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-white/80 text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                    title="Nhập Token nếu chưa đồng bộ được"
                  >
                    <Key className="size-3 text-cyan-400" />
                    <span>Mã Token</span>
                  </button>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleCompleteLogin()}
                    disabled={loading}
                    className="h-7 px-3 text-[11px] font-medium cursor-pointer bg-cyan-600 hover:bg-cyan-700 text-white rounded-full gap-1 shadow-sm"
                  >
                    <Check className="size-3" />
                    <span>Lưu & Hoàn tất</span>
                  </Button>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="size-7 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-white/80 flex items-center justify-center cursor-pointer transition-colors"
                  title="Đóng iPhone View"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              {/* Home Indicator Bar (Thanh gạt về Home của iPhone) */}
              <div className="w-28 h-1 bg-white/40 rounded-full mx-auto mt-0.5" />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
