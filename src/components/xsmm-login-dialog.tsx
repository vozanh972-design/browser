"use client";

import { useState } from "react";
import { LuKey, LuShieldCheck } from "react-icons/lu";
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

interface XsmmLoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: {
    username: string;
    balance: string;
    token: string;
  }) => void;
}

export function XsmmLoginDialog({
  isOpen,
  onClose,
  onLoginSuccess,
}: XsmmLoginDialogProps) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    const trimmed = token.trim();
    if (!trimmed) {
      setError("Vui lòng nhập Access Token XSMM.");
      return;
    }

    setLoading(true);
    setError("");

    setTimeout(() => {
      setLoading(false);
      const shortId = trimmed.length > 8 ? trimmed.slice(0, 8) : trimmed;
      onLoginSuccess({
        username: `XSMM_${shortId}`,
        balance: "100.000 đ",
        token: trimmed,
      });
      setToken("");
      onClose();
    }, 400);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <LuShieldCheck className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Đăng nhập tài khoản XSMM
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Nhập Access Token XSMM của bạn để kết nối với hệ thống.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-3">
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="xsmm-token"
              className="text-xs font-medium text-foreground"
            >
              Access Token XSMM <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="xsmm-token"
                type="password"
                placeholder="Dán mã Token XSMM tại đây..."
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
              <LuKey className="absolute right-2.5 top-2.5 size-4 text-muted-foreground/60 pointer-events-none" />
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
            className="text-xs font-semibold cursor-pointer"
          >
            {loading ? "Đang kết nối..." : "Đăng nhập"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
