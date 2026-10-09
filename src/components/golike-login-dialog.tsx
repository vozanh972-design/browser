"use client";

import {
  AlertCircle,
  Check,
  ChevronLeft,
  Key,
  Loader2,
  Lock,
  RefreshCw,
  Sparkles,
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
const BRIDGE_API = "http://127.0.0.1:18899";

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
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [detectedUser, setDetectedUser] = useState<{
    username: string;
    balance: string;
    token: string;
    session?: Partial<GolikeSessionData>;
  } | null>(null);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Thử trích xuất session từ Bridge / LevelDB
  const checkSessionFromBridge = async (silent = true) => {
    try {
      const res = await fetch(`${BRIDGE_API}/extract-session`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data?.success && data?.user?.token) {
        const u = {
          username: data.user.username || "GoLike User",
          balance: data.user.balance || "0 coin",
          token: data.user.token,
          session: data.session || {},
        };
        setDetectedUser(u);
        return u;
      }
    } catch {
      // Bridge server có thể chưa mở nếu chạy độc lập
    }
    return null;
  };

  // Reset và kích hoạt polling khi mở dialog
  useEffect(() => {
    if (!isOpen) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      setLoading(false);
      setStatusMessage("");
      setError("");
      setShowTokenInput(false);
      setTokenInput("");
      setDetectedUser(null);
      return;
    }

    setIframeLoading(true);
    setError("");
    setStatusMessage("");
    setDetectedUser(null);

    // Kiểm tra ngay khi vừa mở
    checkSessionFromBridge(true);

    // Polling nhẹ mỗi 1.5s để tự động bắt phiên ngay khi người dùng đăng nhập
    pollingRef.current = setInterval(async () => {
      await checkSessionFromBridge(true);
    }, 1500);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [isOpen]);

  // Lắng nghe postMessage từ iframe (nếu có hook)
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

  // Hoàn tất lưu phiên làm việc, lưu đủ 17 trường và đồng bộ UI
  const handleCompleteLogin = async (manualSession?: Partial<GolikeSessionData>) => {
    setLoading(true);
    setStatusMessage("Đang kiểm tra và đồng bộ phiên GoLike...");
    setError("");

    try {
      // 1. Ưu tiên kiểm tra dữ liệu từ Bridge / LevelDB mới nhất
      let activeUser = detectedUser;
      if (!activeUser && !manualSession && !tokenInput.trim()) {
        activeUser = await checkSessionFromBridge(false);
      }

      let tokenToUse =
        manualSession?.golike_token ||
        tokenInput.trim() ||
        activeUser?.token ||
        "";

      let fullSession: GolikeSessionData;

      if (tokenToUse) {
        if (!tokenToUse.startsWith("Bearer ")) {
          tokenToUse = `Bearer ${tokenToUse}`;
        }

        fullSession = saveGolikeSession({
          ...(activeUser?.session || {}),
          ...manualSession,
          golike_token: tokenToUse,
          golike_username: activeUser?.username || manualSession?.golike_username || "",
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
          setError("Chưa nhận diện được phiên đăng nhập. Vui lòng đăng nhập trên màn hình hoặc dán mã Token.");
          return;
        }
      }

      let username = activeUser?.username || "";
      let balance = activeUser?.balance || "";

      // Nếu chưa có username hoặc balance, gọi API gateway để lấy chuẩn
      if (!username || !balance || username === "GoLike User") {
        setStatusMessage("Đang truy vấn số coin thực tế...");
        const userRes = await getGolikeUser(fullSession);
        if (userRes.success && userRes.user) {
          username = userRes.user.username;
          balance = `${userRes.user.coin.toLocaleString("vi-VN")} coin`;
        }
      }

      if (!username) username = "GoLike User";
      if (!balance) balance = "0 coin";

      // Lưu 17 trường và dữ liệu hiển thị vào localStorage
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

      setLoading(false);
      showSuccessToast(`Đăng nhập GoLike thành công: ${username} (${balance})`);

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
        {/* ================= macOS iPhone Mirroring / Liquid Glass Window ================= */}
        <div className="relative w-[380px] bg-zinc-950/80 backdrop-blur-3xl rounded-[34px] border border-white/20 shadow-[0_30px_90px_rgba(0,0,0,0.85)] ring-1 ring-white/10 overflow-hidden flex flex-col select-none">
          {/* 1. THANH SAFARI HEADER (LIQUID GLASS CAPSULE & SSL LOCK) */}
          <div className="relative z-30 h-13 w-full px-4.5 bg-zinc-900/60 backdrop-blur-xl border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
            {/* Nút Back Safari */}
            <button
              type="button"
              onClick={handleReloadIframe}
              className="size-7 rounded-full bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Tải lại trang"
            >
              <ChevronLeft className="size-4" />
            </button>

            {/* Thanh địa chỉ Safari Floating Pill */}
            <div className="h-8 flex-1 max-w-[230px] rounded-full bg-black/50 border border-white/15 px-3 flex items-center justify-between text-xs text-zinc-300 shadow-inner group">
              <div className="flex items-center gap-1.5 min-w-0">
                <Lock className="size-3 text-emerald-400 shrink-0" />
                <span className="font-medium tracking-tight text-[11.5px] truncate text-zinc-200">
                  app.golike.net
                </span>
              </div>
              <button
                type="button"
                onClick={handleReloadIframe}
                className="text-zinc-400 hover:text-white transition-colors cursor-pointer ml-1"
                title="Làm mới"
              >
                <RefreshCw className="size-3" />
              </button>
            </div>

            {/* Nút Đóng cửa sổ */}
            <button
              type="button"
              onClick={onClose}
              className="size-7 rounded-full bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Đóng cửa sổ"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* 2. MÀN HÌNH NỘI DUNG WEBVIEW GOLIKE NẠP TRỰC TIẾP */}
          <div className="relative w-full h-[580px] bg-white overflow-hidden">
            {(iframeLoading || loading) && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-950/85 backdrop-blur-xs gap-3">
                <Loader2 className="size-8 text-cyan-400 animate-spin" />
                <span className="text-xs text-zinc-200 font-medium text-center px-4">
                  {statusMessage ||
                    (iframeLoading
                      ? "Đang nạp trực tiếp giao diện GoLike..."
                      : "Đang lưu và đồng bộ phiên...")}
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
              title="GoLike Safari View"
            />
          </div>

          {/* 3. THANH ĐÁY SAFARI NAVIGATION & LIVE SYNC BAR (LIQUID GLASS) */}
          <div className="relative z-30 bg-zinc-950/90 backdrop-blur-2xl px-4 pt-3 pb-3 flex flex-col gap-2.5 shrink-0 border-t border-white/10">
            {/* Live Status Badge */}
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[11px]">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`size-2 rounded-full shrink-0 ${
                    detectedUser
                      ? "bg-emerald-400 shadow-[0_0_8px_#34d399]"
                      : "bg-cyan-400 animate-pulse"
                  }`}
                />
                <span className="truncate text-zinc-300">
                  {detectedUser ? (
                    <span className="text-emerald-300 font-medium">
                      Đã nhận diện: {detectedUser.username} ({detectedUser.balance})
                    </span>
                  ) : (
                    <span>Đang chờ đăng nhập trên GoLike...</span>
                  )}
                </span>
              </div>

              {detectedUser && (
                <Sparkles className="size-3 text-emerald-400 shrink-0" />
              )}
            </div>

            {/* Form nhập Token nhanh nếu cần đồng bộ thủ công */}
            {showTokenInput && (
              <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-zinc-900 border border-white/15 animate-in fade-in zoom-in-95 duration-200">
                <input
                  type="text"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Dán mã Authorization Token (Bearer...)"
                  className="flex-1 h-7 text-[11px] font-mono px-2.5 rounded-lg bg-black/60 text-white border border-white/10 focus:outline-none focus:border-cyan-500/50"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleCompleteLogin()}
                  disabled={loading || !tokenInput.trim()}
                  className="h-7 text-[11px] bg-cyan-600 hover:bg-cyan-700 text-white px-2.5 rounded-lg cursor-pointer"
                >
                  Xác nhận
                </Button>
              </div>
            )}

            {/* Thông báo lỗi nếu có */}
            {error && (
              <div className="px-2.5 py-1.5 rounded-lg bg-destructive/15 border border-destructive/30 text-[10.5px] text-red-400 flex items-start gap-1.5">
                <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                <span className="leading-tight">{error}</span>
              </div>
            )}

            {/* Hàng nút điều khiển & Đồng bộ */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleReloadIframe}
                className="size-7 rounded-full bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Tải lại trang GoLike"
              >
                <RefreshCw className="size-3.5" />
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowTokenInput(!showTokenInput)}
                  className="h-7.5 px-3 rounded-full bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white text-[11.5px] font-medium flex items-center gap-1.5 cursor-pointer transition-colors border border-white/10"
                  title="Dán mã Token thủ công nếu cần"
                >
                  <Key className="size-3 text-cyan-400" />
                  <span>Mã Token</span>
                </button>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleCompleteLogin()}
                  disabled={loading}
                  className="h-7.5 px-3.5 text-[11.5px] font-medium cursor-pointer bg-cyan-600 hover:bg-cyan-500 text-white rounded-full gap-1.5 shadow-[0_2px_12px_rgba(6,182,212,0.35)] transition-all"
                >
                  {loading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5" />
                  )}
                  <span>Lưu & Hoàn tất</span>
                </Button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="size-7 rounded-full bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Đóng"
              >
                <X className="size-3.5" />
              </button>
            </div>

            {/* Home Indicator Bar (Thanh gạt Home iPhone) */}
            <div className="w-32 h-1 bg-white/30 rounded-full mx-auto mt-0.5" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
