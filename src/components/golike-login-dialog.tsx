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

const GOMAX_INJECT_SNIPPET = `
(function() {
  if (window.__hasInjectedGolikeHook) {
    if (window.goMaxCaptureSessionStore) window.goMaxCaptureSessionStore();
    return;
  }
  window.__hasInjectedGolikeHook = true;

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

  function sendAuth(auth, headers) {
    if (!auth || auth === 'null' || auth === 'Bearer null' || auth.length < 50) return;
    try {
      let t = readHeader(headers, 't');
      let gAuth = readHeader(headers, 'g-auth');
      let gDevId = readHeader(headers, 'g-device-id');
      let gUser = readHeader(headers, 'g-username');
      window.parent.postMessage({
        type: 'GOLIKE_SESSION',
        session: {
          golike_token: auth.startsWith('Bearer ') ? auth : 'Bearer ' + auth,
          golike_t_header: t,
          golike_g_auth: gAuth,
          golike_device_id: gDevId,
          golike_username: gUser
        }
      }, '*');
    } catch(e) {}
  }

  function captureSessionStore() {
    try {
      let signingKey = '';
      let userId = '';
      let webData = localStorage.getItem('__') || 'null';
      let deviceId = localStorage.getItem('device_id') || localStorage.getItem('deviceId') || '';
      let username = localStorage.getItem('username') || '';
      let appRoot = document.querySelector('#app');
      let state = appRoot && appRoot.__vue__ && appRoot.__vue__.$store ? appRoot.__vue__.$store.state : null;
      if (!state && appRoot && appRoot.__vue_app__ && appRoot.__vue_app__.config && appRoot.__vue_app__.config.globalProperties && appRoot.__vue_app__.config.globalProperties.$store) {
        state = appRoot.__vue_app__.config.globalProperties.$store.state;
      }
      if (state) {
        signingKey = String(state.signing_key || '');
        userId = String(state.user_id || '');
        if (!deviceId) deviceId = String(state.device_id || state.deviceId || '');
        if (!username) username = String(state.username || state.user_name || '');
      }
      for (let i = 0; i < localStorage.length; i++) {
        let storageKey = localStorage.key(i);
        let raw = localStorage.getItem(storageKey);
        if (!raw) continue;
        if (!signingKey && storageKey === 'signing_key') signingKey = raw;
        if (!userId && storageKey === 'user_id') userId = raw;
      }
      let tok = localStorage.getItem('token') || localStorage.getItem('auth_token') || '';
      if (tok && tok.length > 50) {
        sendAuth(tok, {});
      }
    } catch(e) {}
  }
  window.goMaxCaptureSessionStore = captureSessionStore;

  let origFetch = window.fetch;
  window.fetch = function() {
    try {
      let opts = arguments[1] || {};
      let h = (arguments[0] && arguments[0].headers) || opts.headers;
      let a = readHeader(h, 'authorization');
      if (a) sendAuth(a, h);
    } catch(e) {}
    return origFetch.apply(this, arguments);
  };

  let origSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
    try {
      if (!this._headers) this._headers = {};
      this._headers[String(header).toLowerCase()] = value;
      if (String(header).toLowerCase() === 'authorization') {
        sendAuth(value, this._headers);
      }
    } catch(e) {}
    return origSetRequestHeader.apply(this, arguments);
  };

  captureSessionStore();
})();
`;

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

  // Trích xuất session trực tiếp từ bộ nhớ đĩa LevelDB của WebView (chuẩn native GoMax)
  const checkSession = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const data: any = await invoke("extract_golike_session");
      if ((data?.success || data?.hasSession) && data?.user?.token) {
        const rawToken = (data.user.token || "").trim();
        const fullToken = rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`;

        const coin = Number(data.user.coin ?? 0);
        const username = data.user.username || data.session?.golike_username || "GoLike User";
        const balance = data.user.balance || `${coin.toLocaleString("vi-VN")} coin`;

        return {
          username,
          balance,
          token: fullToken,
          coin,
          session: data.session || {},
        };
      }
    } catch {
      // ignore
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
        user.coin !== undefined
          ? `${user.coin.toLocaleString("vi-VN")} coin`
          : user.balance && user.balance !== "0 coin"
            ? user.balance
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
        localStorage.removeItem("golike_last_logged_out_token");
        localStorage.removeItem("golike_blacklist_token");
        localStorage.removeItem("golike_logged_out_time");
        localStorage.removeItem("golike_logged_out_tokens");
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

      // Tự động đóng webview ngay lập tức giống hệt GoMax (finish())
      onClose();

      // Đồng bộ protocol ngầm và cập nhật thông tin user ngầm sau khi đã đóng webview
      void (async () => {
        try {
          const fresh = await getGolikeUser(fullSession.golike_token);
          if (fresh.success && fresh.user) {
            const freshCoin = fresh.user.coin ?? user.coin ?? 0;
            const freshBalance = `${freshCoin.toLocaleString("vi-VN")} coin`;
            const freshUname = fresh.user.username || username;
            localStorage.setItem("golike_username", freshUname);
            localStorage.setItem("golike_balance", freshBalance);
            saveGolikeSession({
              golike_username: freshUname,
              golike_user_id: (fresh.user as { id?: number | string }).id ? String((fresh.user as { id?: number | string }).id) : fullSession.golike_user_id,
            });
            onLoginSuccess({
              username: freshUname,
              balance: freshBalance,
              token: fullSession.golike_token,
            });
          }
          await syncGolikeProtocol(fullSession);
        } catch {
          // ignore
        }
      })();
    } catch {
      setIsProcessingLogin(false);
      isCompletedRef.current = false;
    }
  };

  const tryClearIframeSession = () => {
    try {
      const iframe = iframeRef.current;
      if (!iframe || !iframe.contentWindow) return;
      const cw = iframe.contentWindow as any;
      if (cw.localStorage) {
        cw.localStorage.clear();
      }
      if (cw.sessionStorage) {
        cw.sessionStorage.clear();
      }
    } catch {
      // Cross-origin catch
    }
  };

  const handleClearWebviewSession = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("clear_golike_session", { token: null });
    } catch {
      // ignore
    }
    tryClearIframeSession();
    setIframeKey((k) => k + 1);
    setIframeLoading(true);
    showSuccessToast("Đã tiêu hủy dữ liệu cũ trên đĩa và làm mới trang!");
  };

  const tryInjectAndInspect = () => {
    try {
      const iframe = iframeRef.current;
      if (!iframe || !iframe.contentWindow) return;
      const cw = iframe.contentWindow as any;

      // 1. Tiêm script hook vào document của iframe (chuẩn GoMax)
      if (!cw.__hasInjectedGolikeHook && cw.document && (cw.document.head || cw.document.documentElement)) {
        cw.__hasInjectedGolikeHook = true;
        const s = cw.document.createElement("script");
        s.textContent = GOMAX_INJECT_SNIPPET;
        (cw.document.head || cw.document.documentElement).appendChild(s);
      } else if (cw.goMaxCaptureSessionStore) {
        cw.goMaxCaptureSessionStore();
      }
    } catch {
      // Cross-origin fallback nếu browser chưa bật cờ
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

    // Khi mở dialog, người dùng chủ động đăng nhập nên xóa bỏ blacklist token cũ
    try {
      localStorage.removeItem("golike_logged_out_tokens");
      localStorage.removeItem("golike_last_logged_out_token");
      localStorage.removeItem("golike_blacklist_token");
      void import("@tauri-apps/api/core").then(({ invoke }) => {
        invoke("reset_golike_logged_out_tokens").catch(() => {});
      });
    } catch {
      // ignore
    }

    // Timeout an toàn: Nếu iframe tải quá 5s vẫn chưa kích hoạt onLoad thì tự động tắt overlay loading
    const loadTimeout = setTimeout(() => {
      setIframeLoading(false);
    }, 5000);

    // Nếu vừa đăng xuất tài khoản cũ, dọn sạch bộ nhớ webview
    if (typeof window !== "undefined" && localStorage.getItem("golike_need_clear_webview")) {
      localStorage.removeItem("golike_need_clear_webview");
      tryClearIframeSession();
    }

    // Tự động lắng nghe và phát hiện đăng nhập thành công khi người dùng thao tác xong
    let isChecking = false;
    pollingRef.current = setInterval(async () => {
      if (isCompletedRef.current || isChecking) return;
      isChecking = true;
      try {
        tryInjectAndInspect();
        const detected = await checkSession();
        if (detected && detected.token) {
          handleAutoLoginSuccess(detected, detected.session);
        }
      } finally {
        isChecking = false;
      }
    }, 800);

    return () => {
      clearTimeout(loadTimeout);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [isOpen]);

  // Lắng nghe postMessage từ iframe (chuẩn GoMax)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = event.data;
        if (!data || isCompletedRef.current) return;

        const rawToken = data.session?.golike_token || data.golike_token || data.auth;
        if (rawToken && typeof rawToken === "string" && rawToken.length >= 50) {
          const fullToken = rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`;
          const username = data.session?.golike_username || data.username || "GoLike User";

          handleAutoLoginSuccess(
            {
              username,
              balance: "0 coin",
              token: fullToken,
            },
            data.session || data,
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
          {/* 1. THANH ĐỈNH DYNAMIC ISLAND */}
          <div className="relative z-30 h-9 w-full bg-zinc-950/90 backdrop-blur-xl border-b border-white/10 flex items-center justify-between px-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="text-[11px] text-zinc-400 hover:text-white transition-colors cursor-pointer font-medium"
            >
              ✕ Đóng
            </button>
            <div className="h-5 w-24 bg-black/80 rounded-full border border-white/10 flex items-center justify-center gap-1.5 px-2">
              <div className="size-2 rounded-full bg-cyan-400" />
              <span className="text-[11px] font-medium tracking-tight text-zinc-300">
                GoLike
              </span>
            </div>
            <button
              type="button"
              onClick={handleClearWebviewSession}
              title="Đổi tài khoản khác / Làm mới trang"
              className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1 cursor-pointer font-medium"
            >
              Làm mới
            </button>
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
              onLoad={() => {
                setIframeLoading(false);
                if (typeof window !== "undefined" && localStorage.getItem("golike_need_clear_webview")) {
                  localStorage.removeItem("golike_need_clear_webview");
                  tryClearIframeSession();
                }
                tryInjectAndInspect();
              }}
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
