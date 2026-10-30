"use client";

import {
  AlertTriangle,
  HelpCircle,
  Smartphone,
  Usb,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type AdbDeviceInfo, getAdbDevices, startAdbDeviceWatcher } from "@/lib/adb-service";
import { cn } from "@/lib/utils";
import { AdbInstallDialog } from "./adb-install-dialog";
import { UsbBottomSheet } from "./usb-bottom-sheet";

export function UsbDeviceHub() {
  const [devices, setDevices] = useState<AdbDeviceInfo[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isInstallDialogOpen, setIsInstallDialogOpen] = useState(false);
  const [connectedPopupDevice, setConnectedPopupDevice] = useState<AdbDeviceInfo | null>(null);

  // Khởi động tiến trình theo dõi cắm/rút thiết bị tự động thời gian thực
  useEffect(() => {
    const stopWatcher = startAdbDeviceWatcher({
      onDeviceConnected: (device) => {
        // Kích hoạt Popup trượt từ đáy màn hình lên tự đóng sau vài giây
        setConnectedPopupDevice(device);

        // Phát sự kiện ra toàn bộ ứng dụng để tự đồng bộ thẻ TikTok
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("autolunex:adb-device-connected", { detail: device }),
          );
        }

        void refreshDevices();
      },
      onDeviceUnauthorized: (device) => {
        toast.warning(
          `⚠️ Thiết bị ${device.model || device.serial} chưa được cấp quyền!`,
          {
            description:
              "Vui lòng mở khóa điện thoại, tích chọn 'Luôn cho phép từ máy tính này' rồi bấm OK trên màn hình điện thoại.",
            duration: 6000,
          },
        );
        void refreshDevices();
      },
      onDeviceDisconnected: (serial) => {
        toast.info("🔌 Đã ngắt kết nối một thiết bị USB.", { duration: 2500 });
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("autolunex:adb-device-disconnected", { detail: serial }),
          );
        }
        void refreshDevices();
      },
      onAdbMissing: () => {
        // Chỉ hiện hộp thoại nếu chưa có ADB
        setIsInstallDialogOpen(true);
      },
    });

    void refreshDevices();

    return () => {
      stopWatcher();
    };
  }, []);

  const refreshDevices = async () => {
    try {
      const devList = await getAdbDevices();
      setDevices(devList);
    } catch {
      // ignore
    }
  };

  const readyDevices = devices.filter((d) => d.state === "device");
  const unauthorizedDevices = devices.filter((d) => d.state === "unauthorized");

  return (
    <>
      {/* Nút bấm hiển thị trạng thái USB trên thanh Header */}
      <button
        type="button"
        onClick={() => setIsDialogOpen(true)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all cursor-pointer select-none",
          readyDevices.length > 0
            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20 shadow-xs"
            : unauthorizedDevices.length > 0
              ? "bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20 animate-pulse"
              : "bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/60 hover:text-foreground",
        )}
        title="Quản lý thiết bị điện thoại kết nối qua cổng USB (ADB)"
      >
        <Smartphone className="size-3.5" />
        {readyDevices.length > 0 ? (
          <div className="flex items-center gap-1.5">
            <span className="relative flex size-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full size-1.5 bg-emerald-500" />
            </span>
            <span className="max-w-[110px] truncate font-semibold">
              {readyDevices[0].display_name || readyDevices[0].model}
            </span>
            {readyDevices.length > 1 && (
              <span className="rounded bg-emerald-500/20 px-1 text-[10px] font-bold">
                +{readyDevices.length - 1}
              </span>
            )}
          </div>
        ) : unauthorizedDevices.length > 0 ? (
          <div className="flex items-center gap-1 text-amber-500">
            <AlertTriangle className="size-3" />
            <span>Chờ cấp quyền ({unauthorizedDevices.length})</span>
          </div>
        ) : (
          <span>Cổng USB</span>
        )}
      </button>

      {/* Dialog quản lý chi tiết các thiết bị kết nối */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden bg-background border-border">
          <DialogHeader className="p-5 pb-3.5 border-b border-border/60 bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                <Usb className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-sm sm:text-base font-bold text-foreground">
                  Hướng dẫn kết nối USB (ADB)
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Chỉ cần cắm cáp USB vào máy tính. Hệ thống sẽ tự động nhận diện và hiện ra danh sách.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-5 space-y-3 text-xs">
            {/* 3 Bước hướng dẫn trực quan */}
            <div className="space-y-2.5">
              {/* Bước 1 */}
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3 flex gap-3 items-start">
                <span className="flex size-6 rounded-full bg-primary/15 text-primary font-bold text-xs items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <div className="space-y-1">
                  <span className="font-semibold text-foreground text-xs block">
                    Bật chế độ Nhà phát triển
                  </span>
                  <p className="text-[11.5px] text-muted-foreground leading-relaxed">
                    Vào <strong className="text-foreground">Cài đặt</strong> &gt; <strong className="text-foreground">Thông tin điện thoại</strong> (hoặc <em>Thông tin phần mềm</em>) &gt; Nhấn liên tục <strong className="text-primary font-semibold">7 lần</strong> vào dòng <strong className="text-foreground">Số bản dựng (Build Number)</strong> để mở chế độ Nhà phát triển.
                  </p>
                </div>
              </div>

              {/* Bước 2 */}
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3 flex gap-3 items-start">
                <span className="flex size-6 rounded-full bg-primary/15 text-primary font-bold text-xs items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <div className="space-y-1">
                  <span className="font-semibold text-foreground text-xs block">
                    Bật Gỡ lỗi USB (USB Debugging)
                  </span>
                  <p className="text-[11.5px] text-muted-foreground leading-relaxed">
                    Quay lại menu Cài đặt &gt; Vào mục <strong className="text-foreground">Tùy chọn nhà phát triển</strong> (hoặc <em>Cài đặt bổ sung</em>) &gt; Gạt bật công tắc <strong className="text-primary font-semibold">Gỡ lỗi USB</strong>.
                  </p>
                </div>
              </div>

              {/* Bước 3 */}
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3 flex gap-3 items-start">
                <span className="flex size-6 rounded-full bg-primary/15 text-primary font-bold text-xs items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <div className="space-y-1">
                  <span className="font-semibold text-foreground text-xs block">
                    Cắm cáp & Cấp quyền kết nối
                  </span>
                  <p className="text-[11.5px] text-muted-foreground leading-relaxed">
                    Cắm cáp nối điện thoại với máy tính. Mở khóa màn hình, trên cửa sổ pop-up điện thoại tích chọn <strong className="text-foreground">&quot;Luôn cho phép từ máy tính này&quot;</strong> rồi nhấn <strong className="text-emerald-500 font-semibold">Cho phép / OK</strong>.
                  </p>
                </div>
              </div>
            </div>

            {/* Chú thích & Nút chuyển xem cài đặt ADB */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2.5 border-t border-border/50 text-[11px]">
              <span className="text-muted-foreground text-center sm:text-left">
                ✓ Thiết bị sau khi cắm cáp sẽ tự động nhận diện và hiện ra danh sách.
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsDialogOpen(false);
                  setIsInstallDialogOpen(true);
                }}
                className="h-7 text-xs gap-1.5 cursor-pointer text-primary border-primary/30 hover:bg-primary/10 shrink-0 font-medium"
              >
                <HelpCircle className="size-3.5" />
                <span>Xem hướng dẫn tải & cài đặt ADB</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal hướng dẫn cài đặt ADB nếu máy tính chưa có */}
      <AdbInstallDialog
        isOpen={isInstallDialogOpen}
        onClose={() => setIsInstallDialogOpen(false)}
        onAdbDetected={() => {
          void refreshDevices();
        }}
      />

      {/* Popup trượt từ đáy màn hình lên tự đóng sau vài giây (như ảnh mẫu) */}
      <UsbBottomSheet
        device={connectedPopupDevice}
        onClose={() => setConnectedPopupDevice(null)}
      />
    </>
  );
}
