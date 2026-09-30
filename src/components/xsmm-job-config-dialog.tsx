"use client";

import { Check, Heart, MessageCircle, RotateCcw, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_XSMM_JOB_CONFIG,
  getStoredXsmmJobConfig,
  saveXsmmJobConfig,
  type XsmmJobConfig,
} from "@/lib/xsmm-runner";

interface XsmmJobConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function XsmmJobConfigDialog({
  isOpen,
  onClose,
}: XsmmJobConfigDialogProps) {
  const [config, setConfig] = useState<XsmmJobConfig>(DEFAULT_XSMM_JOB_CONFIG);

  useEffect(() => {
    if (isOpen) {
      setConfig(getStoredXsmmJobConfig());
    }
  }, [isOpen]);

  const handleSave = () => {
    saveXsmmJobConfig(config);
    onClose();
  };

  const handleResetDefault = () => {
    setConfig({ ...DEFAULT_XSMM_JOB_CONFIG });
  };

  const hasAtLeastOneJob =
    config.enableFollow || config.enableLike || config.enableComment;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[460px] p-0 gap-0 overflow-hidden rounded-2xl border border-border/40 bg-background/95 backdrop-blur-2xl shadow-2xl">
        {/* Header — macOS titlebar style */}
        <DialogHeader className="px-6 pt-5 pb-3 shrink-0">
          <DialogTitle className="text-sm font-semibold tracking-tight text-foreground">
            Cài đặt chạy Job XSMM
          </DialogTitle>
          <p className="text-[11.5px] text-muted-foreground/75 mt-0.5">
            Cấu hình loại nhiệm vụ, độ trễ và giới hạn tự động cho Instagram
          </p>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="px-6 py-2 space-y-4 text-xs">
          {/* Section: Loại Job (Apple Segmented Style) */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground/60 px-0.5">
              Nhiệm vụ
            </span>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-muted/40 border border-border/40">
              {/* Follow */}
              <button
                type="button"
                onClick={() =>
                  setConfig((prev) => ({
                    ...prev,
                    enableFollow: !prev.enableFollow,
                  }))
                }
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  config.enableFollow
                    ? "bg-background text-foreground shadow-xs border border-border/50"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <UserPlus
                  className={`size-3.5 ${
                    config.enableFollow ? "text-blue-500" : ""
                  }`}
                />
                <span>Follow</span>
                {config.enableFollow && (
                  <Check className="size-3 text-blue-500 ml-0.5" />
                )}
              </button>

              {/* Thả Tym */}
              <button
                type="button"
                onClick={() =>
                  setConfig((prev) => ({
                    ...prev,
                    enableLike: !prev.enableLike,
                  }))
                }
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  config.enableLike
                    ? "bg-background text-foreground shadow-xs border border-border/50"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Heart
                  className={`size-3.5 ${
                    config.enableLike ? "text-rose-500 fill-rose-500/20" : ""
                  }`}
                />
                <span>Thả Tym</span>
                {config.enableLike && (
                  <Check className="size-3 text-rose-500 ml-0.5" />
                )}
              </button>

              {/* Comment */}
              <button
                type="button"
                onClick={() =>
                  setConfig((prev) => ({
                    ...prev,
                    enableComment: !prev.enableComment,
                  }))
                }
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  config.enableComment
                    ? "bg-background text-foreground shadow-xs border border-border/50"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <MessageCircle
                  className={`size-3.5 ${
                    config.enableComment ? "text-amber-500" : ""
                  }`}
                />
                <span>Bình luận</span>
                {config.enableComment && (
                  <Check className="size-3 text-amber-500 ml-0.5" />
                )}
              </button>
            </div>
            {!hasAtLeastOneJob && (
              <p className="text-[11px] text-destructive px-1 pt-0.5">
                Vui lòng chọn ít nhất 1 loại nhiệm vụ.
              </p>
            )}
          </div>

          {/* Section: Thời gian (Apple Inset Grouped Table) */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground/60 px-0.5">
              Thời gian & Delay
            </span>
            <div className="rounded-xl border border-border/40 bg-muted/20 dark:bg-white/[0.02] divide-y divide-border/30 overflow-hidden">
              {/* Delay làm mỗi Job */}
              <div className="flex items-center justify-between px-3.5 py-2.5">
                <div className="space-y-0.5">
                  <span className="font-medium text-foreground block">
                    Delay làm mỗi Job
                  </span>
                  <span className="text-[11px] text-muted-foreground/75 block">
                    Nghỉ ngẫu nhiên giữa 2 hành động
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-xs">
                  <Input
                    type="number"
                    min={3}
                    max={120}
                    value={config.delayActionMin}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        delayActionMin: Math.max(1, Number(e.target.value)),
                      }))
                    }
                    className="h-6.5 w-12 text-center text-xs px-1 rounded-md [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none bg-background/80"
                  />
                  <span className="text-muted-foreground/50">-</span>
                  <Input
                    type="number"
                    min={3}
                    max={180}
                    value={config.delayActionMax}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        delayActionMax: Math.max(1, Number(e.target.value)),
                      }))
                    }
                    className="h-6.5 w-12 text-center text-xs px-1 rounded-md [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none bg-background/80"
                  />
                  <span className="text-muted-foreground text-[11px] ml-0.5">
                    giây
                  </span>
                </div>
              </div>

              {/* Chờ khi hết Job */}
              <div className="flex items-center justify-between px-3.5 py-2.5">
                <div className="space-y-0.5">
                  <span className="font-medium text-foreground block">
                    Chờ khi hết Job
                  </span>
                  <span className="text-[11px] text-muted-foreground/75 block">
                    Thời gian nghỉ chờ hệ thống cấp job mới
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-xs">
                  <Input
                    type="number"
                    min={2}
                    max={120}
                    value={config.delayWaitJob}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        delayWaitJob: Math.max(2, Number(e.target.value)),
                      }))
                    }
                    className="h-6.5 w-12 text-center text-xs px-1 rounded-md [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none bg-background/80"
                  />
                  <span className="text-muted-foreground text-[11px] ml-0.5">
                    giây
                  </span>
                </div>
              </div>

              {/* Giãn cách giữa các acc */}
              <div className="flex items-center justify-between px-3.5 py-2.5">
                <div className="space-y-0.5">
                  <span className="font-medium text-foreground block">
                    Giãn cách giữa các acc
                  </span>
                  <span className="text-[11px] text-muted-foreground/75 block">
                    Độ trễ khởi chạy khi chạy nhiều nick đồng thời
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-xs">
                  <Input
                    type="number"
                    step="1"
                    min={1}
                    max={60}
                    value={config.delayBetweenAccounts}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        delayBetweenAccounts: Math.max(
                          1,
                          Number(e.target.value),
                        ),
                      }))
                    }
                    className="h-6.5 w-12 text-center text-xs px-1 rounded-md [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none bg-background/80"
                  />
                  <span className="text-muted-foreground text-[11px] ml-0.5">
                    giây
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Giới hạn & An toàn (Apple Inset Grouped Table) */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground/60 px-0.5">
              Giới hạn & Tự động dừng
            </span>
            <div className="rounded-xl border border-border/40 bg-muted/20 dark:bg-white/[0.02] divide-y divide-border/30 overflow-hidden">
              {/* Số job tối đa mỗi nick */}
              <div className="flex items-center justify-between px-3.5 py-2.5">
                <div className="space-y-0.5">
                  <span className="font-medium text-foreground block">
                    Số job tối đa mỗi nick
                  </span>
                  <span className="text-[11px] text-muted-foreground/75 block">
                    Tự động dừng tài khoản khi đạt số lượng
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-xs">
                  <Input
                    type="number"
                    min={0}
                    max={1000}
                    value={config.maxJobsPerAccount}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        maxJobsPerAccount: Math.max(0, Number(e.target.value)),
                      }))
                    }
                    className="h-6.5 w-16 text-center text-xs px-1 rounded-md [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none bg-background/80"
                  />
                  <span className="text-muted-foreground text-[11px] ml-0.5">
                    job
                  </span>
                </div>
              </div>

              {/* Dừng khi lỗi liên tiếp */}
              <div className="flex items-center justify-between px-3.5 py-2.5">
                <div className="space-y-0.5">
                  <span className="font-medium text-foreground block">
                    Dừng khi lỗi liên tiếp
                  </span>
                  <span className="text-[11px] text-muted-foreground/75 block">
                    Bảo vệ nick khi lỗi mạng hoặc tài khoản bị chặn
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-xs">
                  <Input
                    type="number"
                    min={5}
                    max={100}
                    value={config.maxConsecutiveErrors}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        maxConsecutiveErrors: Math.max(
                          2,
                          Number(e.target.value),
                        ),
                      }))
                    }
                    className="h-6.5 w-16 text-center text-xs px-1 rounded-md [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none bg-background/80"
                  />
                  <span className="text-muted-foreground text-[11px] ml-0.5">
                    lần
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Danh sách comment tùy chỉnh (nếu bật) */}
          {config.enableComment && (
            <div className="space-y-1.5 pt-0.5">
              <span className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground/60 px-0.5">
                Nội dung bình luận (mỗi dòng 1 comment)
              </span>
              <Textarea
                rows={2}
                placeholder="Tuyệt vời quá\nFollow chéo nhé bạn"
                value={config.commentList}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    commentList: e.target.value,
                  }))
                }
                className="text-xs font-mono rounded-xl bg-muted/20 border-border/40 focus:border-border/60"
              />
            </div>
          )}
        </div>

        {/* Footer — Apple style: clean Reset on left, single Save button on right */}
        <div className="px-6 py-3.5 border-t border-border/40 bg-muted/15 flex items-center justify-between mt-2 shrink-0">
          <button
            type="button"
            onClick={handleResetDefault}
            className="flex items-center gap-1 text-[11.5px] text-muted-foreground/70 hover:text-foreground transition-colors cursor-pointer"
          >
            <RotateCcw className="size-3" />
            <span>Mặc định</span>
          </button>

          <Button
            type="button"
            onClick={handleSave}
            disabled={!hasAtLeastOneJob}
            className="rounded-full px-5 h-8 text-xs font-medium cursor-pointer shadow-xs"
          >
            Lưu cấu hình
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
