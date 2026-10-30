"use client";

import {
  AlertTriangle,
  Battery,
  BatteryCharging,
  CheckCircle2,
  HelpCircle,
  Info,
  RefreshCw,
  Send,
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
import { type AdbDeviceInfo, getAdbDevices, notifyPhoneConnected, startAdbDeviceWatcher } from "@/lib/adb-service";
import { cn } from "@/lib/utils";
import { AdbInstallDialog } from "./adb-install-dialog";
import { UsbBottomSheet } from "./usb-bottom-sheet";

export function UsbDeviceHub() {
  const [devices, setDevices] = useState<AdbDeviceInfo[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isInstallDialogOpen, setIsInstallDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [testSendingSerial, setTestSendingSerial] = useState<string | null>(null);
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
    setIsRefreshing(true);
    try {
      const devList = await getAdbDevices();
      setDevices(devList);
    } catch {
      // ignore
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTestNotification = async (serial: string, name: string) => {
    setTestSendingSerial(serial);
    try {
      const ok = await notifyPhoneConnected(
        serial,
        "AutoLunex",
        `Đã kết nối thành công với ${name}!`,
      );
      if (ok) {
        toast.success(`Đã gửi thông báo kết nối sang điện thoại: ${name}!`);
      } else {
        toast.error("Không thể gửi thông báo sang điện thoại.");
      }
    } finally {
      setTestSendingSerial(null);
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center justify-between pr-4">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <Usb className="size-4" />
                </div>
                <div>
                  <DialogTitle className="text-sm font-semibold">
                    Thiết bị Android kết nối USB (ADB)
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Tự động nhận diện điện thoại cắm cáp mà không cần cài thêm ứng dụng nào vào điện thoại.
                  </DialogDescription>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isRefreshing}
                onClick={refreshDevices}
                className="h-7 text-xs gap-1 cursor-pointer"
                title="Quét lại thiết bị"
              >
                <RefreshCw className={cn("size-3", isRefreshing && "animate-spin")} />
                <span>Quét lại</span>
              </Button>
            </div>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2 text-xs">
            {devices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center rounded-xl border border-dashed border-border/70 bg-muted/20 p-4">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500 border border-blue-500/20 mb-3">
                  <Smartphone className="size-6" />
                </div>
                <p className="font-semibold text-foreground text-sm">
                  Chưa có điện thoại nào kết nối
                </p>
                <p className="text-xs text-muted-foreground max-w-sm mt-1 leading-relaxed">
                  Chỉ cần cắm cáp USB nối điện thoại với máy tính. Hệ thống sẽ tự động nhận diện và hiển thị thông tin máy ngay tức thì.
                </p>

                {/* Hướng dẫn bật Gỡ lỗi USB 3 bước */}
                <div className="mt-4 w-full rounded-xl border border-border/60 bg-muted/40 p-3 text-left space-y-1.5 text-[11.5px]">
                  <div className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                    <Info className="size-3.5 text-blue-500" />
                    <span>Hướng dẫn bật Gỡ lỗi USB trên điện thoại:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground pl-1 leading-relaxed">
                    <li>Vào <strong className="text-foreground">Cài đặt</strong> &gt; <strong className="text-foreground">Thông tin điện thoại</strong> &gt; Nhấn liên tục 7 lần vào <strong className="text-foreground">Số bản dựng (Build Number)</strong> để mở chế độ Nhà phát triển.</li>
                    <li>Vào mục <strong className="text-foreground">Tùy chọn nhà phát triển</strong> &gt; Bật <strong className="text-foreground">Gỡ lỗi USB (USB Debugging)</strong>.</li>
                    <li>Cắm cáp USB vào máy tính, trên màn hình điện thoại tích chọn <strong className="text-foreground">"Luôn cho phép từ máy tính này"</strong> và nhấn <strong className="text-foreground">Cho phép / OK</strong>.</li>
                  </ol>
                </div>

                <div className="flex items-center gap-2 mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsDialogOpen(false);
                      setIsInstallDialogOpen(true);
                    }}
                    className="h-7 text-xs gap-1.5 cursor-pointer text-primary border-primary/30 hover:bg-primary/10"
                  >
                    <HelpCircle className="size-3.5" />
                    <span>Chưa có ADB? Xem hướng dẫn tải & cài đặt</span>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                {devices.map((dev) => {
                  const isReady = dev.state === "device";
                  const isUnauthorized = dev.state === "unauthorized";

                  return (
                    <div
                      key={dev.serial}
                      className={cn(
                        "rounded-xl border p-3 flex flex-col gap-2.5 transition-all",
                        isReady
                          ? "bg-card border-border/80 shadow-xs"
                          : "bg-amber-500/5 border-amber-500/30",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={cn(
                              "flex size-7.5 items-center justify-center rounded-lg shrink-0",
                              isReady
                                ? "bg-emerald-500/10 text-emerald-500"
                                : "bg-amber-500/10 text-amber-500",
                            )}
                          >
                            <Smartphone className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-foreground text-xs truncate flex items-center gap-1.5">
                              <span>{dev.display_name}</span>
                              {isReady && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                                  ✓ Đã kết nối
                                </span>
                              )}
                            </div>
                            <div className="text-[10.5px] font-mono text-muted-foreground truncate">
                              Serial: {dev.serial}
                            </div>
                          </div>
                        </div>

                        {/* Thông số pin & Android version */}
                        <div className="shrink-0 flex items-center gap-2 text-[11px]">
                          {dev.battery_level !== null && (
                            <span className="flex items-center gap-1 text-muted-foreground font-medium bg-muted/40 px-2 py-0.5 rounded-md border border-border/40">
                              <Battery className="size-3 text-emerald-500" />
                              <span>{dev.battery_level}%</span>
                            </span>
                          )}
                          {dev.android_version && (
                            <span className="text-[10px] text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded border border-border/30">
                              Android {dev.android_version}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Trạng thái Unauthorized: cảnh báo người dùng bấm Cho phép trên điện thoại */}
                      {isUnauthorized && (
                        <div className="rounded-lg bg-amber-500/10 p-2.5 border border-amber-500/20 text-amber-500 text-[11px] space-y-1">
                          <div className="font-semibold flex items-center gap-1">
                            <AlertTriangle className="size-3.5 shrink-0" />
                            <span>Chưa cho phép Gỡ lỗi USB trên điện thoại</span>
                          </div>
                          <p className="text-muted-foreground pl-4 leading-relaxed">
                            Mở khóa điện thoại, tích chọn{" "}
                            <strong className="text-foreground">"Luôn cho phép từ máy tính này"</strong>{" "}
                            rồi nhấn <strong className="text-foreground">Cho phép / OK</strong>.
                          </p>
                        </div>
                      )}

                      {/* Nút hành động test kết nối */}
                      {isReady && (
                        <div className="flex items-center justify-between pt-1.5 border-t border-border/30 text-[11px]">
                          <span className="text-muted-foreground">
                            Đã kích hoạt thông báo hệ thống AutoLunex
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={testSendingSerial === dev.serial}
                            onClick={() =>
                              handleTestNotification(dev.serial, dev.display_name)
                            }
                            className="h-6.5 text-[10.5px] gap-1 cursor-pointer"
                            title="Gửi thử thông báo tới điện thoại để kiểm tra"
                          >
                            <Send className="size-2.5" />
                            <span>
                              {testSendingSerial === dev.serial
                                ? "Đang gửi..."
                                : "Bắn thông báo test"}
                            </span>
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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
