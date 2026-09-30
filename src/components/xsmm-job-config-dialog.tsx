"use client";

import {
  CheckSquare,
  Clock,
  Heart,
  MessageCircle,
  Play,
  RotateCcw,
  Save,
  Settings2,
  Sliders,
  UserPlus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  onRunNow?: () => void;
  selectedCount?: number;
}

export function XsmmJobConfigDialog({
  isOpen,
  onClose,
  onRunNow,
  selectedCount = 0,
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

  const handleSaveAndRun = () => {
    saveXsmmJobConfig(config);
    onClose();
    if (onRunNow) {
      onRunNow();
    }
  };

  const handleResetDefault = () => {
    setConfig({ ...DEFAULT_XSMM_JOB_CONFIG });
  };

  const hasAtLeastOneJob =
    config.enableFollow || config.enableLike || config.enableComment;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-5 py-4 border-b border-border/50 shrink-0 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Settings2 className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold tracking-tight">
                Cài đặt cấu hình chạy Job XSMM (Instagram)
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Tùy chỉnh loại nhiệm vụ, thời gian delay làm job và chờ nhận job
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* Section 1: Loại Job */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <CheckSquare className="size-3.5 text-primary" />
                Chọn loại Job muốn làm
              </Label>
              <span className="text-[11px] text-muted-foreground">
                (Ít nhất 1 loại)
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {/* Follow */}
              <label
                htmlFor="job-follow"
                className={`flex flex-col gap-1.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                  config.enableFollow
                    ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20 text-foreground"
                    : "border-border/60 bg-muted/20 hover:bg-muted/40 text-muted-foreground"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-medium text-xs">
                    <UserPlus className="size-3.5 text-blue-500" />
                    <span>Follow</span>
                  </div>
                  <Checkbox
                    id="job-follow"
                    checked={config.enableFollow}
                    onCheckedChange={(checked) =>
                      setConfig((prev) => ({
                        ...prev,
                        enableFollow: Boolean(checked),
                      }))
                    }
                  />
                </div>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  Theo dõi tài khoản
                </span>
              </label>

              {/* Like / Tym */}
              <label
                htmlFor="job-like"
                className={`flex flex-col gap-1.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                  config.enableLike
                    ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20 text-foreground"
                    : "border-border/60 bg-muted/20 hover:bg-muted/40 text-muted-foreground"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-medium text-xs">
                    <Heart className="size-3.5 text-rose-500" />
                    <span>Thả Tym</span>
                  </div>
                  <Checkbox
                    id="job-like"
                    checked={config.enableLike}
                    onCheckedChange={(checked) =>
                      setConfig((prev) => ({
                        ...prev,
                        enableLike: Boolean(checked),
                      }))
                    }
                  />
                </div>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  Thả tym bài viết
                </span>
              </label>

              {/* Comment */}
              <label
                htmlFor="job-comment"
                className={`flex flex-col gap-1.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                  config.enableComment
                    ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20 text-foreground"
                    : "border-border/60 bg-muted/20 hover:bg-muted/40 text-muted-foreground"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-medium text-xs">
                    <MessageCircle className="size-3.5 text-amber-500" />
                    <span>Bình luận</span>
                  </div>
                  <Checkbox
                    id="job-comment"
                    checked={config.enableComment}
                    onCheckedChange={(checked) =>
                      setConfig((prev) => ({
                        ...prev,
                        enableComment: Boolean(checked),
                      }))
                    }
                  />
                </div>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  Comment bài viết
                </span>
              </label>
            </div>

            {!hasAtLeastOneJob && (
              <p className="text-[11px] text-destructive font-medium">
                Vui lòng chọn ít nhất 1 loại nhiệm vụ để tool chạy!
              </p>
            )}
          </div>

          {/* Section 2: Cài đặt Thời Gian (Delay) */}
          <div className="space-y-3 pt-2 border-t border-border/40">
            <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
              <Clock className="size-3.5 text-primary" />
              Cài đặt Thời gian (Delay giây)
            </Label>

            <div className="grid grid-cols-2 gap-3">
              {/* Delay làm job (Min - Max) */}
              <div className="space-y-1.5 p-2.5 rounded-lg border border-border/50 bg-muted/20">
                <span className="text-xs font-medium text-foreground">
                  Delay làm mỗi Job (ngẫu nhiên)
                </span>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Nghỉ ngẫu nhiên giữa 2 job để chống checkpoint nick
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex items-center gap-1 flex-1">
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
                      className="h-7 text-xs text-center px-1"
                    />
                    <span className="text-[11px] text-muted-foreground">s</span>
                  </div>
                  <span className="text-muted-foreground font-bold">-</span>
                  <div className="flex items-center gap-1 flex-1">
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
                      className="h-7 text-xs text-center px-1"
                    />
                    <span className="text-[11px] text-muted-foreground">s</span>
                  </div>
                </div>
              </div>

              {/* Delay chờ khi hết job */}
              <div className="space-y-1.5 p-2.5 rounded-lg border border-border/50 bg-muted/20">
                <span className="text-xs font-medium text-foreground">
                  Chờ khi hết Job
                </span>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Thời gian nghỉ chờ hệ thống có job mới
                </p>
                <div className="flex items-center gap-1 pt-1">
                  <Input
                    type="number"
                    min={3}
                    max={120}
                    value={config.delayWaitJob}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        delayWaitJob: Math.max(2, Number(e.target.value)),
                      }))
                    }
                    className="h-7 text-xs text-center w-20"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    giây (khuyên dùng 8s - 15s)
                  </span>
                </div>
              </div>
            </div>

            {/* Delay giữa các tài khoản khi bắt đầu */}
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-muted/20">
              <div>
                <span className="text-xs font-medium text-foreground block">
                  Giãn cách khởi chạy giữa các nick
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Tránh gửi request đồng thời khi chạy nhiều nick cùng lúc
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  step="0.5"
                  min={0.5}
                  max={30}
                  value={config.delayBetweenAccounts}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      delayBetweenAccounts: Math.max(
                        0.5,
                        Number(e.target.value),
                      ),
                    }))
                  }
                  className="h-7 text-xs text-center w-16"
                />
                <span className="text-[11px] text-muted-foreground">giây</span>
              </div>
            </div>
          </div>

          {/* Section 3: Giới hạn & Chống lỗi */}
          <div className="space-y-3 pt-2 border-t border-border/40">
            <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
              <Sliders className="size-3.5 text-primary" />
              Giới hạn & Tự động dừng
            </Label>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 p-2.5 rounded-lg border border-border/50 bg-muted/20">
                <span className="text-xs font-medium text-foreground block">
                  Số job tối đa mỗi nick
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  (Đặt 0 nếu muốn chạy liên tục)
                </span>
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
                  className="h-7 text-xs text-center w-24 mt-1"
                />
              </div>

              <div className="space-y-1 p-2.5 rounded-lg border border-border/50 bg-muted/20">
                <span className="text-xs font-medium text-foreground block">
                  Dừng khi lỗi liên tiếp
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  Tránh checkpoint nick khi lỗi mạng
                </span>
                <Input
                  type="number"
                  min={2}
                  max={20}
                  value={config.maxConsecutiveErrors}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      maxConsecutiveErrors: Math.max(2, Number(e.target.value)),
                    }))
                  }
                  className="h-7 text-xs text-center w-24 mt-1"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Danh sách nội dung Comment (nếu bật comment) */}
          {config.enableComment && (
            <div className="space-y-1.5 pt-2 border-t border-border/40">
              <Label
                htmlFor="cmt-textarea"
                className="text-xs font-semibold flex items-center gap-1.5 text-foreground"
              >
                <MessageCircle className="size-3.5 text-amber-500" />
                Danh sách nội dung bình luận (mỗi dòng 1 comment)
              </Label>
              <Textarea
                id="cmt-textarea"
                rows={3}
                placeholder="Tuyệt vời quá\nQuá đẹp\nFollow chéo nhé bạn"
                value={config.commentList}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    commentList: e.target.value,
                  }))
                }
                className="text-xs font-mono"
              />
              <span className="text-[10px] text-muted-foreground block">
                Nếu để trống, tool sẽ tự động dùng nội dung nhiệm vụ do XSMM chỉ
                định.
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-5 py-3 border-t border-border/50 bg-muted/20 flex sm:justify-between items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResetDefault}
            className="text-[11px] text-muted-foreground hover:text-foreground gap-1 h-7 cursor-pointer"
          >
            <RotateCcw className="size-3" />
            Mặc định
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSave}
              className="text-xs h-8 gap-1.5 cursor-pointer"
            >
              <Save className="size-3.5" />
              Lưu cấu hình
            </Button>

            {onRunNow && (
              <Button
                type="button"
                size="sm"
                onClick={handleSaveAndRun}
                disabled={!hasAtLeastOneJob}
                className="text-xs h-8 gap-1.5 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                <Play className="size-3.5 fill-current" />
                <span>
                  {selectedCount > 0
                    ? `Lưu & Chạy (${selectedCount})`
                    : "Lưu & Chạy ngay"}
                </span>
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
