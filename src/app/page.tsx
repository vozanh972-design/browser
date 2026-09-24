"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaDownload, FaFacebook, FaInstagram } from "react-icons/fa";
import {
  LuCircleAlert,
  LuCloud,
  LuCopy,
  LuKey,
  LuPlus,
  LuRefreshCw,
  LuShieldCheck,
  LuTrash2,
} from "react-icons/lu";
import { AboutDialog } from "@/components/about-dialog";
import { AccountDetailDialog } from "@/components/account-detail-dialog";
import { AddFacebookAccountDialog } from "@/components/add-facebook-account-dialog";
import { AppHeader } from "@/components/app-header";
import { AppSettingsDialog } from "@/components/app-settings-dialog";
import { type AppPage, RailNav } from "@/components/rail-nav";
import { ShortcutsPage } from "@/components/shortcuts-page";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { XsmmLoginDialog } from "@/components/xsmm-login-dialog";
import {
  checkCookieLive,
  checkUidLive,
  facebookLogin,
  fetchAccountDetailsWithToken,
  getTokenAndInfoFromCookie,
} from "@/lib/facebook-api";
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
  token?: string;
  avatar?: string;
  cover?: string;
  mail?: string;
  tag?: string;
  note?: string;
  proxy?: string;
  platform?: "facebook" | "instagram";
  status: "live" | "checkpoint" | "unverified";
  rawText: string;
}

function AccountAvatar({
  url,
  isInstagram,
}: {
  url?: string;
  isInstagram?: boolean;
}) {
  const [error, setError] = useState(false);

  return (
    <div className="relative size-7 rounded-full overflow-hidden bg-muted/60 shrink-0 border border-border/70 flex items-center justify-center shadow-2xs">
      {!error && url ? (
        // biome-ignore lint/performance/noImgElement: dynamic external avatar URL
        <img
          src={url}
          alt=""
          className="size-full object-cover"
          onError={() => setError(true)}
        />
      ) : isInstagram ? (
        <FaInstagram className="size-4 text-[#E1306C]" />
      ) : (
        <FaFacebook className="size-4 text-[#1877F2]" />
      )}
    </div>
  );
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
  const [accounts, setAccounts] = useState<FacebookAccount[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("autolunex_facebook_accounts_v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPlatform, setCurrentPlatform] = useState<
    "facebook" | "instagram"
  >("facebook");

  // Tự động lưu danh sách tài khoản vào localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        "autolunex_facebook_accounts_v1",
        JSON.stringify(accounts),
      );
    } catch {
      // ignore storage error
    }
  }, [accounts]);

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

  const [detailAccount, setDetailAccount] = useState<FacebookAccount | null>(
    null,
  );
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [checkingIds, setCheckingIds] = useState<string[]>([]);

  const handleCheckAccount = async (targetAccount: FacebookAccount) => {
    if (targetAccount.platform === "instagram") {
      return;
    }

    setCheckingIds((prev) => [...prev, targetAccount.id]);
    try {
      const proxyParam =
        targetAccount.proxy && targetAccount.proxy !== "Chưa chọn"
          ? targetAccount.proxy
          : undefined;

      let isLive = false;
      let fetchedUid = targetAccount.uid;
      let fetchedName = targetAccount.name;
      let fetchedAvatar = targetAccount.avatar;
      let fetchedCover = targetAccount.cover;
      let fetchedMail = targetAccount.mail;
      let fetchedToken = targetAccount.token;
      let fetchedCookie = targetAccount.cookie;

      // 1. Kiểm tra UID công khai (chuẩn xác 100% như các tool check UID)
      if (fetchedUid && /^\d+$/.test(fetchedUid.trim())) {
        const uidStatus = await checkUidLive(fetchedUid, proxyParam);
        if (uidStatus.isLive) {
          isLive = true;
          if (uidStatus.avatarUrl && !fetchedAvatar) {
            fetchedAvatar = uidStatus.avatarUrl;
          }
        }
      }

      // 2. Nếu có Token, lấy full chi tiết (avatar HD, cover, email, name, uid)
      if (fetchedToken) {
        const info = await fetchAccountDetailsWithToken(
          fetchedToken,
          proxyParam,
        );
        if (info.isLive) {
          isLive = true;
          if (info.uid && (!fetchedUid || !/^\d+$/.test(fetchedUid))) {
            fetchedUid = info.uid;
          }
          if (info.name) fetchedName = info.name;
          if (info.avatar) fetchedAvatar = info.avatar;
          if (info.cover) fetchedCover = info.cover;
          if (info.email) fetchedMail = info.email;
        }
      }

      // 3. Nếu chưa có Token nhưng có UID & Mật khẩu (và 2FA), thực hiện đăng nhập qua API b-graph
      if (!fetchedToken && fetchedUid && targetAccount.pass) {
        const loginRes = await facebookLogin({
          email: fetchedUid,
          password: targetAccount.pass,
          auth2fa: targetAccount.twoFactor,
          cookie: fetchedCookie,
          proxy: proxyParam,
        });
        if (loginRes.success && loginRes.token) {
          isLive = true;
          fetchedToken = loginRes.token;
          if (loginRes.cookie) fetchedCookie = loginRes.cookie;
          if (loginRes.uid && (!fetchedUid || !/^\d+$/.test(fetchedUid))) {
            fetchedUid = loginRes.uid;
          }
          // Lấy tiếp avatar HD & cover từ token vừa đăng nhập
          try {
            const tokenDetails = await fetchAccountDetailsWithToken(
              loginRes.token,
              proxyParam,
            );
            if (tokenDetails.isLive) {
              if (tokenDetails.name) fetchedName = tokenDetails.name;
              if (tokenDetails.avatar) fetchedAvatar = tokenDetails.avatar;
              if (tokenDetails.cover) fetchedCover = tokenDetails.cover;
              if (tokenDetails.email) fetchedMail = tokenDetails.email;
            }
          } catch {
            // ignore
          }
        }
      }

      // 4. Nếu có Cookie, kiểm tra Cookie Live
      if (fetchedCookie) {
        const cookieCheck = await checkCookieLive(fetchedCookie, proxyParam);
        if (cookieCheck.isLive) {
          isLive = true;
          if (cookieCheck.name && !fetchedName) fetchedName = cookieCheck.name;
          if (cookieCheck.uid && (!fetchedUid || !/^\d+$/.test(fetchedUid))) {
            fetchedUid = cookieCheck.uid;
          }
        }
      }

      const updated = {
        uid: fetchedUid,
        name: fetchedName,
        avatar: fetchedAvatar,
        cover: fetchedCover,
        mail: fetchedMail,
        token: fetchedToken,
        cookie: fetchedCookie,
        status: (isLive ? "live" : "checkpoint") as "live" | "checkpoint",
      };

      setAccounts((prev) =>
        prev.map((item) =>
          item.id === targetAccount.id ? { ...item, ...updated } : item,
        ),
      );
      setDetailAccount((prev) =>
        prev && prev.id === targetAccount.id ? { ...prev, ...updated } : prev,
      );
    } catch {
      // ignore
    } finally {
      setCheckingIds((prev) => prev.filter((id) => id !== targetAccount.id));
    }
  };

  const handleAddAccounts = (lines: string[], format: string) => {
    const formatKeys = format.split("|").map((f) => f.trim().toLowerCase());
    const newAccounts: FacebookAccount[] = lines.map((line, idx) => {
      const parts = line.split("|").map((p) => p.trim());
      const account: FacebookAccount = {
        id: `${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        uid: parts[0] || `acc_${idx + 1}`,
        tag: "Không có thẻ",
        note: "Không có ghi chú",
        proxy: "Chưa chọn",
        platform: currentPlatform,
        status: "unverified",
        rawText: line,
      };

      if (formatKeys.length > 0 && format) {
        formatKeys.forEach((key, kIdx) => {
          const val = parts[kIdx];
          if (!val) return;
          if (key.includes("uid")) {
            if (val.startsWith("EAA")) {
              account.token = val;
            } else {
              account.uid = val;
            }
          } else if (key.includes("mật khẩu") || key.includes("pass")) {
            account.pass = val;
          } else if (key.includes("2fa")) {
            if (
              val.includes("datr=") ||
              val.includes("c_user=") ||
              val.includes("xs=")
            ) {
              account.cookie = val;
            } else {
              account.twoFactor = val;
            }
          } else if (key.includes("cookie")) {
            account.cookie = val;
          } else if (key.includes("token")) {
            account.token = val;
          } else if (key.includes("proxy")) {
            account.proxy = val;
          }
        });
      } else {
        if (line.includes("c_user=") || line.includes("xs=")) {
          account.cookie = line;
          const match = line.match(/c_user=([^;]+)/);
          if (match) account.uid = match[1];
        } else if (line.startsWith("EAA")) {
          account.token = line;
        } else if (parts.length >= 2) {
          account.uid = parts[0];
          account.pass = parts[1];
          if (parts[2]) {
            if (
              parts[2].includes("datr=") ||
              parts[2].includes("c_user=") ||
              parts[2].includes("xs=")
            ) {
              account.cookie = parts[2];
            } else {
              account.twoFactor = parts[2];
            }
          }
          if (parts[3]) account.cookie = parts[3];
          if (parts[4]) account.token = parts[4];
          if (parts[5]) account.proxy = parts[5];
        }
      }

      if (account.cookie?.includes("c_user=")) {
        const match = account.cookie.match(/c_user=([^;]+)/);
        if (match && (!account.uid || account.uid.startsWith("acc_"))) {
          account.uid = match[1];
        }
      }

      // Nhận diện nếu ô UID đang chứa token EAAAA
      if (account.uid?.startsWith("EAA")) {
        account.token = account.uid;
        account.uid = `acc_${idx + 1}`;
      }

      return account;
    });

    setAccounts((prev) => [...newAccounts, ...prev]);
    showSuccessToast(
      `Đã thêm ${newAccounts.length} tài khoản ${currentPlatform === "instagram" ? "Instagram" : "Facebook"}! Đang kiểm tra thông tin...`,
    );

    if (currentPlatform === "facebook") {
      newAccounts.forEach((acc) => {
        void handleCheckAccount(acc);
      });
    }
  };

  const handleDeleteAccount = (id: string) => {
    setAccounts((prev) => {
      const updated = prev.filter((a) => a.id !== id);
      try {
        localStorage.setItem(
          "autolunex_facebook_accounts_v1",
          JSON.stringify(updated),
        );
      } catch {
        // ignore
      }
      return updated;
    });
    setSelectedIds((prev) => prev.filter((i) => i !== id));
    showSuccessToast("Đã xóa vĩnh viễn tài khoản!");
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
              {/* Toolbar thao tác hàng loạt khi có tài khoản được chọn */}
              {selectedIds.length > 0 && (
                <div className="mb-2.5 flex items-center justify-between px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs">
                  <div className="font-medium text-foreground">
                    Đã chọn{" "}
                    <span className="font-bold text-primary">
                      {selectedIds.length}
                    </span>{" "}
                    tài khoản
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const toCheck = filteredAccounts.filter((a) =>
                          selectedIds.includes(a.id),
                        );
                        toCheck.forEach((acc) => void handleCheckAccount(acc));
                      }}
                      className="h-7 text-[11px] gap-1 cursor-pointer"
                    >
                      <LuRefreshCw className="size-3" />
                      <span>Kiểm tra lại ({selectedIds.length})</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setAccounts((prev) => {
                          const updated = prev.filter(
                            (a) => !selectedIds.includes(a.id),
                          );
                          try {
                            localStorage.setItem(
                              "autolunex_facebook_accounts_v1",
                              JSON.stringify(updated),
                            );
                          } catch {
                            // ignore
                          }
                          return updated;
                        });
                        setSelectedIds([]);
                        showSuccessToast(
                          `Đã xóa vĩnh viễn ${selectedIds.length} tài khoản!`,
                        );
                      }}
                      className="h-7 text-[11px] gap-1 cursor-pointer"
                    >
                      <LuTrash2 className="size-3" />
                      <span>Xóa vĩnh viễn</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* Table View matching Image 2 */}
              <div className="flex flex-1 flex-col rounded-lg border border-border/60 bg-background overflow-hidden shadow-xs">
                {/* Table Header */}
                <div className="grid grid-cols-[40px_2.8fr_1.2fr_1.5fr_1.2fr_1.5fr_110px] items-center px-3 py-2.5 text-xs font-semibold text-muted-foreground border-b border-border/60 bg-background select-none">
                  <div className="flex items-center justify-center">
                    <Checkbox
                      checked={
                        filteredAccounts.length > 0 &&
                        selectedIds.length === filteredAccounts.length
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </div>
                  <div className="flex items-center gap-1 hover:text-foreground cursor-pointer">
                    <span>Tên & UID</span>
                    <span className="text-[10px]">▲</span>
                  </div>
                  <div>TIỆN ÍCH</div>
                  <div>Proxy / VPN</div>
                  <div>TRẠNG THÁI</div>
                  <div>HÀNH ĐỘNG</div>
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
                    {filteredAccounts.map((acc) => {
                      const isChecking = checkingIds.includes(acc.id);
                      const isSelected = selectedIds.includes(acc.id);
                      const avatarSrc =
                        acc.avatar ||
                        (acc.uid && !acc.uid.startsWith("acc_")
                          ? `https://graph.facebook.com/${acc.uid}/picture?type=large`
                          : undefined);

                      return (
                        <div
                          key={acc.id}
                          role="row"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleSelectOne(acc.id);
                            }
                          }}
                          onClick={(e) => {
                            const target = e.target as HTMLElement;
                            if (
                              target.closest("button") ||
                              target.closest("[role='checkbox']")
                            ) {
                              return;
                            }
                            toggleSelectOne(acc.id);
                          }}
                          className={cn(
                            "grid grid-cols-[40px_2.8fr_1.2fr_1.5fr_1.2fr_1.5fr_110px] items-center px-3 py-2 text-xs text-foreground cursor-pointer transition-colors select-none outline-none focus-visible:bg-muted/50",
                            isSelected
                              ? "bg-primary/10 border-l-2 border-primary"
                              : "hover:bg-muted/30",
                          )}
                        >
                          {/* Checkbox */}
                          <div className="flex items-center justify-center">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelectOne(acc.id)}
                            />
                          </div>

                          {/* Tên & UID với Avatar Thật */}
                          <div className="flex items-center gap-2.5 truncate pr-2">
                            <AccountAvatar
                              url={avatarSrc}
                              isInstagram={acc.platform === "instagram"}
                            />
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-foreground truncate">
                                {acc.name || acc.uid}
                              </span>
                              {acc.name && acc.name !== acc.uid && (
                                <span className="text-[10.5px] font-mono text-muted-foreground truncate">
                                  {acc.uid}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* TIỆN ÍCH */}
                          <div className="text-muted-foreground truncate pr-2 flex items-center gap-1.5">
                            {acc.token ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (acc.token) handleCopy(acc.token);
                                }}
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-500 border border-blue-500/20 hover:bg-blue-500/20 cursor-pointer"
                                title="Click để copy Token"
                              >
                                Token
                              </button>
                            ) : null}
                            {acc.twoFactor ? (
                              <span className="text-[11px] font-mono">2FA</span>
                            ) : null}
                            {!acc.token && !acc.twoFactor && (
                              <span>Mặc định</span>
                            )}
                          </div>

                          {/* Proxy / VPN */}
                          <div className="text-muted-foreground truncate pr-2 font-mono text-[11px]">
                            {acc.proxy || "Chưa chọn"}
                          </div>

                          {/* TRẠNG THÁI */}
                          <div>
                            {isChecking ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-muted text-muted-foreground">
                                <LuRefreshCw className="size-2.5 animate-spin" />
                                Đang kiểm tra
                              </span>
                            ) : acc.status === "live" ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                Live
                              </span>
                            ) : acc.status === "checkpoint" ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                Checkpoint
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                Chưa kiểm tra
                              </span>
                            )}
                          </div>

                          {/* HÀNH ĐỘNG */}
                          <div className="text-muted-foreground truncate pr-2 font-medium">
                            {acc.note && acc.note !== "Không có ghi chú"
                              ? acc.note
                              : "Sẵn sàng"}
                          </div>

                          {/* Thao tác */}
                          <div className="flex items-center justify-end gap-1 pr-1">
                            {/* Nút chấm than: Xem toàn bộ thông tin tài khoản */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailAccount(acc);
                                setIsDetailOpen(true);
                              }}
                              title="Xem toàn bộ thông tin tài khoản"
                              className="p-1 text-primary hover:bg-primary/10 rounded transition-colors cursor-pointer"
                            >
                              <LuCircleAlert className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleCheckAccount(acc);
                              }}
                              disabled={isChecking}
                              title="Kiểm tra trạng thái & lấy thông tin"
                              className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors cursor-pointer"
                            >
                              <LuRefreshCw
                                className={cn(
                                  "size-3.5",
                                  isChecking && "animate-spin text-primary",
                                )}
                              />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(acc.rawText);
                              }}
                              title="Sao chép toàn bộ"
                              className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors cursor-pointer"
                            >
                              <LuCopy className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteAccount(acc.id);
                              }}
                              title="Xóa tài khoản"
                              className="p-1 text-muted-foreground hover:text-destructive rounded transition-colors cursor-pointer"
                            >
                              <LuTrash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
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

      {/* Account Detail Dialog */}
      <AccountDetailDialog
        account={detailAccount}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setDetailAccount(null);
        }}
        onRecheck={(acc) => void handleCheckAccount(acc as FacebookAccount)}
        isChecking={
          detailAccount ? checkingIds.includes(detailAccount.id) : false
        }
      />
    </div>
  );
}
