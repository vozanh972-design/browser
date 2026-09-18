"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaDownload, FaFacebook, FaInstagram } from "react-icons/fa";
import {
  LuCloud,
  LuCopy,
  LuKey,
  LuPlus,
  LuShieldCheck,
  LuTrash2,
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
import { cn } from "@/lib/utils";
import { getXsmmUser } from "@/lib/xsmm-api";

interface FacebookAccount {
  id: string;
  uid: string;
  name?: string;
  pass?: string;
  twoFactor?: string;
  cookie?: string;
  mail?: string;
  tag?: string;
  note?: string;
  proxy?: string;
  platform?: "facebook" | "instagram";
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
  const [currentPlatform, setCurrentPlatform] = useState<
    "facebook" | "instagram"
  >("facebook");

  // Khôi phục phiên đăng nhập XSMM nếu đã lưu token
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem("xsmm_token");
      if (savedToken) {
        void getXsmmUser(savedToken).then((res) => {
          if (res.success && res.user) {
            setXsmmAccount({
              username: res.user.username,
              balance: `${res.user.points.toLocaleString("vi-VN")} xu`,
              token: savedToken,
              isLoggedIn: true,
            });
          }
        });
      }
    } catch {
      // ignore storage error
    }
  }, []);

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
    try {
      localStorage.removeItem("xsmm_token");
    } catch {
      // ignore
    }
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
        tag: "Không có thẻ",
        note: "Không có ghi chú",
        proxy: "Chưa chọn",
        platform: currentPlatform,
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
        else if (key.includes("proxy")) account.proxy = val;
        else if (key.includes("mail")) account.mail = val;
      });

      return account;
    });

    setAccounts((prev) => [...newAccounts, ...prev]);
    showSuccessToast(
      `Đã thêm ${newAccounts.length} tài khoản ${currentPlatform === "instagram" ? "Instagram" : "Facebook"} thành công!`,
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

  const filteredAccounts = accounts.filter(
    (a) => (a.platform || "facebook") === currentPlatform,
  );

  const toggleSelectAll = () => {
    if (
      selectedIds.length === filteredAccounts.length &&
      filteredAccounts.length > 0
    ) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredAccounts.map((a) => a.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const getPageTitle = (page: AppPage) => {
    switch (page) {
      case "profiles":
        return "";
      case "ttc":
        return "TTC";
      case "nvc":
        return "NVC";
      case "gl":
        return "GL";
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
        activePlatform={currentPlatform}
        onPlatformChange={setCurrentPlatform}
        pageTitle={getPageTitle(currentPage)}
        xsmmAccount={xsmmAccount}
        onXsmmLoginClick={() => setIsXsmmLoginOpen(true)}
        onXsmmLogoutClick={handleXsmmLogout}
        onNewClick={() => setIsAddFacebookOpen(true)}
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
              className="flex w-full flex-1 flex-col"
            >
              {/* Table View matching Image 2 */}
              <div className="flex flex-1 flex-col rounded-lg border border-border/60 bg-background overflow-hidden shadow-xs">
                {/* Table Header */}
                <div className="grid grid-cols-[40px_2.5fr_1.5fr_1.5fr_1.5fr_1.2fr_1fr_1fr_60px] items-center px-3 py-2.5 text-xs font-semibold text-muted-foreground border-b border-border/60 bg-background select-none">
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.length === filteredAccounts.length &&
                        filteredAccounts.length > 0
                      }
                      onChange={toggleSelectAll}
                      className="size-3.5 rounded border-border cursor-pointer accent-primary"
                    />
                  </div>
                  <div className="flex items-center gap-1 hover:text-foreground cursor-pointer">
                    <span>Tên</span>
                    <span className="text-[10px]">▲</span>
                  </div>
                  <div>Thẻ</div>
                  <div>Ghi chú</div>
                  <div>Proxy / VPN</div>
                  <div>TIỆN ÍCH</div>
                  <div>DNS</div>
                  <div>Bot</div>
                  <div className="text-right pr-2">Thao tác</div>
                </div>

                {/* Table Rows or Empty State */}
                {filteredAccounts.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center py-28 text-center select-none">
                    {!xsmmAccount.isLoggedIn ? (
                      <div className="flex flex-col items-center gap-2.5">
                        <div className="flex size-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          <LuShieldCheck className="size-6" />
                        </div>
                        <p className="text-xs font-semibold text-foreground">
                          Chưa kết nối tài khoản XSMM
                        </p>
                        <p className="text-[11px] text-muted-foreground max-w-xs leading-relaxed">
                          Vui lòng đăng nhập tài khoản XSMM để quản lý và tự
                          động hóa tài khoản.
                        </p>
                        <Button
                          size="sm"
                          onClick={() => setIsXsmmLoginOpen(true)}
                          className="mt-2 h-7.5 text-xs bg-amber-500 hover:bg-amber-600 text-black font-semibold cursor-pointer gap-1.5"
                        >
                          <LuKey className="size-3.5" />
                          <span>Đăng nhập tài khoản XSMM</span>
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div
                          className={cn(
                            "flex size-12 items-center justify-center rounded-xl",
                            currentPlatform === "instagram"
                              ? "bg-[#E1306C]/10 text-[#E1306C]"
                              : "bg-[#1877F2]/10 text-[#1877F2]",
                          )}
                        >
                          {currentPlatform === "instagram" ? (
                            <FaInstagram className="size-6" />
                          ) : (
                            <FaFacebook className="size-6" />
                          )}
                        </div>
                        <p className="text-xs font-semibold text-foreground">
                          {currentPlatform === "instagram"
                            ? "Chưa có tài khoản Instagram nào"
                            : "Chưa có tài khoản Facebook nào"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Bấm nút "+ Mới" ở góc trên bên phải để thêm tài khoản{" "}
                          {currentPlatform === "instagram"
                            ? "Instagram"
                            : "Facebook"}
                          .
                        </p>
                        <Button
                          size="sm"
                          onClick={() => setIsAddFacebookOpen(true)}
                          className="mt-2 h-7.5 text-xs cursor-pointer gap-1.5"
                        >
                          <LuPlus className="size-3.5" />
                          <span>
                            {currentPlatform === "instagram"
                              ? "Thêm tài khoản Instagram"
                              : "Thêm tài khoản Facebook"}
                          </span>
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-border/30 overflow-y-auto max-h-[calc(100vh-180px)]">
                    {filteredAccounts.map((acc) => (
                      <div
                        key={acc.id}
                        className="grid grid-cols-[40px_2.5fr_1.5fr_1.5fr_1.5fr_1.2fr_1fr_1fr_60px] items-center px-3 py-2 text-xs text-foreground hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(acc.id)}
                            onChange={() => toggleSelectOne(acc.id)}
                            className="size-3.5 rounded border-border cursor-pointer accent-primary"
                          />
                        </div>
                        <div className="flex items-center gap-2 font-mono font-medium truncate pr-2">
                          {acc.platform === "instagram" ? (
                            <FaInstagram className="size-3.5 text-[#E1306C] shrink-0" />
                          ) : (
                            <FaFacebook className="size-3.5 text-[#1877F2] shrink-0" />
                          )}
                          <span className="truncate">{acc.uid}</span>
                        </div>
                        <div className="text-muted-foreground truncate pr-2">
                          {acc.tag || "Không có thẻ"}
                        </div>
                        <div className="text-muted-foreground truncate pr-2">
                          {acc.note || "Không có ghi chú"}
                        </div>
                        <div className="text-muted-foreground truncate pr-2">
                          {acc.proxy || "Chưa chọn"}
                        </div>
                        <div className="text-muted-foreground truncate pr-2">
                          {acc.twoFactor ? `2FA: ${acc.twoFactor}` : "Mặc định"}
                        </div>
                        <div className="text-muted-foreground">—</div>
                        <div className="text-muted-foreground">—</div>
                        <div className="flex items-center justify-end gap-1 pr-1">
                          <button
                            type="button"
                            onClick={() => handleCopy(acc.rawText)}
                            title="Sao chép toàn bộ"
                            className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors cursor-pointer"
                          >
                            <LuCopy className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAccount(acc.id)}
                            title="Xóa tài khoản"
                            className="p-1 text-muted-foreground hover:text-destructive rounded transition-colors cursor-pointer"
                          >
                            <LuTrash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {(currentPage === "ttc" ||
            currentPage === "nvc" ||
            currentPage === "gl") && (
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: MOTION_EASE_OUT }}
              className="flex w-full flex-1 flex-col"
            >
              {/* Table View matching XSMM */}
              <div className="flex flex-1 flex-col rounded-lg border border-border/60 bg-background overflow-hidden shadow-xs">
                {/* Table Header */}
                <div className="grid grid-cols-[40px_2.5fr_1.5fr_1.5fr_1.5fr_1.2fr_1fr_1fr_60px] items-center px-3 py-2.5 text-xs font-semibold text-muted-foreground border-b border-border/60 bg-background select-none">
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      disabled
                      className="size-3.5 rounded border-border opacity-40 cursor-not-allowed"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span>Tên</span>
                    <span className="text-[10px]">▲</span>
                  </div>
                  <div>Thẻ</div>
                  <div>Ghi chú</div>
                  <div>Proxy / VPN</div>
                  <div>TIỆN ÍCH</div>
                  <div>TRẠNG THÁI TÀI KHOẢN</div>
                  <div>HÀNH ĐỘNG</div>
                  <div className="text-right">#</div>
                </div>

                {/* Empty State */}
                <div className="flex flex-1 flex-col items-center justify-center py-20 text-center">
                  <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm mb-3">
                    {currentPage.toUpperCase()}
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    Chưa có tài khoản {currentPage.toUpperCase()} nào
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    Giao diện {currentPage.toUpperCase()} đã sẵn sàng. Logic kết
                    nối và làm nhiệm vụ sẽ được cấu hình trong bước tiếp theo.
                  </p>
                </div>
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

      {/* Dialog Thêm tài khoản */}
      <AddFacebookAccountDialog
        isOpen={isAddFacebookOpen}
        onClose={() => setIsAddFacebookOpen(false)}
        onAddAccounts={handleAddAccounts}
        isXsmmLoggedIn={xsmmAccount.isLoggedIn}
        platform={currentPlatform}
        onXsmmLoginSuccess={handleXsmmLoginSuccess}
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
