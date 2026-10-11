"use client";

import { Loader2, Lock, User } from "lucide-react";
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
import { loginNvc } from "@/lib/nvc-api";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";

interface NvcLoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: {
    username: string;
    balance: string;
    sessionCookie?: string;
  }) => void;
}

export function NvcLoginDialog({
  isOpen,
  onClose,
  onLoginSuccess,
}: NvcLoginDialogProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMsg("Vui lòng nhập đầy đủ tên tài khoản và mật khẩu");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const result = await loginNvc(username.trim(), password);

      if (result.success && result.user) {
        const balanceFormatted = `${Number(result.user.coinBalance || 0).toLocaleString("vi-VN")} xu`;

        try {
          localStorage.setItem("nvc_username", result.user.username);
          localStorage.setItem("nvc_balance", balanceFormatted);
          if (result.sessionCookie) {
            localStorage.setItem("nvc_session_cookie", result.sessionCookie);
          }
        } catch {
          // ignore
        }

        showSuccessToast(
          `Đăng nhập NVC thành công! Chào mừng ${result.user.username}`,
        );

        onLoginSuccess({
          username: result.user.username,
          balance: balanceFormatted,
          sessionCookie: result.sessionCookie,
        });

        setUsername("");
        setPassword("");
        onClose();
      } else {
        const err = result.error || "Tên tài khoản hoặc mật khẩu không chính xác";
        setErrorMsg(err);
        showErrorToast(err);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi kết nối";
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
            <span className="flex size-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 font-bold text-xs">
              NVC
            </span>
            <span>Đăng nhập Nhiệm Vụ Chéo</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Nhập tài khoản và mật khẩu tài khoản nhiemvucheo.com của bạn
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleLogin} className="space-y-4 py-2">
          {errorMsg && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {errorMsg}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs text-foreground font-medium">
              Tên tài khoản
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Nhập username NVC..."
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (errorMsg) setErrorMsg("");
                }}
                disabled={loading}
                className="pl-9 h-9 text-xs"
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-foreground font-medium">
              Mật khẩu
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder="Nhập mật khẩu..."
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMsg) setErrorMsg("");
                }}
                disabled={loading}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
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
              disabled={loading || !username.trim() || !password}
              className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Đang đăng nhập...
                </>
              ) : (
                "Đăng nhập"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
