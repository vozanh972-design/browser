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
import { loginDolike } from "@/lib/dolike-api";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";

interface DolikeLoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: {
    email: string;
    balance: string;
    sessionCookie?: string;
  }) => void;
}

export function DolikeLoginDialog({
  isOpen,
  onClose,
  onLoginSuccess,
}: DolikeLoginDialogProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMsg("Vui lòng nhập đầy đủ Email và Mật khẩu DoLike");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const result = await loginDolike(email.trim(), password);

      if (result.success && result.user) {
        const balance = result.user.balance || "0 đ";

        try {
          localStorage.setItem("dolike_email", result.user.email);
          localStorage.setItem("dolike_balance", balance);
          if (result.sessionCookie) {
            localStorage.setItem("dolike_session_cookie", result.sessionCookie);
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
      const msg = err instanceof Error ? err.message : "Lỗi kết nối máy chủ DoLike";
      setErrorMsg(msg);
      showErrorToast(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[420px] bg-background border border-border/80 shadow-2xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-fuchsia-500/10 text-fuchsia-500 font-bold text-xs">
              DL
            </span>
            <span>Đăng nhập DoLike</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Nhập tài khoản Email và mật khẩu đã đăng ký trên hệ thống DoLike để đồng bộ ví và danh sách nhiệm vụ.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleLogin} className="space-y-4 pt-2">
          {errorMsg && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-500 flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="dolike-email" className="text-xs font-medium text-foreground">
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
            <Label htmlFor="dolike-password" className="text-xs font-medium text-foreground">
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
              <span>{loading ? "Đang xác thực..." : "Đăng nhập"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
