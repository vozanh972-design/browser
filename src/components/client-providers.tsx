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
import { setupLogging } from "@/lib/logger";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void setupLogging();
    try {
      void getCurrentWindow()
        .center()
        .catch(() => {});
    } catch {
      // ignore in non-Tauri preview environments
    }
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
