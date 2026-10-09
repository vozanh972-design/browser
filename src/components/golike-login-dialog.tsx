"use client";

import { Key, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getGolikeUser } from "@/lib/golike-api";

interface GolikeLoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: {
    username: string;
    balance: string;
    token: string;
  }) => void;
}

export function GolikeLoginDialog({
  isOpen,
  onClose,
  onLoginSuccess,
}: GolikeLoginDialogProps) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const trimmed = token.trim();
    if (!trimmed) {
      setError("Vui lòng nhập Authorization Token GoLike.");
      return;
    }

    setLoading(true);
    setError("");

    const res = await getGolikeUser(trimmed);

    if (!res.success || !res.user) {
      setLoading(false);
      setError(res.error || "Mã Authorization Token không đúng hoặc đã hết hạn.");
      return;
    }

    setLoading(false);
    const balance = `${res.user.coin.toLocaleString("vi-VN")} coin`;
    try {
      localStorage.setItem("golike_token", trimmed);
    } catch {
      // ignore storage error
    }

    onLoginSuccess({
      username: res.user.username,
      balance,
      token: trimmed,
    });
    setToken("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Đăng nhập tài khoản GoLike
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Nhập Authorization Token GoLike của bạn để kết nối với hệ thống.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-3">
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="golike-token"
              className="text-xs font-medium text-foreground"
            >
              Authorization Token GoLike <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="golike-token"
                type="password"
                placeholder="Dán mã Token / Authorization GoLike tại đây..."
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  if (error) setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLogin();
                }}
                className="pr-8 text-xs font-mono"
              />
              <Key className="absolute right-2.5 top-2.5 size-4 text-muted-foreground/60 pointer-events-none" />
            </div>
            {error && (
              <span className="text-[11px] text-destructive font-medium">
                {error}
              </span>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs"
          >
            Hủy
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleLogin}
            disabled={loading}
            className="text-xs font-semibold cursor-pointer bg-cyan-600 hover:bg-cyan-700 text-white"
          >
            {loading ? "Đang kết nối..." : "Đăng nhập"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
