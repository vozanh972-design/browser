"use client";

import { getCurrentWindow } from "@tauri-apps/api/window";
import { MotionConfig } from "motion/react";
import { useEffect } from "react";
import { CloseConfirmDialog } from "@/components/close-confirm-dialog";
import { I18nProvider } from "@/components/i18n-provider";
import { CustomThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WindowDragArea } from "@/components/window-drag-area";
// setupLogging / @tauri-apps/plugin-log removed: writes log files to disk

export function ClientProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    try {
      void getCurrentWindow()
        .center()
        .catch(() => {});
    } catch {
      // ignore in non-Tauri preview environments
    }

    // Khôi phục tỉ lệ thu phóng (Display Scale) và độ sáng đã lưu khi khởi động ứng dụng
    try {
      const savedScale = localStorage.getItem("autolunex_display_scale");
      if (savedScale && savedScale !== "100") {
        document.documentElement.style.zoom = `${Number(savedScale) / 100}`;
      }
      const savedBrightness = localStorage.getItem("autolunex_display_brightness");
      if (savedBrightness && savedBrightness !== "100") {
        document.documentElement.style.filter = `brightness(${savedBrightness}%)`;
      }
    } catch {
      // ignore
    }

    // Chặn menu chuột phải mặc định của WebView2 (Lùi, Làm mới, Lưu thành, In...)
    // Chỉ cho phép menu trên input/textarea/contentEditable để người dùng có thể Cắt/Sao chép/Dán.
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

      if (!isInput) {
        e.preventDefault();
      }
    };

    // Chặn các phím tắt trình duyệt: in ấn (Ctrl+P), lưu trang (Ctrl+S), reload (Ctrl+R, F5)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey &&
          (e.key === "p" ||
            e.key === "P" ||
            e.key === "s" ||
            e.key === "S" ||
            e.key === "r" ||
            e.key === "R")) ||
        e.key === "F5"
      ) {
        e.preventDefault();
      }
    };

    window.addEventListener("contextmenu", handleContextMenu, {
      capture: true,
    });
    window.addEventListener("keydown", handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu, {
        capture: true,
      });
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, []);

  return (
    <I18nProvider>
      <CustomThemeProvider>
        {/* reducedMotion="user" makes every motion/react animation honor the
            OS prefers-reduced-motion setting: transforms are skipped, opacity
            cross-fades are kept. The CSS-side media query in globals.css only
            covers CSS transitions — this covers the JS-driven ones. */}
        <MotionConfig reducedMotion="user">
          <WindowDragArea />
          <CloseConfirmDialog />
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
        </MotionConfig>
      </CustomThemeProvider>
    </I18nProvider>
  );
}
