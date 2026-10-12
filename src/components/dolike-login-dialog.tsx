"use client";

import { ExternalLink, KeyRound, Loader2 } from "lucide-react";
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
import { DOLIKE_BASE_URL, verifyDolikeToken } from "@/lib/dolike-api";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";

interface DolikeLoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: {
    email: string;
    balance: string;
    bearerToken?: string;
  }) => void;
}

/**
 * Giao diện đăng nhập / kết nối DoLike 100% chuẩn GoMax 1.2.4 (DolikeWebLoginActivity & Lx/n2;):
 * 1. Đăng nhập trực tiếp trên Web chính chủ DoLike (DolikeWebLoginActivity -> https://congtingudolike.servehttp.com/)
 * 2. Xác nhận Token (Lx/n2; -> Nhập Authorization Token DoLike -> Nút "Xác nhận Token")
 */
export function DolikeLoginDialog({
  isOpen,
  onClose,
  onLoginSuccess,
}: DolikeLoginDialogProps) {
  const [tokenInput, setTokenInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleOpenWebLogin = () => {
    // Mở trang chính chủ DoLike theo chuẩn GoMax DolikeWebLoginActivity
    if (typeof window !== "undefined") {
      window.open(DOLIKE_BASE_URL, "_blank");
    }
  };

  const handleVerifyToken = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanToken = tokenInput.trim().replace(/^Bearer\s+/i, "");

    if (!cleanToken) {
      setErrorMsg("Authorization Token DoLike không hợp lệ!");
      showErrorToast("Vui lòng nhập Authorization Token DoLike");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      // Xác thực token theo chuẩn GoMax Lx/n2; & Lx/iq;->x
      const result = await verifyDolikeToken(cleanToken);

      if (result.success) {
        const userEmail = result.email || "dolike_user";
        const balance = result.balance || "0 đ";

        try {
          localStorage.setItem("dolike_auth_token", cleanToken);
          localStorage.setItem("dolike_bearer_token", cleanToken);
          localStorage.setItem("dolike_email", userEmail);
          localStorage.setItem("dolike_balance", balance);
          if (result.displayName) {
            localStorage.setItem("dolike_display_name", result.displayName);
          }
        } catch {
          // ignore
        }

        // Thông báo toast chuẩn GoMax: "Kết nối DoLike thành công!"
        showSuccessToast("Kết nối DoLike thành công!");

        onLoginSuccess({
          email: userEmail,
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

          {/* Cách 1: Đăng nhập Web DoLike chính chủ chuẩn GoMax DolikeWebLoginActivity */}
          <div className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-foreground">
                  Đăng nhập Web DoLike
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Mở trang web chính chủ DoLike để đăng nhập tài khoản.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenWebLogin}
                className="text-xs h-7 gap-1 border-fuchsia-500/30 text-fuchsia-400 hover:bg-fuchsia-500/10"
              >
                <ExternalLink className="size-3" />
                <span>Mở Web DoLike</span>
              </Button>
            </div>
          </div>

          {/* Cách 2: Nhập Authorization Token DoLike chuẩn GoMax Lx/n2; */}
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
              Nhập mã Authorization Token nhận được từ tài khoản DoLike để kết nối.
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
              className="text-xs h-8 bg-fuchsia-600 hover:bg-fuchsia-700 text-white flex items-center gap-1.5"
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
