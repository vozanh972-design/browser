"use client";

import { AlertCircle, CheckCircle2, Download, ExternalLink, RefreshCw, Terminal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { checkAdbStatus } from "@/lib/adb-service";

interface AdbInstallDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdbDetected?: () => void;
}

export function AdbInstallDialog({
  isOpen,
  onClose,
  onAdbDetected,
}: AdbInstallDialogProps) {
  const [isChecking, setIsChecking] = useState(false);

  const handleDownloadAdb = () => {
    window.open(
      "https://dl.google.com/android/repository/platform-tools-latest-windows.zip",
      "_blank",
      "noopener,noreferrer",
    );
    toast.success("Đang mở trang tải gói công cụ ADB chính thức từ Google!");
  };

  const handleRecheck = async () => {
    setIsChecking(true);
    try {
      const res = await checkAdbStatus();
      if (res.installed) {
        toast.success(`Đã nhận diện thành công ADB: ${res.version || "Sẵn sàng"}`);
        onAdbDetected?.();
        onClose();
      } else {
        toast.error("Vẫn chưa tìm thấy công cụ ADB trên máy tính. Vui lòng làm theo hướng dẫn.");
      }
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <AlertCircle className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold">
                Chưa cài đặt công cụ kết nối Android (ADB)
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Cần có gói Android Platform Tools để tự động nhận diện điện thoại cắm qua cáp USB.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2 text-xs">
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <Terminal className="size-3.5 text-primary" />
              <span>3 bước cài đặt cực nhanh:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground pl-1 leading-relaxed">
              <li>
                Bấm nút <strong className="text-foreground">Tải ADB từ Google</strong> bên dưới để tải file ZIP.
              </li>
              <li>
                Giải nén file tải về vào thư mục <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">C:\platform-tools</code> hoặc ổ <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">D:\</code>.
              </li>
              <li>
                Bấm nút <strong className="text-foreground">Kiểm tra lại</strong> để hệ thống tự nhận diện.
              </li>
            </ol>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px]">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>
              Chỉ cần cài 1 lần duy nhất, AutoLunex sẽ tự động nhớ vĩnh viễn trên máy tính của bạn.
            </span>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between gap-2 pt-2 border-t border-border/40">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadAdb}
            className="text-xs gap-1.5 cursor-pointer bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
          >
            <Download className="size-3.5" />
            <span>Tải ADB từ Google (.ZIP)</span>
            <ExternalLink className="size-3 opacity-60" />
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-xs cursor-pointer text-muted-foreground"
            >
              Để sau
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isChecking}
              onClick={handleRecheck}
              className="text-xs gap-1.5 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              <RefreshCw className={`size-3 ${isChecking ? "animate-spin" : ""}`} />
              <span>Kiểm tra lại</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
