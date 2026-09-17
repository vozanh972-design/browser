"use client";

import { motion } from "motion/react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaFacebook } from "react-icons/fa";
import {
  LuActivity,
  LuCopy,
  LuFolder,
  LuKey,
  LuPlus,
  LuShieldCheck,
  LuTrash2,
  LuUserCheck,
} from "react-icons/lu";
import { AboutDialog } from "@/components/about-dialog";
import { AddFacebookAccountDialog } from "@/components/add-facebook-account-dialog";
import { AppHeader } from "@/components/app-header";
import { AppSettingsDialog } from "@/components/app-settings-dialog";
import { type AppPage, RailNav } from "@/components/rail-nav";
import { ShortcutsPage } from "@/components/shortcuts-page";
import { Button } from "@/components/ui/button";
import { XsmmLoginDialog } from "@/components/xsmm-login-dialog";
import { MOTION_EASE_OUT } from "@/lib/motion";
import { showSuccessToast } from "@/lib/toast-utils";

interface FacebookAccount {
  id: string;
  uid: string;
  pass?: string;
  twoFactor?: string;
  cookie?: string;
  mail?: string;
  status: "live" | "checkpoint" | "unverified";
  rawText: string;
}

export default function HomePage() {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState<AppPage>("profiles");
  const [aboutDialogOpen, setAboutDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [isAddFacebookOpen, setIsAddFacebookOpen] = useState(false);
  const [isXsmmLoginOpen, setIsXsmmLoginOpen] = useState(false);
  const [xsmmAccount, setXsmmAccount] = useState<{
    username: string;
    balance: string;
    token: string;
    isLoggedIn: boolean;
  }>({
    username: "",
    balance: "",
    token: "",
    isLoggedIn: false,
  });
  const [accounts, setAccounts] = useState<FacebookAccount[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleXsmmLoginSuccess = (user: {
    username: string;
    balance: string;
    token: string;
  }) => {
    setXsmmAccount({
      ...user,
      isLoggedIn: true,
    });
    showSuccessToast(`Đăng nhập XSMM thành công! Chào mừng ${user.username}`);
  };

  const handleXsmmLogout = () => {
    setXsmmAccount({
      username: "",
      balance: "",
      token: "",
      isLoggedIn: false,
    });
    showSuccessToast("Đã đăng xuất tài khoản XSMM");
  };

  const handleRailNavigate = useCallback((page: AppPage) => {
    if (page === "settings") {
      setSettingsDialogOpen(true);
      setCurrentPage("settings");
      return;
    }
    setCurrentPage(page);
  }, []);

  const handleAddAccounts = (lines: string[], format: string) => {
    const formatKeys = format.split("|").map((f) => f.trim().toLowerCase());
    const newAccounts: FacebookAccount[] = lines.map((line, idx) => {
      const parts = line.split("|").map((p) => p.trim());
      const account: FacebookAccount = {
        id: `${Date.now()}-${idx}`,
        uid: parts[0] || `acc_${idx + 1}`,
        status: "unverified",
        rawText: line,
      };

      formatKeys.forEach((key, kIdx) => {
        const val = parts[kIdx];
        if (!val) return;
        if (key.includes("uid")) account.uid = val;
        else if (key.includes("mật khẩu") || key.includes("pass"))
          account.pass = val;
        else if (key.includes("2fa")) account.twoFactor = val;
        else if (key.includes("cookie")) account.cookie = val;
        else if (key.includes("mail")) account.mail = val;
      });

      return account;
    });

    setAccounts((prev) => [...newAccounts, ...prev]);
    showSuccessToast(
      `Đã thêm ${newAccounts.length} tài khoản Facebook thành công!`,
    );
  };

  const handleDeleteAccount = (id: string) => {
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    setSelectedIds((prev) => prev.filter((i) => i !== id));
  };

  const handleCopy = (text: string) => {
    void navigator.clipboard.writeText(text);
    showSuccessToast("Đã sao chép vào bộ nhớ tạm!");
  };

  const filteredAccounts = accounts;

  const getPageTitle = (page: AppPage) => {
    switch (page) {
      case "profiles":
        return "Tài khoản Facebook";
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
      {/* Top titlebar với drag region & thông tin XSMM */}
      <AppHeader
        pageTitle={getPageTitle(currentPage)}
        xsmmAccount={xsmmAccount}
        onXsmmLoginClick={() => setIsXsmmLoginOpen(true)}
        onXsmmLogoutClick={handleXsmmLogout}
        onNewClick={() => {
          if (!xsmmAccount.isLoggedIn) {
            setIsXsmmLoginOpen(true);
          } else {
            setIsAddFacebookOpen(true);
          }
        }}
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
              className="mx-auto flex w-full max-w-5xl flex-col gap-5"
            >
              {/* Stat overview cards */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-3.5">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-medium">Tổng tài khoản</span>
                    <FaFacebook className="size-3.5 text-[#1877F2]" />
                  </div>
                  <div className="text-xl font-bold">{accounts.length}</div>
                  <span className="text-[11px] text-muted-foreground">
                    Tài khoản đã thêm
                  </span>
                </div>

                <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-3.5">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-medium">Trạng thái Live</span>
                    <LuUserCheck className="size-3.5 text-success" />
                  </div>
                  <div className="text-xl font-bold text-success">
                    {accounts.filter((a) => a.status === "live").length}
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Đang hoạt động tốt
                  </span>
                </div>

                <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-3.5">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-medium">Kết nối XSMM</span>
                    <LuActivity className="size-3.5" />
                  </div>
                  {xsmmAccount.isLoggedIn ? (
                    <div className="flex items-center gap-1.5 text-xl font-bold text-success">
                      <span className="size-2 rounded-full bg-success animate-pulse" />
                      <span>Đã kết nối</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xl font-bold text-amber-500">
                      <span className="size-2 rounded-full bg-amber-500" />
                      <span>Chưa kết nối</span>
                    </div>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    {xsmmAccount.isLoggedIn
                      ? xsmmAccount.username
                      : "Yêu cầu đăng nhập"}
                  </span>
                </div>

                <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-3.5">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-medium">Đã chọn</span>
                    <LuFolder className="size-3.5" />
                  </div>
                  <div className="text-xl font-bold">{selectedIds.length}</div>
                  <span className="text-[11px] text-muted-foreground">
                    Thao tác hàng loạt
                  </span>
                </div>
              </div>

              {/* Danh sách hoặc Empty State */}
              {!xsmmAccount.isLoggedIn ? (
                /* CHƯA ĐĂNG NHẬP XSMM: Chỉ hiện phần đăng nhập XSMM */
                <div className="flex min-h-[360px] flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/10 p-8 text-center">
                  <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-inner">
                    <LuShieldCheck className="size-7" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">
                    Chưa kết nối tài khoản XSMM
                  </h3>
                  <p className="mt-1.5 max-w-sm text-xs text-muted-foreground leading-relaxed">
                    Bạn cần đăng nhập tài khoản XSMM bằng Access Token để sử dụng hệ thống và quản lý tài khoản Facebook.
                  </p>
                  <div className="mt-5 flex gap-2">
                    <Button
                      onClick={() => setIsXsmmLoginOpen(true)}
                      className="cursor-pointer gap-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold shadow-xs"
                    >
                      <LuKey className="size-4" />
                      <span>+ Đăng nhập tài khoản XSMM</span>
                    </Button>
                  </div>
                </div>
              ) : accounts.length === 0 ? (
                /* ĐÃ ĐĂNG NHẬP XSMM: Hiện empty state thêm tài khoản Facebook */
                <div className="flex min-h-[360px] flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/10 p-8 text-center">
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-[#1877F2]/10 mb-4 text-[#1877F2]">
                    <FaFacebook className="size-7" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">
                    Chưa có tài khoản Facebook nào
                  </h3>
                  <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                    Thêm danh sách tài khoản Facebook đầu tiên của bạn để bắt
                    đầu quản lý.
                  </p>
                  <div className="mt-5 flex gap-2">
                    <Button
                      onClick={() => setIsAddFacebookOpen(true)}
                      className="cursor-pointer gap-2"
                    >
                      <LuPlus className="size-4" />
                      <span>Thêm tài khoản Facebook</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col rounded-xl border border-border bg-card overflow-hidden shadow-xs">
                  <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5 bg-muted/20">
                    <span className="text-xs font-semibold">
                      Danh sách tài khoản ({filteredAccounts.length})
                    </span>
                    <Button
                      size="sm"
                      onClick={() => setIsAddFacebookOpen(true)}
                      className="h-7 text-xs gap-1 cursor-pointer"
                    >
                      <LuPlus className="size-3.5" />
                      <span>Thêm mới</span>
                    </Button>
                  </div>

                  <div className="divide-y divide-border/40 overflow-x-auto">
                    {filteredAccounts.map((acc) => (
                      <div
                        key={acc.id}
                        className="flex items-center justify-between px-4 py-3 text-xs hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <FaFacebook className="size-4 text-[#1877F2] shrink-0" />
                          <div className="flex flex-col">
                            <span className="font-mono font-semibold text-foreground">
                              {acc.uid}
                            </span>
                            {acc.mail && (
                              <span className="text-[11px] text-muted-foreground">
                                {acc.mail}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          {acc.twoFactor && (
                            <span className="font-mono text-[11px] bg-muted/60 px-2 py-0.5 rounded text-muted-foreground">
                              2FA: {acc.twoFactor}
                            </span>
                          )}

                          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <span className="size-2 rounded-full bg-muted-foreground/50" />
                            <span>Chưa kiểm tra</span>
                          </span>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleCopy(acc.rawText)}
                              title="Sao chép toàn bộ"
                              className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-colors cursor-pointer"
                            >
                              <LuCopy className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAccount(acc.id)}
                              title="Xóa tài khoản"
                              className="p-1.5 text-muted-foreground hover:text-destructive rounded hover:bg-muted transition-colors cursor-pointer"
                            >
                              <LuTrash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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

      {/* Dialog Thêm tài khoản Facebook */}
      <AddFacebookAccountDialog
        isOpen={isAddFacebookOpen}
        onClose={() => setIsAddFacebookOpen(false)}
        onAddAccounts={handleAddAccounts}
      />

      {/* Dialog Đăng nhập XSMM */}
      <XsmmLoginDialog
        isOpen={isXsmmLoginOpen}
        onClose={() => setIsXsmmLoginOpen(false)}
        onLoginSuccess={handleXsmmLoginSuccess}
      />

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
