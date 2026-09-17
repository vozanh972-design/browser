"use client";

import { motion } from "motion/react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaDownload } from "react-icons/fa";
import { FiWifi } from "react-icons/fi";
import {
  LuActivity,
  LuBox,
  LuCheckCircle,
  LuCloud,
  LuFolder,
  LuLayers,
  LuPlus,
  LuSettings,
  LuSparkles,
  LuUsers,
} from "react-icons/lu";
import { AboutDialog } from "@/components/about-dialog";
import { AppHeader } from "@/components/app-header";
import { AppSettingsDialog } from "@/components/app-settings-dialog";
import { type AppPage, RailNav } from "@/components/rail-nav";
import { ShortcutsPage } from "@/components/shortcuts-page";
import { Button } from "@/components/ui/button";
import { MOTION_EASE_OUT } from "@/lib/motion";

export default function HomePage() {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState<AppPage>("profiles");
  const [aboutDialogOpen, setAboutDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleRailNavigate = useCallback((page: AppPage) => {
    if (page === "settings") {
      setSettingsDialogOpen(true);
      setCurrentPage("settings");
      return;
    }
    setCurrentPage(page);
  }, []);

  const getPageTitle = (page: AppPage) => {
    switch (page) {
      case "profiles":
        return t("rail.profiles", "Dashboard");
      case "proxies":
        return t("rail.network", "Network");
      case "groups":
        return t("rail.groups", "Groups");
      case "account":
        return t("rail.account", "Account");
      case "import":
        return t("rail.more.importProfile", "Import");
      case "shortcuts":
        return t("rail.more.keyboardShortcuts", "Shortcuts");
      case "settings":
        return t("rail.settings", "Settings");
      default:
        return "";
    }
  };

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground font-(family-name:--font-geist-sans) overflow-hidden select-none">
      {/* Top titlebar with drag region & window control spacing */}
      <AppHeader
        pageTitle={getPageTitle(currentPage)}
        searchQuery={currentPage === "profiles" ? searchQuery : undefined}
        onSearchQueryChange={
          currentPage === "profiles" ? setSearchQuery : undefined
        }
      />

      {/* Main content area */}
      <div className="flex min-h-0 flex-1 flex-col">
        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto px-6 py-5">
          {currentPage === "profiles" && (
            <motion.div
              key="profiles"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: MOTION_EASE_OUT }}
              className="mx-auto flex w-full max-w-5xl flex-col gap-6"
            >
              {/* Welcome banner */}
              <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-6 shadow-xs">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <LuSparkles className="size-5 text-primary" />
                    <h1 className="text-xl font-bold tracking-tight">
                      Xin chào dirtycslothg
                    </h1>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Giao diện đã sẵn sàng để bạn phát triển tính năng mới cho
                    ứng dụng.
                  </p>
                </div>
                <Button className="flex items-center gap-2 cursor-pointer shadow-xs">
                  <LuPlus className="size-4" />
                  <span>Tạo mới</span>
                </Button>
              </div>

              {/* Stat overview cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-medium">Tổng quan</span>
                    <LuBox className="size-4" />
                  </div>
                  <div className="text-2xl font-bold">0</div>
                  <span className="text-xs text-muted-foreground">
                    Mục đang hoạt động
                  </span>
                </div>

                <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-medium">Kết nối</span>
                    <LuActivity className="size-4" />
                  </div>
                  <div className="flex items-center gap-1.5 text-2xl font-bold text-success">
                    <LuCheckCircle className="size-5" />
                    <span>Online</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Hệ thống sẵn sàng
                  </span>
                </div>

                <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-medium">Nhóm</span>
                    <LuFolder className="size-4" />
                  </div>
                  <div className="text-2xl font-bold">0</div>
                  <span className="text-xs text-muted-foreground">
                    Phân loại mặc định
                  </span>
                </div>

                <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-medium">Lưu trữ</span>
                    <LuLayers className="size-4" />
                  </div>
                  <div className="text-2xl font-bold">Local</div>
                  <span className="text-xs text-muted-foreground">
                    Không giới hạn
                  </span>
                </div>
              </div>

              {/* Content area placeholder */}
              <div className="flex min-h-[340px] flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/10 p-8 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/40 mb-4 text-muted-foreground">
                  <LuSparkles className="size-7" />
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  Không gian làm việc trống
                </h3>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  Tất cả các chức năng cũ đã được lược bỏ thành công. Bạn có thể
                  bắt đầu xây dựng giao diện và logic của app mới tại đây.
                </p>
                <div className="mt-5 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSettingsDialogOpen(true)}
                  >
                    <LuSettings className="size-3.5 mr-1.5" />
                    Cài đặt giao diện
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {currentPage === "proxies" && (
            <motion.div
              key="proxies"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: MOTION_EASE_OUT }}
              className="mx-auto flex w-full max-w-4xl flex-col gap-4"
            >
              <div className="flex items-center justify-between border-b border-border/40 pb-4">
                <div className="flex items-center gap-2.5">
                  <FiWifi className="size-5 text-primary" />
                  <div>
                    <h2 className="text-lg font-semibold">Mạng & Kết nối</h2>
                    <p className="text-xs text-muted-foreground">
                      Khu vực quản lý proxy, mạng và cấu hình kết nối.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
                Khung trang kết nối / network trống
              </div>
            </motion.div>
          )}

          {currentPage === "groups" && (
            <motion.div
              key="groups"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: MOTION_EASE_OUT }}
              className="mx-auto flex w-full max-w-4xl flex-col gap-4"
            >
              <div className="flex items-center justify-between border-b border-border/40 pb-4">
                <div className="flex items-center gap-2.5">
                  <LuUsers className="size-5 text-primary" />
                  <div>
                    <h2 className="text-lg font-semibold">Nhóm & Phân loại</h2>
                    <p className="text-xs text-muted-foreground">
                      Khu vực quản lý danh sách các nhóm hoặc thư mục.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
                Khung trang quản lý nhóm trống
              </div>
            </motion.div>
          )}

          {currentPage === "account" && (
            <motion.div
              key="account"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: MOTION_EASE_OUT }}
              className="mx-auto flex w-full max-w-4xl flex-col gap-4"
            >
              <div className="flex items-center justify-between border-b border-border/40 pb-4">
                <div className="flex items-center gap-2.5">
                  <LuCloud className="size-5 text-primary" />
                  <div>
                    <h2 className="text-lg font-semibold">
                      Tài khoản & Đám mây
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Quản lý tài khoản người dùng, đồng bộ hoặc license.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
                Khung trang tài khoản trống
              </div>
            </motion.div>
          )}

          {currentPage === "import" && (
            <motion.div
              key="import"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: MOTION_EASE_OUT }}
              className="mx-auto flex w-full max-w-4xl flex-col gap-4"
            >
              <div className="flex items-center justify-between border-b border-border/40 pb-4">
                <div className="flex items-center gap-2.5">
                  <FaDownload className="size-5 text-primary" />
                  <div>
                    <h2 className="text-lg font-semibold">
                      Nhập dữ liệu (Import)
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Nhập file, dữ liệu hoặc cấu hình từ bên ngoài.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
                Khung import trống
              </div>
            </motion.div>
          )}

          {currentPage === "shortcuts" && (
            <motion.div
              key="shortcuts"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: MOTION_EASE_OUT }}
              className="flex min-h-0 flex-1 flex-col"
            >
              <ShortcutsPage groupTargets={[]} />
            </motion.div>
          )}
        </main>

        {/* Apple dock style bottom navigation bar with icons & logo */}
        <RailNav
          currentPage={currentPage}
          onNavigate={handleRailNavigate}
          onOpenAbout={() => {
            setAboutDialogOpen(true);
          }}
        />
      </div>

      {/* Settings Dialog */}
      <AppSettingsDialog
        isOpen={settingsDialogOpen}
        onClose={() => {
          setSettingsDialogOpen(false);
          setCurrentPage("profiles");
        }}
      />

      {/* About Dialog */}
      <AboutDialog
        isOpen={aboutDialogOpen}
        onClose={() => {
          setAboutDialogOpen(false);
        }}
      />
    </div>
  );
}
