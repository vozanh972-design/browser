"use client";

import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Globe,
  Key,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
const GOLIKE_LOGIN_URL = "https://app.golike.net/login";

export function GolikeLoginDialog({
  isOpen,
  onClose,
  onLoginSuccess,
}: GolikeLoginDialogProps) {
  const [showWebview, setShowWebview] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [inputText, setInputText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Dọn dẹp khi đóng dialog
  useEffect(() => {
    if (!isOpen) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      setShowWebview(false);
      setLoading(false);
      setStatusMessage("");
      setError("");
      setShowManualInput(false);
    }
  }, [isOpen]);

  // Lắng nghe postMessage từ iframe hoặc webview
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      try {
        const data = event.data;
        if (!data) return;

        // Bắt sự kiện session từ script tiêm
        if (
          (data.type === "GOLIKE_SESSION" || data.type === "GOLIKE_HEADERS") &&
          data.session?.golike_token
        ) {
          setStatusMessage("Đã nhận phiên đăng nhập! Đang đồng bộ...");
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
      try {
        const res = await fetch(`${BRIDGE_URL}/session`, { cache: "no-store" });
        if (!res.ok) return;

        const data = await res.json();
        if (data?.hasSession && data?.session?.golike_token) {
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }

          setStatusMessage("Đã nhận đủ phiên làm việc! Đang đồng bộ...");
          await handleCompleteLogin(data.session);
        }
      } catch {
        // bridge chưa sẵn sàng hoặc không bật
      }
    }, 1200);
  };

  const handleOpenInAppWebview = () => {
    setError("");
    setShowWebview(true);
    setIframeLoading(true);
    setIframeKey((prev) => prev + 1);
    startPollingSession();
  };

  const handleReloadIframe = () => {
    setIframeLoading(true);
    setIframeKey((prev) => prev + 1);
  };

  const handleCompleteLogin = async (sessionData: Partial<GolikeSessionData>) => {
    setLoading(true);
    setError("");

    try {
      // 1. Lưu đủ 17 trường vào storage
      const fullSession = saveGolikeSession(sessionData);

      // 2. Đồng bộ Protocol với Golike Gateway
      try {
        await syncGolikeProtocol(fullSession);
      } catch {
        // ignore
      }

      // 3. Xác thực và lấy số coin
      const res = await getGolikeUser(fullSession);

      if (!res.success || !res.user) {
        setLoading(false);
        setError(
          res.error ||
            "Phiên làm việc GoLike không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.",
        );
        return;
      }

      const balance = `${res.user.coin.toLocaleString("vi-VN")} coin`;

      try {
        localStorage.setItem("golike_username", res.user.username);
        localStorage.setItem("golike_balance", balance);
      } catch {
        // ignore
      }

      setLoading(false);
      showSuccessToast(
        `Đăng nhập GoLike thành công! Chào mừng ${res.user.username}`,
      );

      onLoginSuccess({
        username: res.user.username,
        balance,
        token: fullSession.golike_token,
      });

      setInputText("");
      onClose();
    } catch (err: unknown) {
      setLoading(false);
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Lỗi hoàn tất đăng nhập: ${msg}`);
    }
  };

  const handleManualLogin = async () => {
    const raw = inputText.trim();
    if (!raw) {
      setError("Vui lòng nhập Token hoặc chuỗi JSON 17 trường.");
      return;
    }

    if (
      raw.includes("function") ||
      raw.includes("=>") ||
      raw.includes("hasInjected") ||
      raw.includes("localStorage.getItem")
    ) {
      setError(
        "Bạn vừa dán đoạn mã JavaScript! Vui lòng không dán script vào ô này. Hãy bấm 'Mở WebView đăng nhập' để đăng nhập trực tiếp trên giao diện web.",
      );
      return;
    }

    setLoading(true);
    setError("");

    let sessionToSave: Partial<GolikeSessionData> = {};

    if (raw.startsWith("{") && raw.endsWith("}")) {
      try {
        const parsed = JSON.parse(raw);
        sessionToSave = {
          golike_token:
            parsed.golike_token || parsed.token || parsed.authorization || "",
          golike_t_header: parsed.golike_t_header || parsed.t || "",
          golike_g_auth: parsed.golike_g_auth || parsed["g-auth"] || "",
          golike_device_id:
            parsed.golike_device_id ||
            parsed.deviceId ||
            parsed.device_id ||
            "",
          golike_username: parsed.golike_username || parsed.username || "",
          golike_user_id: String(
            parsed.golike_user_id || parsed.user_id || "",
          ),
          golike_signing_key:
            parsed.golike_signing_key || parsed.signing_key || "",
          golike_web_data: parsed.golike_web_data || "null",
          golike_web_cookies:
            parsed.golike_web_cookies || parsed.cookies || "",
          golike_header: parsed.golike_header || {},
          golike_tiktok_map: parsed.golike_tiktok_map || {},
          golike_version_app: parsed.golike_version_app || "3.0",
          golike_web_version: parsed.golike_web_version || "3.0",
          golike_web_version_text:
            parsed.golike_web_version_text || "26.09.17.1",
          golike_protocol: parsed.golike_protocol || "v2",
          golike_gauth_version: parsed.golike_gauth_version || "1.0",
          golike_scheme: parsed.golike_scheme || "https",
        };
      } catch {
        setLoading(false);
        setError("Chuỗi JSON không hợp lệ. Vui lòng kiểm tra lại định dạng.");
        return;
      }
    } else {
      const cleanToken = raw
        .replace(/^Bearer\s+/i, "")
        .replace(/[^\x20-\x7E\xA0-\xFF]/g, "")
        .trim();

      if (!cleanToken) {
        setLoading(false);
        setError("Mã Token không hợp lệ. Vui lòng kiểm tra lại.");
        return;
      }

      sessionToSave = {
        golike_token: `Bearer ${cleanToken}`,
      };
    }

    await handleCompleteLogin(sessionToSave);
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputText(text.trim());
        if (error) setError("");
      }
    } catch {
      // ignore
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={`p-0 gap-0 overflow-hidden rounded-2xl border border-border/80 shadow-2xl bg-card transition-all duration-300 ${
          showWebview ? "max-w-md w-full" : "max-w-lg"
        }`}
      >
        {/* Header Dialog */}
        <DialogHeader className="p-4 pb-3 border-b border-border/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                {showWebview ? (
                  <Smartphone className="size-4.5" />
                ) : (
                  <ShieldCheck className="size-4.5" />
                )}
              </div>
              <div>
                <DialogTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <span>
                    {showWebview
                      ? "WebView GoLike (Chế độ Mobile)"
                      : "Đăng nhập tài khoản GoLike"}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-[11px] text-muted-foreground mt-0.5">
                  {showWebview
                    ? "Đăng nhập trực tiếp trên WebView bên trong app để lưu phiên làm việc."
                    : "Mở giao diện web và đăng nhập tài khoản GoLike để tự động lưu phiên làm việc."}
                </DialogDescription>
              </div>
            </div>

            {showWebview && (
              <button
                type="button"
                onClick={() => setShowWebview(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 cursor-pointer"
                title="Quay lại"
              >
                <ArrowLeft className="size-4" />
              </button>
            )}
          </div>
        </DialogHeader>

        {/* Nội dung: WebView Mode hoặc Mode Khởi chạy */}
        {showWebview ? (
          /* GIAO DIỆN WEBVIEW TRỰC TIẾP TRONG APP (PHONE FRAME MOCKUP) */
          <div className="flex flex-col bg-background/50">
            {/* Thanh điều hướng giả lập trình duyệt di động */}
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
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                  title="Tải lại trang"
                >
                  <RefreshCw className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Khung WebView Mobile */}
            <div className="relative w-full h-[540px] bg-white overflow-hidden">
              {iframeLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-xs gap-2">
                  <Loader2 className="size-6 text-cyan-400 animate-spin" />
                  <span className="text-xs text-muted-foreground font-medium">
                    Đang tải WebView GoLike...
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
                title="GoLike Login Mobile WebView"
              />
            </div>

            {/* Thanh điều khiển dưới WebView */}
            <div className="p-3 bg-muted/30 border-t border-border/40 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">
                  Sau khi đăng nhập xong trên web, bấm nút bên phải:
                </span>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setShowManualInput(!showManualInput)}
                  variant="outline"
                  className="h-7 text-[11px] px-2.5 cursor-pointer"
                >
                  <Key className="size-3 mr-1 text-cyan-400" />
                  <span>Dán Token thủ công</span>
                </Button>
              </div>

              {showManualInput && (
                <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-background/80 border border-border/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground font-medium">
                      Dán Authorization Token hoặc JSON Session:
                    </span>
                    <button
                      type="button"
                      onClick={handlePasteClipboard}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 cursor-pointer font-medium"
                    >
                      Dán nhanh
                    </button>
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Bearer eyJhbGci..."
                      className="flex-1 h-7 text-xs font-mono px-2 rounded-md bg-muted/40 border border-border/60"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleManualLogin}
                      disabled={loading || !inputText.trim()}
                      className="h-7 text-xs bg-cyan-600 hover:bg-cyan-700 text-white cursor-pointer px-3"
                    >
                      {loading ? "Đang lưu..." : "Lưu"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* GIAO DIỆN CHÍNH: NÚT MỞ WEBVIEW & TÙY CHỌN DỰ PHÒNG */
          <div className="p-5 flex flex-col gap-4 text-xs">
            {/* Card chính: Mở WebView Mobile bên trong app */}
            <div className="p-4 rounded-xl border border-cyan-500/30 bg-linear-to-b from-cyan-500/10 to-transparent flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 shrink-0 mt-0.5">
                  <Smartphone className="size-5" />
                </div>
                <div className="flex flex-col gap-1">
                  <h4 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                    <span>Mở WebView đăng nhập bên trong app</span>
                    <Sparkles className="size-3.5 text-cyan-400" />
                  </h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Tạo cửa sổ WebView giao diện Mobile trực tiếp trong ứng dụng. Bạn chỉ cần nhập tài khoản và mật khẩu, hệ thống sẽ tự động lưu phiên làm việc đầy đủ mà không cần mở trình duyệt bên ngoài.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                onClick={handleOpenInAppWebview}
                disabled={loading}
                className="w-full h-9 text-xs font-semibold cursor-pointer bg-cyan-600 hover:bg-cyan-700 text-white gap-2 shadow-sm"
              >
                <Globe className="size-3.5" />
                <span>Mở WebView Đăng Nhập GoLike</span>
              </Button>
            </div>

            {/* Nút bật/tắt nhập thủ công */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowManualInput(!showManualInput)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer font-medium transition-colors"
              >
                {showManualInput ? (
                  <ChevronUp className="size-3.5" />
                ) : (
                  <ChevronDown className="size-3.5" />
                )}
                <span>Hoặc dán Token / JSON Session thủ công (Dự phòng)</span>
              </button>
            </div>

            {/* Form nhập thủ công (Collapsible) */}
            {showManualInput && (
              <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-muted/20 border border-border/60">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="golike-manual-input"
                    className="text-xs font-semibold text-foreground flex items-center gap-1.5"
                  >
                    <Key className="size-3.5 text-cyan-400" />
                    <span>Dán Token hoặc JSON Session</span>
                  </Label>
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 cursor-pointer font-medium"
                  >
                    <Clipboard className="size-3" />
                    <span>Dán</span>
                  </button>
                </div>

                <Textarea
                  id="golike-manual-input"
                  rows={3}
                  placeholder="Dán mã Authorization Token (Bearer ...) hoặc chuỗi JSON session tại đây..."
                  value={inputText}
                  onChange={(e) => {
                    setInputText(e.target.value);
                    if (error) setError("");
                  }}
                  className="text-xs font-mono resize-none bg-background/60"
                />

                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={handleManualLogin}
                    disabled={loading || !inputText.trim()}
                    className="h-7 text-[11px] px-3 cursor-pointer"
                  >
                    {loading ? "Đang xác thực..." : "Xác nhận & Đồng bộ"}
                  </Button>
                </div>
              </div>
            )}

            {/* Thông báo lỗi nếu có */}
            {error && (
              <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-[11px] text-destructive flex items-start gap-2">
                <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                <span className="leading-tight font-medium">{error}</span>
              </div>
            )}
          </div>
        )}

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
