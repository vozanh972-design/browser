"use client";

import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import {
  Camera,
  Check,
  Copy,
  Eye,
  EyeOff,
  Flag,
  Key,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaFacebook, FaInstagram } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  type FacebookPageItem,
  uploadFacebookPageAvatar,
  uploadFacebookPageCover,
} from "@/lib/facebook-api";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
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
  status: "live" | "checkpoint" | "die" | "unverified";
  rawText: string;
  pages?: FacebookPageItem[];
}

interface AccountDetailDialogProps {
  account: AccountDetailData | null;
  isOpen: boolean;
  onClose: () => void;
  onRecheck?: (account: AccountDetailData) => void;
  onUpdateMedia?: (updated: { avatar?: string; cover?: string }) => void;
  isChecking?: boolean;
}

function DialogAvatar({
  url,
  name,
  isInstagram,
}: {
  url?: string;
  name?: string;
  isInstagram?: boolean;
}) {
  const [errorUrl, setErrorUrl] = useState<string | null>(null);
  const hasError = !url || errorUrl === url;

  if (hasError) {
    return isInstagram ? (
      <div className="size-full flex items-center justify-center bg-[#E1306C]/10 text-[#E1306C]">
        <FaInstagram className="size-9" />
      </div>
    ) : (
      <div className="size-full flex items-center justify-center bg-[#1877F2]/10 text-[#1877F2]">
        <FaFacebook className="size-9" />
      </div>
    );
  }

  return (
    // biome-ignore lint/performance/noImgElement: dynamic external avatar URL
    <img
      src={url}
      alt={name || ""}
      className="size-full object-cover"
      onError={() => setErrorUrl(url)}
    />
  );
}

export function AccountDetailDialog({
  account,
  isOpen,
  onClose,
  onRecheck,
  onUpdateMedia,
  isChecking = false,
}: AccountDetailDialogProps) {
  const { i18n } = useTranslation();
  const isVi = (i18n.language?.split("-")[0] || "vi") === "vi";
  const tr = (vi: string, en: string) => (isVi ? vi : en);

  const [showPassword, setShowPassword] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [currentAvatar, setCurrentAvatar] = useState<string | undefined>(
    account?.avatar,
  );
  const [currentCover, setCurrentCover] = useState<string | undefined>(
    account?.cover,
  );
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  useEffect(() => {
    setCurrentAvatar(account?.avatar);
    setCurrentCover(account?.cover);
  }, [account?.avatar, account?.cover]);

  if (!account) return null;

  const handleCopy = (text: string | undefined, key: string, label: string) => {
    if (!text) return;
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showSuccessToast(tr(`Đã sao chép ${label}!`, `Copied ${label}!`));
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 1800);
  };

  const handleSelectAvatar = async () => {
    if (!account.token) return;
    try {
      let filePath: string | null = null;
      try {
        const selected = await openFileDialog({
          multiple: false,
          filters: [
            { name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] },
          ],
        });
        if (selected && typeof selected === "string") {
          filePath = selected;
        }
      } catch {
        // dialog plugin fallback
      }

      if (filePath) {
        setIsUploadingAvatar(true);
        const res = await uploadFacebookPageAvatar({
          pageId: account.uid,
          token: account.token,
          filePath,
          proxy: account.proxy,
        });
        if (res.success) {
          showSuccessToast(
            tr(
              "Đã đổi ảnh đại diện thành công!",
              "Updated avatar successfully!",
            ),
          );
          if (res.mediaUrl) {
            setCurrentAvatar(res.mediaUrl);
            onUpdateMedia?.({ avatar: res.mediaUrl });
          }
        } else {
          showErrorToast(
            res.message ||
              tr("Đổi ảnh đại diện thất bại", "Failed to update avatar"),
          );
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showErrorToast(msg);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSelectCover = async () => {
    if (!account.token) return;
    try {
      let filePath: string | null = null;
      try {
        const selected = await openFileDialog({
          multiple: false,
          filters: [
            { name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] },
          ],
        });
        if (selected && typeof selected === "string") {
          filePath = selected;
        }
      } catch {
        // dialog plugin fallback
      }

      if (filePath) {
        setIsUploadingCover(true);
        const res = await uploadFacebookPageCover({
          pageId: account.uid,
          token: account.token,
          filePath,
          proxy: account.proxy,
        });
        if (res.success) {
          showSuccessToast(
            tr("Đã đổi ảnh bìa thành công!", "Updated cover successfully!"),
          );
          if (res.mediaUrl) {
            setCurrentCover(res.mediaUrl);
            onUpdateMedia?.({ cover: res.mediaUrl });
          }
        } else {
          showErrorToast(
            res.message || tr("Đổi ảnh bìa thất bại", "Failed to update cover"),
          );
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showErrorToast(msg);
    } finally {
      setIsUploadingCover(false);
    }
  };

  const isInstagram = account.platform === "instagram";
  const avatarUrl =
    currentAvatar ||
    account.avatar ||
    (account.token
      ? `https://graph.facebook.com/v21.0/me/picture?type=large&access_token=${account.token}`
      : account.uid && !account.uid.startsWith("acc_")
        ? `https://graph.facebook.com/${account.uid}/picture?type=large`
        : undefined);
  const coverUrl = currentCover || account.cover;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-background border-border">
        <DialogHeader className="sr-only">
          <DialogTitle>
            Chi tiết tài khoản {account.name || account.uid}
          </DialogTitle>
        </DialogHeader>

        {/* Banner Cover Photo */}
        <div className="relative h-32 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 overflow-hidden group">
          {coverUrl && (
            // biome-ignore lint/performance/noImgElement: dynamic external cover URL
            <img
              src={coverUrl}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = "none";
              }}
            />
          )}
          <div className="absolute inset-0 bg-black/20" />
          {/* Nút đổi ảnh bìa khi có token */}
          {account.token && (
            <button
              type="button"
              disabled={isUploadingCover}
              onClick={handleSelectCover}
              className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/60 hover:bg-black/80 text-white text-[11px] font-medium backdrop-blur-xs transition-colors cursor-pointer shadow-xs border border-white/20"
              title={tr("Đổi ảnh bìa", "Change cover photo")}
            >
              {isUploadingCover ? (
                <RefreshCw className="size-3 animate-spin" />
              ) : (
                <Camera className="size-3" />
              )}
              <span>
                {isUploadingCover
                  ? tr("Đang tải...", "Uploading...")
                  : tr("Đổi ảnh bìa", "Change cover")}
              </span>
            </button>
          )}
        </div>

        {/* Profile Header Info */}
        <div className="relative px-6 pb-2">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 -mt-12 sm:-mt-14 mb-3">
            <div className="flex items-end gap-3.5">
              {/* Avatar Thật */}
              <div className="relative size-20 sm:size-22 rounded-full border-4 border-background bg-muted overflow-hidden shrink-0 shadow-md group">
                <DialogAvatar
                  url={avatarUrl}
                  name={account.name || account.uid}
                  isInstagram={isInstagram}
                />
                {/* Nút đổi Avatar khi có token */}
                {account.token && (
                  <button
                    type="button"
                    disabled={isUploadingAvatar}
                    onClick={handleSelectAvatar}
                    className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity cursor-pointer text-[10px] font-medium"
                    title={tr("Đổi ảnh đại diện", "Change profile picture")}
                  >
                    {isUploadingAvatar ? (
                      <RefreshCw className="size-4 animate-spin" />
                    ) : (
                      <>
                        <Camera className="size-4 mb-0.5" />
                        <span>{tr("Đổi ảnh", "Change")}</span>
                      </>
                    )}
                  </button>
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
                      <ShieldCheck className="size-3" />
                      Live
                    </span>
                  ) : account.status === "die" ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                      Die
                    </span>
                  ) : account.status === "checkpoint" ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                      Checkpoint
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                      {tr("Chưa kiểm tra", "Unchecked")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                  <span>UID: {account.uid}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(account.uid, "uid", "UID")}
                    className="p-1 hover:text-foreground cursor-pointer rounded transition-colors"
                    title={tr("Sao chép UID", "Copy UID")}
                  >
                    {copiedKey === "uid" ? (
                      <Check className="size-3 text-emerald-500" />
                    ) : (
                      <Copy className="size-3" />
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
                <RefreshCw
                  className={cn("size-3.5", isChecking && "animate-spin")}
                />
                <span>
                  {isChecking
                    ? tr("Đang check...", "Checking...")
                    : tr("Kiểm tra lại", "Re-check")}
                </span>
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
                  <span>{tr("Mật khẩu", "Password")}</span>
                  {account.pass && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="hover:text-foreground cursor-pointer p-0.5"
                      >
                        {showPassword ? (
                          <EyeOff className="size-3" />
                        ) : (
                          <Eye className="size-3" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            account.pass,
                            "pass",
                            tr("Mật khẩu", "Password"),
                          )
                        }
                        className="hover:text-foreground cursor-pointer p-0.5"
                      >
                        {copiedKey === "pass" ? (
                          <Check className="size-3 text-emerald-500" />
                        ) : (
                          <Copy className="size-3" />
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
                    : tr("Chưa có", "None")}
                </span>
              </div>

              {/* 2FA */}
              <div className="rounded-lg border border-border/80 bg-muted/20 p-2.5 flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>{tr("Mã 2FA (Secret)", "2FA Secret")}</span>
                  {account.twoFactor && (
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(
                          account.twoFactor,
                          "2fa",
                          tr("Mã 2FA", "2FA Key"),
                        )
                      }
                      className="hover:text-foreground cursor-pointer p-0.5"
                    >
                      {copiedKey === "2fa" ? (
                        <Check className="size-3 text-emerald-500" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </button>
                  )}
                </span>
                <span className="text-xs font-mono select-all break-all text-foreground">
                  {account.twoFactor || tr("Chưa có", "None")}
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
                      onClick={() =>
                        handleCopy(account.mail, "mail", tr("Email", "Email"))
                      }
                      className="hover:text-foreground cursor-pointer p-0.5"
                    >
                      {copiedKey === "mail" ? (
                        <Check className="size-3 text-emerald-500" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </button>
                  )}
                </span>
                <span className="text-xs font-mono select-all break-all text-foreground">
                  {account.mail || tr("Chưa có", "None")}
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
                        handleCopy(account.proxy, "proxy", tr("Proxy", "Proxy"))
                      }
                      className="hover:text-foreground cursor-pointer p-0.5"
                    >
                      {copiedKey === "proxy" ? (
                        <Check className="size-3 text-emerald-500" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </button>
                  )}
                </span>
                <span className="text-xs font-mono select-all break-all text-foreground">
                  {account.proxy || tr("Chưa chọn", "Not set")}
                </span>
              </div>
            </div>

            {/* Token EAAAA */}
            <div className="rounded-lg border border-border/80 bg-muted/20 p-2.5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Key className="size-3.5 text-blue-500" />
                  <span>Access Token (EAAAA)</span>
                </span>
                {account.token && (
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(account.token, "token", tr("Token", "Token"))
                    }
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer"
                  >
                    {copiedKey === "token" ? (
                      <Check className="size-3 text-emerald-500" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                    <span>
                      {copiedKey === "token"
                        ? tr("Đã chép", "Copied")
                        : "Copy Token"}
                    </span>
                  </button>
                )}
              </div>
              <div className="max-h-20 overflow-y-auto rounded bg-background/80 p-2 text-xs font-mono select-all break-all border border-border/50 text-foreground">
                {account.token || tr("Chưa có Token", "No Token")}
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
                      handleCopy(
                        account.cookie,
                        "cookie",
                        tr("Cookie", "Cookie"),
                      )
                    }
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer"
                  >
                    {copiedKey === "cookie" ? (
                      <Check className="size-3 text-emerald-500" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                    <span>
                      {copiedKey === "cookie"
                        ? tr("Đã chép", "Copied")
                        : "Copy Cookie"}
                    </span>
                  </button>
                )}
              </div>
              <div className="max-h-20 overflow-y-auto rounded bg-background/80 p-2 text-xs font-mono select-all break-all border border-border/50 text-foreground">
                {account.cookie || tr("Chưa có Cookie", "No Cookie")}
              </div>
            </div>

            {/* Danh sách Fanpage / Profile+ của tài khoản */}
            {account.pages && account.pages.length > 0 && (
              <div className="rounded-lg border border-border/80 bg-muted/20 p-2.5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Flag className="size-3.5 text-blue-500" />
                    <span>
                      {tr(
                        `Danh sách Fanpage / Profile+ (${account.pages.length})`,
                        `Fanpages / Profile+ (${account.pages.length})`,
                      )}
                    </span>
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {account.pages.map((p) => {
                    const displayUid = p.additionalProfileId || p.pageId;
                    return (
                      <div
                        key={p.pageId}
                        className="flex items-center justify-between p-2 rounded bg-background/80 border border-border/50 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="size-7 rounded-full overflow-hidden bg-muted/60 shrink-0 border border-border/70 flex items-center justify-center">
                            {p.avatar ? (
                              // biome-ignore lint/performance/noImgElement: dynamic external avatar URL
                              <img
                                src={p.avatar}
                                alt=""
                                className="size-full object-cover"
                              />
                            ) : (
                              <FaFacebook className="size-4 text-[#1877F2]" />
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold truncate text-foreground">
                              {p.pageName}
                            </span>
                            <span className="text-[10px] font-mono text-muted-foreground">
                              UID: {displayUid}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(
                                displayUid,
                                `page_uid_${p.pageId}`,
                                "Page UID",
                              )
                            }
                            className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            UID
                          </button>
                          {p.pageToken && (
                            <button
                              type="button"
                              onClick={() =>
                                handleCopy(
                                  p.pageToken,
                                  `page_tok_${p.pageId}`,
                                  "Page Token",
                                )
                              }
                              className="text-[10px] px-1.5 py-0.5 rounded border border-blue-500/20 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 cursor-pointer"
                            >
                              Token
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Chuỗi định dạng gốc */}
            <div className="rounded-lg border border-border/80 bg-muted/20 p-2.5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {tr("Chuỗi dữ liệu gốc (Raw Text)", "Raw Data String")}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      account.rawText,
                      "raw",
                      tr("Chuỗi dữ liệu gốc", "Raw Text"),
                    )
                  }
                  className="flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer"
                >
                  {copiedKey === "raw" ? (
                    <Check className="size-3 text-emerald-500" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  <span>
                    {copiedKey === "raw" ? tr("Đã chép", "Copied") : "Copy Raw"}
                  </span>
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
            {tr("Đóng", "Close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
