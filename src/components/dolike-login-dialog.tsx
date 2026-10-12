"use client";

import { Globe, KeyRound, Loader2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

/**
 * Giao diện đăng nhập / kết nối DoLike 100% chuẩn GoMax 1.2.4:
 * 1. Cơ chế A: In-App WebView nội bộ (DolikeWebLoginActivity -> https://congtingudolike.servehttp.com/)
 *    - Khởi tạo WebviewWindow con độc lập trong app (KHÔNG mở Chrome/Edge ngoài của Windows).
 *    - Tự động quét và bắt JWT Token từ session nội bộ khi người dùng đăng nhập xong.
 *    - Tự động đóng cửa sổ WebView con và hoàn tất kết nối.
 * 2. Cơ chế B: Nhập Authorization Token DoLike (Lx/n2; -> ô dán Token -> nút "Xác nhận Token").
 */
export function DolikeLoginDialog({
  isOpen,
  onClose,
  onLoginSuccess,
}: DolikeLoginDialogProps) {
  const [tokenInput, setTokenInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [webLoginActive, setWebLoginActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isCompletedRef = useRef(false);
  const webviewInstanceRef = useRef<any>(null);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  // Dọn dẹp listener và polling khi đóng dialog
  useEffect(() => {
    if (!isOpen) {
      stopPolling();
      setWebLoginActive(false);
      isCompletedRef.current = false;
      setErrorMsg("");
      setLoading(false);
      // Đóng cửa sổ webview login nếu còn mở khi đóng dialog
      if (webviewInstanceRef.current) {
        try {
          void webviewInstanceRef.current.close().catch(() => {});
        } catch {
          // ignore
        }
        webviewInstanceRef.current = null;
      }
    }
  }, [isOpen]);

  // Hàm quét session từ LevelDB nội bộ WebView2 (chuẩn GoMax)
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
      // Fallback nếu chưa hỗ trợ lệnh
    }
    return null;
  };

  // Xử lý tự động kết nối khi bắt được token từ WebviewWindow
  const handleAutoCaptureSuccess = async (token: string) => {
    if (isCompletedRef.current) return;
    isCompletedRef.current = true;
    stopPolling();

    // Đóng cửa sổ webview con
    if (webviewInstanceRef.current) {
      try {
        await webviewInstanceRef.current.close();
      } catch {
        // ignore
      }
      webviewInstanceRef.current = null;
    }

    setWebLoginActive(false);
    setLoading(true);

    try {
      const clean = token.trim().replace(/^Bearer\s+/i, "");
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

        showSuccessToast("Kết nối DoLike thành công!");
        onLoginSuccess({
          email: userEmail,
          displayName: userDisplay,
          userId: result.userId,
          balance,
          bearerToken: clean,
        });

        setTokenInput("");
        onClose();
      } else {
        setErrorMsg(result.error || "Token trích xuất không hợp lệ!");
        showErrorToast(result.error || "Token trích xuất không hợp lệ!");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi xác thực DoLike";
      setErrorMsg(msg);
      showErrorToast(msg);
    } finally {
      setLoading(false);
    }
  };

  // Cơ chế A: Khởi tạo WebviewWindow nội bộ chuẩn GoMax DolikeWebLoginActivity
  const handleOpenWebLogin = async () => {
    try {
      setWebLoginActive(true);
      setErrorMsg("");
      isCompletedRef.current = false;
      stopPolling();

      const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");

      // Kiểm tra nếu window cũ đang mở thì focus vào
      const existing = await WebviewWindow.getByLabel("dolike-web-login");
      if (existing) {
        await existing.show();
        await existing.setFocus();
        webviewInstanceRef.current = existing;
      } else {
        const webview = new WebviewWindow("dolike-web-login", {
          url: DOLIKE_BASE_URL,
          title: "Đăng nhập Web DoLike (Chính chủ)",
          width: 480,
          height: 680,
          center: true,
          focus: true,
        });

        webviewInstanceRef.current = webview;

        webview.once("tauri://error", (e) => {
          console.error("[DoLike In-App WebView] Lỗi tạo cửa sổ:", e);
          setWebLoginActive(false);
          stopPolling();
          showErrorToast("Không thể khởi chạy WebView DoLike");
        });

        void webview.listen("tauri://destroyed", () => {
          webviewInstanceRef.current = null;
          setWebLoginActive(false);
          stopPolling();
        });
      }

      // Khởi chạy vòng lặp polling phát hiện session tự động từ LevelDB nội bộ
      let isChecking = false;
      pollingRef.current = setInterval(async () => {
        if (isCompletedRef.current || isChecking) return;
        isChecking = true;
        try {
          const detected = await checkLeveldbSession();
          if (detected?.token) {
            await handleAutoCaptureSuccess(detected.token);
          }
        } finally {
          isChecking = false;
        }
      }, 800);
    } catch (err: unknown) {
      console.error("[DoLike In-App WebView] Lỗi khởi động:", err);
      setWebLoginActive(false);
      stopPolling();
      showErrorToast("Lỗi mở WebView nội bộ DoLike");
    }
  };

  // Cơ chế B: Xác thực Token thủ công chuẩn GoMax Lx/n2;
  const handleVerifyToken = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanToken = tokenInput.trim().replace(/^Bearer\s+/i, "");

    if (!cleanToken) {
      setErrorMsg("Vui lòng nhập Authorization Token DoLike");
      showErrorToast("Vui lòng nhập Authorization Token DoLike");
      return;
    }

    setLoading(true);
    setErrorMsg("");

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
        setErrorMsg(err);
        showErrorToast(err);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Authorization Token DoLike không hợp lệ!";
      setErrorMsg(msg);
      showErrorToast(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[440px] bg-background border border-border/80 shadow-2xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-fuchsia-500/10 text-fuchsia-500 font-bold text-xs">
              DL
            </span>
            <span>Kết nối DoLike</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Đăng nhập DoLike trên trang chính chủ để đồng bộ số dư hoặc nhập Authorization Token DoLike.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleVerifyToken} className="space-y-4 pt-2">
          {errorMsg && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-500 flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Cơ chế A: In-App WebView nội bộ chuẩn GoMax DolikeWebLoginActivity */}
          <div className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Globe className="size-3.5 text-fuchsia-400" />
                  <span>Đăng nhập Web DoLike</span>
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Mở WebView nội bộ, tự động bắt Token khi bạn đăng nhập xong.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenWebLogin}
                disabled={webLoginActive || loading}
                className="text-xs h-7 gap-1.5 border-fuchsia-500/30 text-fuchsia-400 hover:bg-fuchsia-500/10 transition-colors"
              >
                {webLoginActive ? (
                  <>
                    <Loader2 className="size-3 animate-spin text-fuchsia-400" />
                    <span>Đang chờ...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3 text-fuchsia-400" />
                    <span>Mở WebView</span>
                  </>
                )}
              </Button>
            </div>

            {webLoginActive && (
              <div className="flex items-center gap-2 rounded-md bg-fuchsia-500/10 border border-fuchsia-500/20 px-2.5 py-1.5 text-[11px] text-fuchsia-400 animate-pulse">
                <Loader2 className="size-3 animate-spin shrink-0" />
                <span>
                  Đang mở WebView DoLike. Hãy đăng nhập tài khoản trên cửa sổ vừa mở, hệ thống sẽ tự động đồng bộ ngay!
                </span>
              </div>
            )}
          </div>

          {/* Cơ chế B: Nhập Authorization Token DoLike chuẩn GoMax Lx/n2; */}
          <div className="space-y-2">
            <Label
              htmlFor="dolike-token"
              className="text-xs font-medium text-foreground flex items-center justify-between"
            >
              <span>Authorization Token DoLike</span>
              <span className="text-[10px] text-muted-foreground font-normal">
                (Chuẩn GoMax Token)
              </span>
            </Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="dolike-token"
                type="text"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                disabled={loading}
                className="pl-9 text-xs h-9 bg-muted/40 font-mono"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Nhập mã Authorization Token nhận được từ tài khoản DoLike để kết nối nhanh.
            </p>
          </div>

          <DialogFooter className="pt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={loading}
              className="text-xs h-8"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className="text-xs h-8 bg-fuchsia-600 hover:bg-fuchsia-700 text-white flex items-center gap-1.5 shadow-sm"
            >
              {loading && <Loader2 className="size-3.5 animate-spin" />}
              <span>{loading ? "Đang kiểm tra..." : "Xác nhận Token"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
