"use client";

import { Loader2, Lock, Mail } from "lucide-react";
import { useState } from "react";
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
import {
  getDolikePlatformAccounts,
  getDolikeWallet,
  loginDolike,
} from "@/lib/dolike-api";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";

interface DolikeLoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: {
    email: string;
    balance: string;
    sessionCookie?: string;
    bearerToken?: string;
  }) => void;
}

export function DolikeLoginDialog({
  isOpen,
  onClose,
  onLoginSuccess,
}: DolikeLoginDialogProps) {
  const [loginMode, setLoginMode] = useState<"password" | "cookie">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cookieInput, setCookieInput] = useState("");
  const [bearerInput, setBearerInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      if (loginMode === "cookie") {
        if (!cookieInput.trim() && !bearerInput.trim()) {
          setErrorMsg("Vui lòng nhập Cookie hoặc Bearer Token DoLike");
          setLoading(false);
          return;
        }

        let cookieClean = cookieInput.trim();
        // Nếu user dán cả chuỗi curl thì tự trích xuất cookie và bearer
        const bearerMatch =
          cookieClean.match(/Bearer\s+([A-Za-z0-9._-]+)/i) ||
          bearerInput.match(/Bearer\s+([A-Za-z0-9._-]+)/i);
        const extractedBearer = bearerMatch
          ? bearerMatch[1]
          : bearerInput.trim().replace(/^Bearer\s+/i, "");

        const phpSess = cookieClean.match(/PHPSESSID=([^;\s]+)/);
        const persist = cookieClean.match(/mgauto_email_persist=([^;\s]+)/);
        const cookies: string[] = [];
        if (phpSess) cookies.push(`PHPSESSID=${phpSess[1]}`);
        if (persist) cookies.push(`mgauto_email_persist=${persist[1]}`);
        if (cookies.length > 0) {
          cookieClean = cookies.join("; ");
        }

        // Kiểm tra kết nối với server DoLike theo chuẩn GoMax
        const verifyRes = await getDolikePlatformAccounts({
          cookie: cookieClean,
          bearerToken: extractedBearer,
        });

        if (!verifyRes.success && verifyRes.error) {
          const err = verifyRes.error;
          setErrorMsg(err);
          setLoading(false);
          return;
        }

        let balance = "0 đ";
        if (cookieClean) {
          const wRes = await getDolikeWallet(cookieClean);
          if (wRes.success && wRes.balance) {
            balance = wRes.balance;
          }
        }

        const userEmail = email.trim() || "dolike_user@gmail.com";

        try {
          localStorage.setItem("dolike_email", userEmail);
          localStorage.setItem("dolike_balance", balance);
          if (cookieClean) {
            localStorage.setItem("dolike_session_cookie", cookieClean);
          }
          if (extractedBearer) {
            localStorage.setItem("dolike_bearer_token", extractedBearer);
          }
        } catch {
          // ignore
        }

        showSuccessToast(
          `Đã kết nối DoLike thành công! Đã đồng bộ ${verifyRes.accounts?.length || 0} tài khoản.`,
        );
        onLoginSuccess({
          email: userEmail,
          balance,
          sessionCookie: cookieClean,
          bearerToken: extractedBearer,
        });
        onClose();
        return;
      }

      // Đăng nhập bằng Email & Mật khẩu
      if (!email.trim() || !password) {
        setErrorMsg("Vui lòng nhập đầy đủ Email và Mật khẩu DoLike");
        setLoading(false);
        return;
      }

      const result = await loginDolike(email.trim(), password);

      if (result.success && result.user) {
        const balance = result.user.balance || "0 đ";

        try {
          localStorage.setItem("dolike_email", result.user.email);
          localStorage.setItem("dolike_balance", balance);
          if (result.sessionCookie) {
            localStorage.setItem("dolike_session_cookie", result.sessionCookie);
          }
          if (result.token) {
            localStorage.setItem("dolike_bearer_token", result.token);
          }
        } catch {
          // ignore
        }

        showSuccessToast(
          `Đăng nhập DoLike thành công! Chào mừng ${result.user.email}`,
        );

        onLoginSuccess({
          email: result.user.email,
          balance,
          sessionCookie: result.sessionCookie,
          bearerToken: result.token,
        });

        setEmail("");
        setPassword("");
        onClose();
      } else {
        const err = result.error || "Email hoặc mật khẩu không chính xác";
        setErrorMsg(err);
        showErrorToast(err);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Lỗi kết nối máy chủ DoLike";
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
          <DialogTitle className="text-base font-semibold text-foreground flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-fuchsia-500/10 text-fuchsia-500 font-bold text-xs">
                DL
              </span>
              <span>Đăng nhập DoLike</span>
            </div>
            <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border/40 text-[11px]">
              <button
                type="button"
                onClick={() => setLoginMode("password")}
                className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                  loginMode === "password"
                    ? "bg-fuchsia-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Mật khẩu
              </button>
              <button
                type="button"
                onClick={() => setLoginMode("cookie")}
                className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                  loginMode === "cookie"
                    ? "bg-fuchsia-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Dán Cookie/Token
              </button>
            </div>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {loginMode === "password"
              ? "Nhập tài khoản Email và mật khẩu đã đăng ký trên hệ thống DoLike để đồng bộ ví và danh sách nhiệm vụ."
              : "Dán chuỗi Cookie (PHPSESSID) hoặc Bearer Token từ cURL trình duyệt để kết nối phiên DoLike đầy đủ."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleLogin} className="space-y-4 pt-2">
          {errorMsg && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-500 flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {loginMode === "password" ? (
            <>
              <div className="space-y-2">
                <Label
                  htmlFor="dolike-email"
                  className="text-xs font-medium text-foreground"
                >
                  Email tài khoản DoLike
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="dolike-email"
                    type="email"
                    placeholder="example@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="pl-9 text-xs h-9 bg-muted/40"
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="dolike-password"
                  className="text-xs font-medium text-foreground"
                >
                  Mật khẩu
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="dolike-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="pl-9 text-xs h-9 bg-muted/40"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-foreground">
                  Cookie DoLike (PHPSESSID / mgauto_email_persist)
                </Label>
                <Input
                  type="text"
                  placeholder="PHPSESSID=...; mgauto_email_persist=..."
                  value={cookieInput}
                  onChange={(e) => setCookieInput(e.target.value)}
                  disabled={loading}
                  className="text-xs h-9 bg-muted/40 font-mono"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-foreground">
                  Bearer Token DoLike (Tùy chọn)
                </Label>
                <Input
                  type="text"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={bearerInput}
                  onChange={(e) => setBearerInput(e.target.value)}
                  disabled={loading}
                  className="text-xs h-9 bg-muted/40 font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-foreground">
                  Email hiển thị (Tùy chọn)
                </Label>
                <Input
                  type="email"
                  placeholder="example@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="text-xs h-9 bg-muted/40"
                />
              </div>
            </>
          )}

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
              className="text-xs h-8 bg-fuchsia-600 hover:bg-fuchsia-700 text-white flex items-center gap-1.5"
            >
              {loading && <Loader2 className="size-3.5 animate-spin" />}
              <span>{loading ? "Đang xác thực..." : "Xác nhận"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
