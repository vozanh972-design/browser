"use client";

import {
  Globe,
  KeyRound,
  Loader2,
  Lock,
  RotateCcw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DOLIKE_BASE_URL, verifyDolikeToken } from "@/lib/dolike-api";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";

interface DolikeLoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: {
    email: string;
    displayName?: string;
    userId?: string | number;
    balance: string;
    bearerToken?: string;
  }) => void;
}

const DOLIKE_INJECT_SNIPPET = `
(function() {
  if (window.__hasInjectedDolikeHook) {
    if (window.dolikeCaptureSession) window.dolikeCaptureSession();
    return;
  }
  window.__hasInjectedDolikeHook = true;

  function readHeader(headers, name) {
    if (!headers || !name) return '';
    try {
      if (typeof headers.get === 'function') 
        return headers.get(name) || headers.get(name.toLowerCase()) || '';
    } catch(e) {}
    try {
      if (Array.isArray(headers)) {
        for (let i = 0; i < headers.length; i++) {
          let h = headers[i] || [];
          if (String(h[0]).toLowerCase() === name.toLowerCase()) return h[1] || '';
        }
      }
    } catch(e) {}
    try {
      if (typeof headers === 'object') {
        for (let k in headers) {
          if (k.toLowerCase() === name.toLowerCase()) return headers[k] || '';
        }
      }
    } catch(e) {}
    return '';
  }

  function sendToken(token) {
    if (!token || typeof token !== 'string') return;
    let clean = token.trim().replace(/^Bearer\\s+/i, '');
    if (clean.length > 50 && clean.startsWith('eyJ')) {
      try {
        window.parent.postMessage({
          type: 'DOLIKE_SESSION',
          token: clean
        }, '*');
      } catch(e) {}
    }
  }

  function captureStorage() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        let k = localStorage.key(i) || '';
        let val = localStorage.getItem(k) || '';
        if (typeof val === 'string' && val.includes('eyJhbGciOi')) {
          sendToken(val);
        }
      }
    } catch(e) {}
  }
  window.dolikeCaptureSession = captureStorage;

  let origFetch = window.fetch;
  window.fetch = function() {
    try {
      let opts = arguments[1] || {};
      let h = (arguments[0] && arguments[0].headers) || opts.headers;
      let auth = readHeader(h, 'authorization') || readHeader(h, 'x-api-token');
      if (auth) sendToken(auth);
    } catch(e) {}
    let promise = origFetch.apply(this, arguments);
    promise.then(function() {
      setTimeout(captureStorage, 500);
    }).catch(function() {});
    return promise;
  };

  let origSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
    try {
      let hl = String(header).toLowerCase();
      if (hl === 'authorization' || hl === 'x-api-token') {
        sendToken(value);
      }
    } catch(e) {}
    return origSetRequestHeader.apply(this, arguments);
  };

  captureStorage();
  setInterval(captureStorage, 1000);
})();
`;

/**
 * Giao diện kết nối DoLike 100% chuẩn GoMax 1.2.4:
 * 1. Chế độ Web: In-App WebView nội bộ dạng Liquid Glass Window (chuẩn DolikeWebLoginActivity).
 *    - Chạy trực tiếp bên trong ứng dụng với cờ an toàn WebView2.
 *    - Tự động bắt Token JWT khi người dùng đăng nhập thành công qua Dual-Detection (Hook + LevelDB).
 *    - Tự động đóng modal và đồng bộ số dư.
 * 2. Chế độ Token: Nhập mã Authorization Token DoLike thủ công (chuẩn Dialog Lx/n2;).
 */
export function DolikeLoginDialog({
  isOpen,
  onClose,
  onLoginSuccess,
}: DolikeLoginDialogProps) {
  const [activeTab, setActiveTab] = useState<"webview" | "token">("webview");
  const [iframeKey, setIframeKey] = useState(0);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [isProcessingLogin, setIsProcessingLogin] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState("");

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isCompletedRef = useRef(false);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  // Quét LevelDB native từ backend Rust (chuẩn GoMax)
  const checkLeveldbSession = async (): Promise<{
    token: string;
    email?: string;
    userId?: string | number;
  } | null> => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const res: any = await invoke("extract_dolike_session");
      if (res?.success && res?.token) {
        return {
          token: res.token,
          email: res.email,
          userId: res.userId,
        };
      }
    } catch {
      // ignore
    }
    return null;
  };

  // Xử lý hoàn tất đăng nhập tự động
  const handleAutoLoginSuccess = async (rawToken: string) => {
    if (isCompletedRef.current) return;
    isCompletedRef.current = true;
    stopPolling();
    setIsProcessingLogin(true);

    try {
      const clean = rawToken.trim().replace(/^Bearer\s+/i, "");
      const result = await verifyDolikeToken(clean);

      if (result.success) {
        const userEmail = result.email || "DoLike User";
        const userDisplay = result.displayName || userEmail;
        const balance = result.balance || "0 đ";

        try {
          localStorage.setItem("dolike_auth_token", clean);
          localStorage.setItem("dolike_bearer_token", clean);
          localStorage.setItem("dolike_email", userEmail);
          localStorage.setItem("dolike_display_name", userDisplay);
          localStorage.setItem("dolike_balance", balance);
          if (result.userId) {
            localStorage.setItem("dolike_user_id", String(result.userId));
          }
        } catch {
          // ignore
        }

        showSuccessToast(`Đăng nhập DoLike thành công: ${userDisplay} (${balance})`);

        onLoginSuccess({
          email: userEmail,
          displayName: userDisplay,
          userId: result.userId,
          balance,
          bearerToken: clean,
        });

        onClose();
      } else {
        isCompletedRef.current = false;
        setIsProcessingLogin(false);
        showErrorToast(result.error || "Token trích xuất không hợp lệ!");
      }
    } catch (err: unknown) {
      isCompletedRef.current = false;
      setIsProcessingLogin(false);
      const msg = err instanceof Error ? err.message : "Lỗi xác thực DoLike";
      showErrorToast(msg);
    }
  };

  // Tiêm hook script vào iframe
  const tryInjectAndInspect = () => {
    try {
      const iframe = iframeRef.current;
      if (!iframe || !iframe.contentWindow) return;
      const cw = iframe.contentWindow as any;

      if (!cw.__hasInjectedDolikeHook && cw.document && (cw.document.head || cw.document.documentElement)) {
        cw.__hasInjectedDolikeHook = true;
        const s = cw.document.createElement("script");
        s.textContent = DOLIKE_INJECT_SNIPPET;
        (cw.document.head || cw.document.documentElement).appendChild(s);
      } else if (cw.dolikeCaptureSession) {
        cw.dolikeCaptureSession();
      }
    } catch {
      // fallback
    }
  };

  // Lắng nghe postMessage từ iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = event.data;
        if (!data || isCompletedRef.current) return;
        if (data.type === "DOLIKE_SESSION" && data.token) {
          void handleAutoLoginSuccess(data.token);
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Khởi động khi mở Dialog
  useEffect(() => {
    if (!isOpen) {
      stopPolling();
      setIsProcessingLogin(false);
      isCompletedRef.current = false;
      setTokenError("");
      setTokenLoading(false);
      return;
    }

    isCompletedRef.current = false;
    setIsProcessingLogin(false);
    setIframeLoading(true);
    setIframeKey((prev) => prev + 1);

    const loadTimeout = setTimeout(() => {
      setIframeLoading(false);
    }, 4000);

    // Bật polling song song phát hiện qua LevelDB
    let isChecking = false;
    pollingRef.current = setInterval(async () => {
      if (isCompletedRef.current || isChecking) return;
      isChecking = true;
      try {
        tryInjectAndInspect();
        const detected = await checkLeveldbSession();
        if (detected?.token) {
          await handleAutoLoginSuccess(detected.token);
        }
      } finally {
        isChecking = false;
      }
    }, 800);

    return () => {
      clearTimeout(loadTimeout);
      stopPolling();
    };
  }, [isOpen]);

  // Làm mới iframe
  const handleReloadIframe = () => {
    setIframeKey((k) => k + 1);
    setIframeLoading(true);
  };

  // Xử lý xác thực Token thủ công (Lx/n2;)
  const handleVerifyManualToken = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanToken = tokenInput.trim().replace(/^Bearer\s+/i, "");

    if (!cleanToken) {
      setTokenError("Vui lòng nhập Authorization Token DoLike");
      showErrorToast("Vui lòng nhập Authorization Token DoLike");
      return;
    }

    setTokenLoading(true);
    setTokenError("");

    try {
      const result = await verifyDolikeToken(cleanToken);

      if (result.success) {
        const userEmail = result.email || "DoLike User";
        const userDisplay = result.displayName || userEmail;
        const balance = result.balance || "0 đ";

        try {
          localStorage.setItem("dolike_auth_token", cleanToken);
          localStorage.setItem("dolike_bearer_token", cleanToken);
          localStorage.setItem("dolike_email", userEmail);
          localStorage.setItem("dolike_display_name", userDisplay);
          localStorage.setItem("dolike_balance", balance);
          if (result.userId) {
            localStorage.setItem("dolike_user_id", String(result.userId));
          }
        } catch {
          // ignore
        }

        showSuccessToast("Kết nối DoLike thành công!");

        onLoginSuccess({
          email: userEmail,
          displayName: userDisplay,
          userId: result.userId,
          balance,
          bearerToken: cleanToken,
        });

        setTokenInput("");
        onClose();
      } else {
        const err = result.error || "Authorization Token DoLike không hợp lệ!";
        setTokenError(err);
        showErrorToast(err);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Authorization Token DoLike không hợp lệ!";
      setTokenError(msg);
      showErrorToast(msg);
    } finally {
      setTokenLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        hideClose={true}
        className="p-0 border-0 bg-transparent shadow-none max-w-sm w-full focus:outline-none flex flex-col items-center justify-center select-none"
      >
        {/* ================= Khung Liquid Glass Window phong cách GoMax ================= */}
        <div className="relative w-[380px] bg-zinc-950/85 backdrop-blur-3xl rounded-[34px] border border-white/20 shadow-[0_30px_90px_rgba(0,0,0,0.85)] ring-1 ring-white/10 overflow-hidden flex flex-col">
          {/* 1. THANH ĐỈNH DYNAMIC ISLAND & ĐIỀU HƯỚNG TAB */}
          <div className="relative z-30 h-10 w-full bg-zinc-950/90 backdrop-blur-xl border-b border-white/10 flex items-center justify-between px-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="text-[11px] text-zinc-400 hover:text-white transition-colors cursor-pointer font-medium"
            >
              ✕ Đóng
            </button>

            {/* Bộ chuyển đổi chế độ Web / Token */}
            <div className="flex items-center gap-1 bg-black/60 p-0.5 rounded-full border border-white/10">
              <button
                type="button"
                onClick={() => setActiveTab("webview")}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-all cursor-pointer flex items-center gap-1 ${
                  activeTab === "webview"
                    ? "bg-fuchsia-600 text-white shadow-xs"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Globe className="size-2.5" />
                <span>Web DoLike</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("token")}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-all cursor-pointer flex items-center gap-1 ${
                  activeTab === "token"
                    ? "bg-fuchsia-600 text-white shadow-xs"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <KeyRound className="size-2.5" />
                <span>Dán Token</span>
              </button>
            </div>

            {activeTab === "webview" ? (
              <button
                type="button"
                onClick={handleReloadIframe}
                title="Làm mới trang web"
                className="text-[11px] text-fuchsia-400 hover:text-fuchsia-300 transition-colors flex items-center gap-1 cursor-pointer font-medium"
              >
                <RotateCcw className="size-3" />
              </button>
            ) : (
              <div className="w-4" />
            )}
          </div>

          {/* 2. NỘI DUNG CHÍNH */}
          {activeTab === "webview" ? (
            /* TAB 1: IN-APP WEBVIEW NỘI BỘ (DolikeWebLoginActivity) */
            <div className="relative w-full h-[580px] bg-white overflow-hidden">
              {(iframeLoading || isProcessingLogin) && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-950/85 backdrop-blur-xs gap-3">
                  <Loader2 className="size-8 text-fuchsia-400 animate-spin" />
                  <span className="text-xs text-zinc-200 font-medium text-center px-4">
                    {isProcessingLogin
                      ? "Đang tự động bắt Token và lưu phiên..."
                      : "Đang tải trang đăng nhập DoLike..."}
                  </span>
                </div>
              )}

              <iframe
                key={iframeKey}
                ref={iframeRef}
                src={DOLIKE_BASE_URL}
                onLoad={() => {
                  setIframeLoading(false);
                  tryInjectAndInspect();
                }}
                className="w-full h-full border-0"
                allow="clipboard-read; clipboard-write"
                title="DoLike Web View"
              />
            </div>
          ) : (
            /* TAB 2: NHẬP TOKEN THỦ CÔNG (Lx/n2;) */
            <div className="p-5 flex flex-col justify-center min-h-[380px] bg-zinc-950/95 space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <KeyRound className="size-4 text-fuchsia-400" />
                  <span>Xác nhận Token DoLike</span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Dán chuỗi Authorization Token DoLike (JWT) để kết nối trực tiếp.
                </p>
              </div>

              {tokenError && (
                <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-400 flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{tokenError}</span>
                </div>
              )}

              <form onSubmit={handleVerifyManualToken} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="manual-token" className="text-xs text-zinc-300">
                    Authorization Token DoLike
                  </Label>
                  <Input
                    id="manual-token"
                    type="text"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    disabled={tokenLoading}
                    className="text-xs h-9 bg-zinc-900 border-zinc-800 text-zinc-100 font-mono"
                    autoFocus
                  />
                  <p className="text-[11px] text-zinc-500">
                    Hỗ trợ Token đầy đủ có hoặc không có tiền tố &quot;Bearer&quot;.
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab("webview")}
                    className="text-xs h-8 border-zinc-800 text-zinc-300 hover:bg-zinc-900"
                  >
                    Về Web DoLike
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={tokenLoading}
                    className="text-xs h-8 bg-fuchsia-600 hover:bg-fuchsia-700 text-white flex items-center gap-1.5"
                  >
                    {tokenLoading && <Loader2 className="size-3.5 animate-spin" />}
                    <span>{tokenLoading ? "Đang kiểm tra..." : "Xác nhận Token"}</span>
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* 3. THANH TRUY CẬP DƯỚI (SAFARI LIQUID GLASS) */}
          <div className="relative z-30 bg-zinc-950/90 backdrop-blur-2xl px-4 pt-2.5 pb-3 flex flex-col items-center justify-center shrink-0 border-t border-white/10">
            <div className="h-8 w-full max-w-[280px] rounded-full bg-zinc-900/90 border border-white/15 px-3.5 flex items-center justify-center gap-2 text-xs text-zinc-300 shadow-inner">
              <Lock className="size-3 text-fuchsia-400 shrink-0" />
              <span className="font-medium tracking-tight text-[11px] text-zinc-200">
                congtingudolike.servehttp.com
              </span>
            </div>

            {/* Home Indicator */}
            <button
              type="button"
              onClick={onClose}
              className="w-28 h-1 bg-white/30 hover:bg-white/60 rounded-full mt-2 transition-colors cursor-pointer"
              title="Đóng cửa sổ"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
