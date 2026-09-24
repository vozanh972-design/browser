"use client";

import { useState } from "react";
import { FaFacebook, FaInstagram } from "react-icons/fa";
import {
  LuCheck,
  LuCopy,
  LuEye,
  LuEyeOff,
  LuKey,
  LuRefreshCw,
  LuShieldCheck,
} from "react-icons/lu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { showSuccessToast } from "@/lib/toast-utils";
import { cn } from "@/lib/utils";

export interface AccountDetailData {
  id: string;
  uid: string;
  name?: string;
  pass?: string;
  twoFactor?: string;
  cookie?: string;
  token?: string;
  avatar?: string;
  cover?: string;
  mail?: string;
  tag?: string;
  note?: string;
  proxy?: string;
  platform?: "facebook" | "instagram";
  status: "live" | "checkpoint" | "unverified";
  rawText: string;
}

interface AccountDetailDialogProps {
  account: AccountDetailData | null;
  isOpen: boolean;
  onClose: () => void;
  onRecheck?: (account: AccountDetailData) => void;
  isChecking?: boolean;
}

export function AccountDetailDialog({
  account,
  isOpen,
  onClose,
  onRecheck,
  isChecking = false,
}: AccountDetailDialogProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!account) return null;

  const handleCopy = (text: string | undefined, key: string, label: string) => {
    if (!text) return;
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showSuccessToast(`Đã sao chép ${label}!`);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 1800);
  };

  const isInstagram = account.platform === "instagram";
  const avatarUrl =
    account.avatar ||
    (account.uid && !account.uid.startsWith("acc_")
      ? `https://graph.facebook.com/${account.uid}/picture?type=large`
      : undefined);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-background border-border">
        <DialogHeader className="sr-only">
          <DialogTitle>
            Chi tiết tài khoản {account.name || account.uid}
          </DialogTitle>
        </DialogHeader>

        {/* Banner Cover Photo */}
        <div className="relative h-32 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 overflow-hidden">
          {account.cover && (
            // biome-ignore lint/performance/noImgElement: dynamic external cover URL
            <img
              src={account.cover}
              alt="Cover"
              className="h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-black/20" />
        </div>

        {/* Profile Header Info */}
        <div className="relative px-6 pb-2">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 -mt-12 sm:-mt-14 mb-3">
            <div className="flex items-end gap-3.5">
              {/* Avatar Thật */}
              <div className="relative size-20 sm:size-22 rounded-full border-4 border-background bg-muted overflow-hidden shrink-0 shadow-md">
                {avatarUrl ? (
                  // biome-ignore lint/performance/noImgElement: dynamic external avatar URL
                  <img
                    src={avatarUrl}
                    alt={account.name || account.uid}
                    className="size-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : isInstagram ? (
                  <div className="size-full flex items-center justify-center bg-[#E1306C]/10 text-[#E1306C]">
                    <FaInstagram className="size-9" />
                  </div>
                ) : (
                  <div className="size-full flex items-center justify-center bg-[#1877F2]/10 text-[#1877F2]">
                    <FaFacebook className="size-9" />
                  </div>
                )}
              </div>

              {/* Tên & Trạng thái */}
              <div className="flex flex-col pb-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-foreground truncate max-w-xs sm:max-w-sm">
                    {account.name || account.uid}
                  </h3>
                  {account.status === "live" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      <LuShieldCheck className="size-3" />
                      Live
                    </span>
                  ) : account.status === "checkpoint" ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                      Checkpoint
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                      Chưa kiểm tra
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                  <span>UID: {account.uid}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(account.uid, "uid", "UID")}
                    className="p-1 hover:text-foreground cursor-pointer rounded transition-colors"
                    title="Sao chép UID"
                  >
                    {copiedKey === "uid" ? (
                      <LuCheck className="size-3 text-emerald-500" />
                    ) : (
                      <LuCopy className="size-3" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Nút Kiểm tra lại */}
            {onRecheck && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isChecking}
                onClick={() => onRecheck(account)}
                className="h-8 text-xs cursor-pointer gap-1.5 self-start sm:self-auto"
              >
                <LuRefreshCw
                  className={cn("size-3.5", isChecking && "animate-spin")}
                />
                <span>{isChecking ? "Đang check..." : "Kiểm tra lại"}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Scrollable Details */}
        <ScrollArea className="max-h-[380px] px-6 py-2">
          <div className="flex flex-col gap-3 pb-4">
            {/* Mật khẩu & 2FA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Password */}
              <div className="rounded-lg border border-border/80 bg-muted/20 p-2.5 flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Mật khẩu</span>
                  {account.pass && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="hover:text-foreground cursor-pointer p-0.5"
                      >
                        {showPassword ? (
                          <LuEyeOff className="size-3" />
                        ) : (
                          <LuEye className="size-3" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(account.pass, "pass", "Mật khẩu")
                        }
                        className="hover:text-foreground cursor-pointer p-0.5"
                      >
                        {copiedKey === "pass" ? (
                          <LuCheck className="size-3 text-emerald-500" />
                        ) : (
                          <LuCopy className="size-3" />
                        )}
                      </button>
                    </div>
                  )}
                </span>
                <span className="text-xs font-mono select-all break-all text-foreground">
                  {account.pass
                    ? showPassword
                      ? account.pass
                      : "••••••••••••"
                    : "Chưa có"}
                </span>
              </div>

              {/* 2FA */}
              <div className="rounded-lg border border-border/80 bg-muted/20 p-2.5 flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Mã 2FA (Secret)</span>
                  {account.twoFactor && (
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(account.twoFactor, "2fa", "Mã 2FA")
                      }
                      className="hover:text-foreground cursor-pointer p-0.5"
                    >
                      {copiedKey === "2fa" ? (
                        <LuCheck className="size-3 text-emerald-500" />
                      ) : (
                        <LuCopy className="size-3" />
                      )}
                    </button>
                  )}
                </span>
                <span className="text-xs font-mono select-all break-all text-foreground">
                  {account.twoFactor || "Chưa có"}
                </span>
              </div>
            </div>

            {/* Email & Proxy */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Mail */}
              <div className="rounded-lg border border-border/80 bg-muted/20 p-2.5 flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Email</span>
                  {account.mail && (
                    <button
                      type="button"
                      onClick={() => handleCopy(account.mail, "mail", "Email")}
                      className="hover:text-foreground cursor-pointer p-0.5"
                    >
                      {copiedKey === "mail" ? (
                        <LuCheck className="size-3 text-emerald-500" />
                      ) : (
                        <LuCopy className="size-3" />
                      )}
                    </button>
                  )}
                </span>
                <span className="text-xs font-mono select-all break-all text-foreground">
                  {account.mail || "Chưa có"}
                </span>
              </div>

              {/* Proxy */}
              <div className="rounded-lg border border-border/80 bg-muted/20 p-2.5 flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Proxy / VPN</span>
                  {account.proxy && account.proxy !== "Chưa chọn" && (
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(account.proxy, "proxy", "Proxy")
                      }
                      className="hover:text-foreground cursor-pointer p-0.5"
                    >
                      {copiedKey === "proxy" ? (
                        <LuCheck className="size-3 text-emerald-500" />
                      ) : (
                        <LuCopy className="size-3" />
                      )}
                    </button>
                  )}
                </span>
                <span className="text-xs font-mono select-all break-all text-foreground">
                  {account.proxy || "Chưa chọn"}
                </span>
              </div>
            </div>

            {/* Token EAAAA */}
            <div className="rounded-lg border border-border/80 bg-muted/20 p-2.5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <LuKey className="size-3.5 text-blue-500" />
                  <span>Access Token (EAAAA)</span>
                </span>
                {account.token && (
                  <button
                    type="button"
                    onClick={() => handleCopy(account.token, "token", "Token")}
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer"
                  >
                    {copiedKey === "token" ? (
                      <LuCheck className="size-3 text-emerald-500" />
                    ) : (
                      <LuCopy className="size-3" />
                    )}
                    <span>
                      {copiedKey === "token" ? "Đã chép" : "Copy Token"}
                    </span>
                  </button>
                )}
              </div>
              <div className="max-h-20 overflow-y-auto rounded bg-background/80 p-2 text-xs font-mono select-all break-all border border-border/50 text-foreground">
                {account.token || "Chưa có Token"}
              </div>
            </div>

            {/* Cookie */}
            <div className="rounded-lg border border-border/80 bg-muted/20 p-2.5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Session Cookie
                </span>
                {account.cookie && (
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(account.cookie, "cookie", "Cookie")
                    }
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer"
                  >
                    {copiedKey === "cookie" ? (
                      <LuCheck className="size-3 text-emerald-500" />
                    ) : (
                      <LuCopy className="size-3" />
                    )}
                    <span>
                      {copiedKey === "cookie" ? "Đã chép" : "Copy Cookie"}
                    </span>
                  </button>
                )}
              </div>
              <div className="max-h-20 overflow-y-auto rounded bg-background/80 p-2 text-xs font-mono select-all break-all border border-border/50 text-foreground">
                {account.cookie || "Chưa có Cookie"}
              </div>
            </div>

            {/* Chuỗi định dạng gốc */}
            <div className="rounded-lg border border-border/80 bg-muted/20 p-2.5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Chuỗi dữ liệu gốc (Raw Text)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(account.rawText, "raw", "Chuỗi dữ liệu gốc")
                  }
                  className="flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer"
                >
                  {copiedKey === "raw" ? (
                    <LuCheck className="size-3 text-emerald-500" />
                  ) : (
                    <LuCopy className="size-3" />
                  )}
                  <span>{copiedKey === "raw" ? "Đã chép" : "Copy Raw"}</span>
                </button>
              </div>
              <div className="rounded bg-background/80 p-2 text-xs font-mono select-all break-all border border-border/50 text-foreground">
                {account.rawText}
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-3 border-t border-border bg-muted/20">
          <Button
            type="button"
            variant="default"
            onClick={onClose}
            className="cursor-pointer text-xs h-8 px-4"
          >
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
