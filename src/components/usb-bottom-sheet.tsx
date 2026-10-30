"use client";

import {
  Battery,
  BatteryCharging,
  CheckCircle2,
  Cpu,
  Fingerprint,
  Smartphone,
  Sparkles,
  Usb,
} from "lucide-react";
import { useEffect, useState } from "react";
import { type AdbDeviceInfo } from "@/lib/adb-service";
import { cn } from "@/lib/utils";

interface UsbBottomSheetProps {
  device: AdbDeviceInfo | null;
  durationMs?: number;
  onClose: () => void;
}

export function UsbBottomSheet({
  device,
  durationMs = 4500,
  onClose,
}: UsbBottomSheetProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (!device) {
      setIsVisible(false);
      setIsLeaving(false);
      return;
    }

    setIsLeaving(false);
    setIsVisible(true);

    // Tự động đóng popup sau durationMs mà không cần bấm nút hủy
    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(() => {
        setIsVisible(false);
        setIsLeaving(false);
        onClose();
      }, 350); // thời gian animation trượt xuống
    }, durationMs);

    return () => clearTimeout(timer);
  }, [device, durationMs, onClose]);

  if (!device || !isVisible) return null;

  const displayName = device.display_name || device.market_name || device.model || "Thiết bị Android";
  const brandName = device.brand ? device.brand.toUpperCase() : "ANDROID";
  const modelCode = device.model || "Chuẩn USB";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none p-0 sm:p-4 bg-black/35 backdrop-blur-[2px] transition-opacity duration-300">
      <div
        className={cn(
          "pointer-events-auto w-full max-w-lg rounded-t-[28px] sm:rounded-[28px] border border-border/80 bg-background/95 p-6 shadow-2xl backdrop-blur-xl transition-all duration-300 ease-out",
          isLeaving
            ? "translate-y-full opacity-0 scale-95"
            : "translate-y-0 opacity-100 scale-100 animate-in slide-in-from-bottom-8 duration-300",
        )}
      >
        {/* Thanh gạch kéo trang trí trên đỉnh (Pill handle bar như ảnh mẫu) */}
        <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full mx-auto mb-4" />

        {/* Biểu tượng trung tâm bo tròn lớn */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-3 flex size-16 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-500/25 ring-4 ring-blue-500/20">
            <Smartphone className="size-8" />
            <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-background">
              <CheckCircle2 className="size-3.5" />
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-semibold text-[11px] tracking-wider uppercase mb-1 border border-blue-500/20">
            <Usb className="size-3" />
            <span>Đã kết nối qua cáp USB</span>
          </div>

          {/* Tên máy lớn */}
          <h2 className="text-xl font-bold text-foreground tracking-tight">
            {displayName}
          </h2>

          <p className="text-xs text-muted-foreground mt-0.5">
            Thiết bị đã được tự động liên kết thành công với AutoLunex
          </p>
        </div>

        {/* Bảng chi tiết thông số nhận diện của máy */}
        <div className="mt-5 grid grid-cols-2 gap-2.5 text-xs">
          {/* Hãng & Model */}
          <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/40 p-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-foreground shadow-2xs border border-border/40">
              <Cpu className="size-4 text-blue-500" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-medium text-muted-foreground">
                Mã máy / Model
              </div>
              <div className="font-semibold text-foreground truncate" title={modelCode}>
                {modelCode}
              </div>
            </div>
          </div>

          {/* Mã Serial / ID */}
          <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/40 p-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-foreground shadow-2xs border border-border/40">
              <Fingerprint className="size-4 text-emerald-500" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-medium text-muted-foreground">
                Serial / ID máy
              </div>
              <div className="font-semibold text-foreground font-mono truncate" title={device.serial}>
                {device.serial}
              </div>
            </div>
          </div>

          {/* Pin */}
          <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/40 p-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-foreground shadow-2xs border border-border/40">
              {device.battery_level !== null ? (
                <BatteryCharging className="size-4 text-amber-500" />
              ) : (
                <Battery className="size-4 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-medium text-muted-foreground">
                Mức Pin
              </div>
              <div className="font-semibold text-foreground">
                {device.battery_level !== null ? `${device.battery_level}% (Đang sạc)` : "Sẵn sàng"}
              </div>
            </div>
          </div>

          {/* Hệ điều hành Android */}
          <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/40 p-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-foreground shadow-2xs border border-border/40">
              <Sparkles className="size-4 text-purple-500" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-medium text-muted-foreground">
                Hệ điều hành
              </div>
              <div className="font-semibold text-foreground">
                {device.android_version ? `Android ${device.android_version}` : brandName}
              </div>
            </div>
          </div>
        </div>

        {/* Thanh đếm ngược tự đóng */}
        <div className="mt-4 flex items-center justify-center text-[11px] text-muted-foreground gap-1.5">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Tự động đóng trong giây lát...</span>
        </div>
      </div>
    </div>
  );
}
