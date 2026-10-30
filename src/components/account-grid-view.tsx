"use client";

import {
  Check,
  CircleAlert,
  Copy,
  Flag,
  Globe,
  Link2,
  Play,
  RefreshCw,
  Square,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { FaFacebook, FaInstagram } from "react-icons/fa";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { type FacebookAccount } from "@/app/page";
import { type FacebookPageItem } from "@/lib/facebook-api";
import { cn } from "@/lib/utils";
import { type AccountRunState } from "@/lib/xsmm-runner";

interface AccountGridViewProps {
  accounts: FacebookAccount[];
  selectedIds: string[];
  onToggleSelectOne: (id: string) => void;
  checkingIds: string[];
  runnerStates: Map<string, AccountRunState>;
  currentPage: string;
  nvcLinkedUids: string[];
  nvcLinkingIds: string[];
  onLinkNvcAccount: (acc: FacebookAccount) => void;
  dolikeLinkedUsernames?: string[];
  dolikeLinkingIds?: string[];
  onLinkDolikeAccount?: (acc: FacebookAccount) => void;
  xsmmLinkingIds?: string[];
  onLinkXsmmAccount?: (acc: FacebookAccount) => void;
  onCheckAccount: (acc: FacebookAccount) => void;
  onRunAccount: (acc: FacebookAccount) => void;
  onDeleteAccount: (id: string) => void;
  onDetailAccount: (acc: FacebookAccount) => void;
  onCheckPage?: (acc: FacebookAccount, page: FacebookPageItem) => void;
  onRunPage?: (acc: FacebookAccount, page: FacebookPageItem) => void;
  tr: (vi: string, en: string) => string;
}

export function AccountGridView({
  accounts,
  selectedIds,
  onToggleSelectOne,
  checkingIds,
  runnerStates,
  currentPage,
  nvcLinkedUids,
  nvcLinkingIds,
  onLinkNvcAccount,
  dolikeLinkedUsernames = [],
  dolikeLinkingIds = [],
  onLinkDolikeAccount,
  xsmmLinkingIds = [],
  onLinkXsmmAccount,
  onCheckAccount,
  onRunAccount,
  onDeleteAccount,
  onDetailAccount,
  tr,
}: AccountGridViewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyUid = (uid: string) => {
    if (!uid) return;
    navigator.clipboard.writeText(uid);
    setCopiedId(uid);
    toast.success(tr(`Đã sao chép UID: ${uid}`, `Copied UID: ${uid}`));
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(290px,330px))] gap-3 p-4 overflow-y-auto flex-1 content-start items-start select-none">
      {accounts.map((acc) => {
        const isSelected = selectedIds.includes(acc.id);
        const isChecking = checkingIds.includes(acc.id);
        const isCheckpointOrDie =
          acc.isLive === false ||
          acc.status === "checkpoint" ||
          acc.status === "die";
        const runState = runnerStates.get(acc.id);
        const isRunning = runState?.isRunning ?? false;
        const isInstagram = acc.platform === "instagram";
        const hasPages = acc.pages && acc.pages.length > 0;

        return (
          <div
            key={acc.id}
            className={cn(
              "group relative flex flex-col rounded-2xl border p-3.5 transition-all duration-200 shadow-xs h-fit w-full",
              isSelected
                ? "bg-primary/10 border-primary ring-1 ring-primary/40 shadow-md"
                : isCheckpointOrDie
                  ? "bg-muted/15 border-border/40 opacity-70 hover:opacity-100 hover:border-destructive/40"
                  : "bg-card/75 backdrop-blur-md border-border/50 hover:border-border hover:shadow-md hover:bg-card/95",
            )}
          >
            {/* Hàng 1: Checkbox + Tên/Nick + Platform + Trạng thái Live/Die */}
            <div className="flex items-center justify-between gap-1.5 mb-2.5">
              <div className="flex items-center gap-2 min-w-0 flex-1 pr-1">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleSelectOne(acc.id)}
                />
                {/* Platform Badge */}
                <div
                  className={cn(
                    "flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border shrink-0",
                    isInstagram
                      ? "bg-[#E1306C]/10 text-[#E1306C] border-[#E1306C]/25"
                      : "bg-[#1877F2]/10 text-[#1877F2] border-[#1877F2]/25",
                  )}
                >
                  {isInstagram ? (
                    <FaInstagram className="size-2.5" />
                  ) : (
                    <FaFacebook className="size-2.5" />
                  )}
                  <span>{isInstagram ? "IG" : "FB"}</span>
                </div>

                {/* Tên hiển thị */}
                <span
                  className={cn(
                    "text-xs font-semibold truncate leading-tight",
                    isCheckpointOrDie
                      ? "text-muted-foreground line-through"
                      : "text-foreground",
                  )}
                  title={acc.name || acc.uid}
                >
                  {acc.name || (isInstagram ? `@${acc.uid}` : acc.uid)}
                </span>
              </div>

              {/* Status Badge */}
              <div className="shrink-0 flex items-center">
                {isChecking ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border/40">
                    <RefreshCw className="size-2.5 animate-spin text-primary" />
                    <span>{tr("Đang check", "Checking")}</span>
                  </span>
                ) : runState &&
                  (runState.successCount > 0 || runState.earnedPoints > 0) ? (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                    title={`${runState.successCount} job thành công, ${runState.errorCount} lỗi`}
                  >
                    <span>✓ {runState.successCount}</span>
                    {runState.earnedPoints > 0 && (
                      <span className="font-semibold text-emerald-400">
                        (+{runState.earnedPoints})
                      </span>
                    )}
                  </span>
                ) : acc.isLive === true || acc.status === "live" ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/25">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Live</span>
                  </span>
                ) : isCheckpointOrDie ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/10 text-rose-500 border border-rose-500/25">
                    <span className="size-1.5 rounded-full bg-rose-500" />
                    <span>
                      {acc.status === "checkpoint"
                        ? tr("Checkpoint", "Checkpoint")
                        : "Die"}
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-500 border border-amber-500/25">
                    <span className="size-1.5 rounded-full bg-amber-500" />
                    <span>{tr("Chưa check", "Unchecked")}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Hàng 2: Avatar nhỏ gọn + UID copyable */}
            <div className="flex items-center gap-2 mb-2 bg-muted/20 px-2 py-1.5 rounded-xl border border-border/30">
              <div
                className={cn(
                  "relative size-6.5 rounded-full overflow-hidden shrink-0 border border-border/60 flex items-center justify-center bg-muted/40",
                  isCheckpointOrDie && "grayscale opacity-70",
                )}
              >
                {acc.avatar && !isCheckpointOrDie ? (
                  // biome-ignore lint/performance/noImgElement: avatar
                  <img
                    src={acc.avatar}
                    alt=""
                    className="size-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : isInstagram ? (
                  <FaInstagram className="size-3.5 text-[#E1306C]" />
                ) : (
                  <FaFacebook className="size-3.5 text-[#1877F2]" />
                )}
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyUid(acc.uid);
                }}
                className="flex items-center gap-1 text-[10.5px] font-mono text-muted-foreground hover:text-primary transition-colors text-left truncate flex-1 group/uid cursor-pointer"
                title={tr("Nhấp để sao chép UID", "Click to copy UID")}
              >
                <span className="truncate">UID: {acc.uid}</span>
                {copiedId === acc.uid ? (
                  <Check className="size-2.5 text-emerald-500 shrink-0" />
                ) : (
                  <Copy className="size-2.5 opacity-0 group-hover/uid:opacity-100 shrink-0 text-primary" />
                )}
              </button>

              {hasPages && (
                <span className="text-[10px] text-blue-400 font-medium shrink-0 flex items-center gap-0.5 bg-blue-500/10 px-1.5 py-0.5 rounded-md border border-blue-500/20">
                  <Flag className="size-2.5" />
                  <span>{acc.pages?.length}</span>
                </span>
              )}
            </div>

            {/* Hàng 3: Khối thông số dạng Pill Badges ngang như ảnh 2 */}
            <div className="grid grid-cols-2 gap-1.5 mb-2.5 text-[10.5px]">
              {/* Pill Liên kết */}
              <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-muted/30 border border-border/35">
                <span className="text-[9.5px] text-muted-foreground/75 uppercase tracking-wide">
                  {tr("Liên kết", "Link")}
                </span>
                <div className="truncate text-right">
                  {currentPage === "nvc" ? (
                    (() => {
                      const isLinked = nvcLinkedUids.includes(acc.uid);
                      const isLinking = nvcLinkingIds.includes(acc.id);

                      if (isLinked) {
                        return (
                          <span className="text-emerald-500 font-medium">
                            {tr("Đã liên kết", "Linked")}
                          </span>
                        );
                      }
                      return (
                        <button
                          type="button"
                          disabled={isLinking}
                          onClick={(e) => {
                            e.stopPropagation();
                            onLinkNvcAccount(acc);
                          }}
                          className="text-[10px] font-medium text-blue-400 hover:underline cursor-pointer inline-flex items-center gap-1"
                          title={tr("Bấm để liên kết NVC", "Click to link NVC")}
                        >
                          {isLinking && (
                            <RefreshCw className="size-2.5 animate-spin" />
                          )}
                          <span>
                            {isLinking
                              ? tr("Đang link...", "Linking...")
                              : tr("Link NVC", "Link NVC")}
                          </span>
                        </button>
                      );
                    })()
                  ) : currentPage === "dolike" ? (
                    (() => {
                      const cleanUser = (acc.name || acc.uid || "")
                        .replace(/^@/, "")
                        .trim()
                        .toLowerCase();
                      const isLinked = dolikeLinkedUsernames.includes(cleanUser);
                      const isLinking = dolikeLinkingIds.includes(acc.id);

                      if (isLinked) {
                        return (
                          <span className="text-emerald-500 font-medium">
                            {tr("Đã liên kết", "Linked")}
                          </span>
                        );
                      }
                      return (
                        <button
                          type="button"
                          disabled={isLinking}
                          onClick={(e) => {
                            e.stopPropagation();
                            onLinkDolikeAccount?.(acc);
                          }}
                          className="text-[10px] font-medium text-amber-500 hover:underline cursor-pointer inline-flex items-center gap-1"
                          title={tr("Bấm để liên kết DoLike", "Click to link DoLike")}
                        >
                          {isLinking && (
                            <RefreshCw className="size-2.5 animate-spin" />
                          )}
                          <span>
                            {isLinking
                              ? tr("Đang link...", "Linking...")
                              : tr("Link DoLike", "Link DoLike")}
                          </span>
                        </button>
                      );
                    })()
                  ) : acc.token ? (
                    <span className="text-emerald-500 font-medium">
                      {tr("Đã liên kết", "Linked")}
                    </span>
                  ) : (
                    (() => {
                      const isLinking = xsmmLinkingIds.includes(acc.id);
                      return (
                        <button
                          type="button"
                          disabled={isLinking}
                          onClick={(e) => {
                            e.stopPropagation();
                            onLinkXsmmAccount?.(acc);
                          }}
                          className="text-[10px] font-medium text-blue-400 hover:underline cursor-pointer inline-flex items-center gap-1"
                          title={tr("Bấm để liên kết XSMM", "Click to link XSMM")}
                        >
                          {isLinking && (
                            <RefreshCw className="size-2.5 animate-spin" />
                          )}
                          <span>
                            {isLinking
                              ? tr("Đang link...", "Linking...")
                              : tr("Link XSMM", "Link XSMM")}
                          </span>
                        </button>
                      );
                    })()
                  )}
                </div>
              </div>

              {/* Pill Proxy */}
              <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-muted/30 border border-border/35">
                <span className="text-[9.5px] text-muted-foreground/75 uppercase tracking-wide">
                  Proxy
                </span>
                <span
                  className="font-mono text-[10px] truncate max-w-[80px] text-muted-foreground text-right"
                  title={acc.proxy || "Proxy mặc định"}
                >
                  {acc.proxy ? acc.proxy.split(":")[0] : tr("Mặc định", "Default")}
                </span>
              </div>

              {/* Pill Tiến trình / Hành động full 2 cột */}
              <div className="col-span-2 flex items-center justify-between px-2 py-1 rounded-lg bg-muted/30 border border-border/35">
                <span className="text-[9.5px] text-muted-foreground/75 uppercase tracking-wide">
                  {tr("Trạng thái", "State")}
                </span>
                <div className="truncate text-right font-medium max-w-[190px]">
                  {isCheckpointOrDie ? (
                    <span className="text-rose-500 text-[10px]">
                      {acc.status === "checkpoint" ? "Checkpoint" : "Die"}
                    </span>
                  ) : isRunning ? (
                    <span
                      className="inline-flex items-center gap-1.5 text-emerald-500 text-[10px] font-semibold truncate"
                      title={runState?.status}
                    >
                      <span className="relative flex size-1.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full size-1.5 bg-emerald-500" />
                      </span>
                      <span className="truncate">
                        {runState?.status || tr("Đang chạy...", "Running...")}
                      </span>
                    </span>
                  ) : runState?.lastError ? (
                    <span
                      className="text-amber-500 text-[10px] truncate"
                      title={runState.lastError}
                    >
                      {runState.lastError}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-[10px]">
                      {tr("Sẵn sàng", "Ready")}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Hàng 4: Footer Buttons gọn gàng chuẩn ảnh 2 */}
            <div className="flex items-center justify-between pt-2 border-t border-border/30">
              <div className="flex items-center gap-1">
                {/* Nút Xem chi tiết */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDetailAccount(acc);
                  }}
                  title={tr("Xem toàn bộ thông tin", "View full details")}
                  className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-muted/80 transition-colors cursor-pointer"
                >
                  <CircleAlert className="size-3.5" />
                </button>

                {/* Nút Kiểm tra lại */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCheckAccount(acc);
                  }}
                  title={tr("Kiểm tra lại Live/Die", "Re-check status")}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                >
                  <RefreshCw
                    className={cn(
                      "size-3.5",
                      isChecking && "animate-spin text-primary",
                    )}
                  />
                </button>

                {/* Nút Xóa */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteAccount(acc.id);
                  }}
                  title={tr("Xóa tài khoản", "Delete account")}
                  className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>

              {/* Nút Chạy / Dừng (gọn gàng, vừa khít) */}
              <button
                type="button"
                disabled={isCheckpointOrDie}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isCheckpointOrDie) return;
                  onRunAccount(acc);
                }}
                title={
                  isCheckpointOrDie
                    ? tr("Tài khoản lỗi", "Account error")
                    : isRunning
                      ? tr("Dừng chạy", "Stop account")
                      : tr("Chạy tài khoản", "Run account")
                }
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-semibold transition-all cursor-pointer shadow-xs",
                  isCheckpointOrDie
                    ? "opacity-30 cursor-not-allowed bg-muted text-muted-foreground"
                    : isRunning
                      ? "bg-rose-500/15 text-rose-500 border border-rose-500/30 hover:bg-rose-500/25"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white",
                )}
              >
                {isRunning ? (
                  <>
                    <Square className="size-2.5 fill-current" />
                    <span>{tr("Dừng", "Stop")}</span>
                  </>
                ) : (
                  <>
                    <Play className="size-2.5 fill-current" />
                    <span>{tr("Chạy", "Run")}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
