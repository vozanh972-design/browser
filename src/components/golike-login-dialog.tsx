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
  if (window.__hasInjectedGolikeHook) return;
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

  // Trích xuất session trực tiếp qua native Tauri và Gateway GoLike (không qua bất kỳ cổng mạng trung gian nào)
  const checkSession = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const data: any = await invoke("extract_golike_session");
      if ((data?.success || data?.hasSession) && data?.user?.token) {
        const rawToken = (data.user.token || "").trim();
        const fullToken = rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`;

        // 1. Kiểm tra blacklist token (tài khoản vừa bấm đăng xuất)
        const blacklisted = typeof window !== "undefined" ? localStorage.getItem("golike_blacklist_token") : null;
        if (blacklisted) {
          const cleanBlacklist = blacklisted.replace(/^Bearer\s+/i, "").trim();
          const cleanFull = fullToken.replace(/^Bearer\s+/i, "").trim();
          if (cleanBlacklist === cleanFull || fullToken.includes(cleanBlacklist) || blacklisted.includes(cleanFull)) {
            return null;
          }
        }

        // 2. BẮT BUỘC: Xác thực trực tiếp với Gateway GoLike /api/users/me lấy số xu thật
        try {
          const freshUser = await getGolikeUser(fullToken);
          if (freshUser.success && freshUser.user) {
            const coin = freshUser.user.coin ?? 0;
            const balance = `${coin.toLocaleString("vi-VN")} coin`;
            const username = freshUser.user.username || data.user.username || "GoLike User";

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
        localStorage.removeItem("golike_blacklist_token");
        localStorage.removeItem("golike_logged_out_time");
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

      // Đồng bộ protocol ngầm sau khi đã đóng webview
      void (async () => {
        try {
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

  const tryInjectAndInspect = () => {
    try {
      const iframe = iframeRef.current;
      if (!iframe || !iframe.contentWindow) return;
      const cw = iframe.contentWindow as any;

      // 1. Tiêm script hook vào document của iframe
      if (!cw.__hasInjectedGolikeHook && cw.document && (cw.document.head || cw.document.documentElement)) {
        cw.__hasInjectedGolikeHook = true;
        const s = cw.document.createElement("script");
        s.textContent = GOMAX_INJECT_SNIPPET;
        (cw.document.head || cw.document.documentElement).appendChild(s);
      }

      // 2. Nếu đã vào trang chủ GoLike (như ảnh của user) -> Kích hoạt fetch để bắt header
      if (cw.location && cw.location.pathname !== "/login") {
        if (typeof cw.fetch === "function") {
          cw.fetch("https://gateway.golike.net/api/users/me").catch(() => {});
        }
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

    // Kiểm tra ngay lập tức khi vừa mở dialog (nếu đã đăng nhập trên GoLike thì nhận diện và đóng luôn)
    (async () => {
      tryInjectAndInspect();
      const detected = await checkSession();
      if (detected && detected.token) {
        await handleAutoLoginSuccess(detected, detected.session);
      }
    })();

    // Tự động lắng nghe và phát hiện đăng nhập thành công mỗi 300ms (tương đương tốc độ GoMax)
    pollingRef.current = setInterval(async () => {
      if (isCompletedRef.current) return;
      tryInjectAndInspect();
      const detected = await checkSession();
      if (detected && detected.token) {
        await handleAutoLoginSuccess(detected, detected.session);
      }
    }, 300);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [isOpen]);

  // Lắng nghe postMessage từ iframe (chuẩn GoMax)
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      try {
        const data = event.data;
        if (!data || isCompletedRef.current) return;

        const rawToken = data.session?.golike_token || data.golike_token || data.auth;
        if (rawToken && typeof rawToken === "string" && rawToken.length >= 50) {
          const fullToken = rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`;

          // Kiểm tra blacklist
          const blacklisted = typeof window !== "undefined" ? localStorage.getItem("golike_blacklist_token") : null;
          if (blacklisted && (fullToken === blacklisted || fullToken.includes(blacklisted))) {
            return;
          }

          const freshUser = await getGolikeUser(fullToken);
          if (freshUser.success && freshUser.user) {
            const coin = freshUser.user.coin ?? 0;
            const balance = `${coin.toLocaleString("vi-VN")} coin`;
            const username = freshUser.user.username || data.session?.golike_username || "GoLike User";

            await handleAutoLoginSuccess(
              {
                username,
                balance,
                token: fullToken,
                coin,
              },
              data.session || data,
            );
          }
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
              onLoad={() => {
                setIframeLoading(false);
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
