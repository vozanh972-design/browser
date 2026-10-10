"use client";

import {
  CircleAlert,
  Flag,
  Key,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  Trash2,
  Users,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaFacebook, FaInstagram } from "react-icons/fa";
import { AboutDialog } from "@/components/about-dialog";
import { AccountDetailDialog } from "@/components/account-detail-dialog";
import { AddFacebookAccountDialog } from "@/components/add-facebook-account-dialog";
import { AppHeader } from "@/components/app-header";
import { AppSettingsDialog } from "@/components/app-settings-dialog";
import { ForceUpdateModal } from "@/components/force-update-modal";
import { KeyLoginScreen } from "@/components/key-login-screen";
import { type AppPage, RailNav } from "@/components/rail-nav";
import { RegPageView } from "@/components/reg-page-view";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { UtilitiesDialog } from "@/components/utilities-dialog";
import { XsmmJobConfigDialog } from "@/components/xsmm-job-config-dialog";
import { XsmmLoginDialog } from "@/components/xsmm-login-dialog";
import { GolikeLoginDialog } from "@/components/golike-login-dialog";
import { clearGolikeSession, loadGolikeSession, syncGolikeSessionFromBridge } from "@/lib/golike-session";
import {
  checkFacebookAccountFull,
  checkLiveApi,
  checkUidLiveGraph,
  type FacebookPageItem,
} from "@/lib/facebook-api";
import { checkCookieIg, fetchIgUserInfo } from "@/lib/instagram-api";
import { MOTION_EASE_OUT } from "@/lib/motion";
import { showSuccessToast } from "@/lib/toast-utils";
import { cn } from "@/lib/utils";
import {
  type AppVersionCheckResult,
  checkAppVersion,
} from "@/lib/version-checker";
import { getXsmmUser } from "@/lib/xsmm-api";
import { type AccountRunState, xsmmRunner } from "@/lib/xsmm-runner";

export interface FacebookAccount {
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
  status: "live" | "checkpoint" | "die" | "unverified";
  isLive?: boolean;
  rawText: string;
  pages?: FacebookPageItem[];
}

function AccountAvatar({
  url,
  isInstagram,
}: {
  url?: string;
  isInstagram?: boolean;
}) {
  const [errorUrl, setErrorUrl] = useState<string | null>(null);
  const hasError = !url || errorUrl === url;

  return (
    <div className="relative size-7 rounded-full overflow-hidden bg-muted/60 shrink-0 border border-border/70 flex items-center justify-center shadow-2xs">
      {!hasError ? (
        // biome-ignore lint/performance/noImgElement: dynamic external avatar URL
        <img
          src={url}
          alt=""
          className="size-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setErrorUrl(url)}
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
  const { t, i18n } = useTranslation();
  const isVi = (i18n.language?.split("-")[0] || "vi") === "vi";
  const tr = (vi: string, en: string) => (isVi ? vi : en);
  // License: always start locked, recheck saved key silently on mount
  const [savedLicenseKey, setSavedLicenseKey] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("app_license_key") ?? "";
  });
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  // License info shown in settings (key + expiry + buyer) — populated after successful verify
  const [licenseInfo, setLicenseInfo] = useState<{
    key: string;
    daysLeft: number | null;
    expiredAt: string | null;
    buyer: string | null;
  }>(() => {
    if (typeof window === "undefined")
      return { key: "", daysLeft: null, expiredAt: null, buyer: null };
    return {
      key: localStorage.getItem("app_license_key") ?? "",
      daysLeft: (() => {
        const v = localStorage.getItem("app_license_days_left");
        return v ? Number(v) : null;
      })(),
      expiredAt: localStorage.getItem("app_license_expired_at"),
      buyer: localStorage.getItem("app_license_buyer"),
    };
  });
  const [currentPage, setCurrentPage] = useState<AppPage>("profiles");
  const [aboutDialogOpen, setAboutDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [updateResult, setUpdateResult] =
    useState<AppVersionCheckResult | null>(null);
  const [isAddFacebookOpen, setIsAddFacebookOpen] = useState(false);
  const [isXsmmLoginOpen, setIsXsmmLoginOpen] = useState(false);
  const [isGolikeLoginOpen, setIsGolikeLoginOpen] = useState(false);
  const [isUtilitiesChoiceOpen, setIsUtilitiesChoiceOpen] = useState(false);
  const [xsmmAccount, setXsmmAccount] = useState<{
    username: string;
    balance: string;
    token: string;
    isLoggedIn: boolean;
  }>(() => {
    if (typeof window === "undefined") {
      return { username: "", balance: "", token: "", isLoggedIn: false };
    }
    const token = localStorage.getItem("xsmm_token") || "";
    const username = localStorage.getItem("xsmm_username") || "";
    const balance = localStorage.getItem("xsmm_balance") || "";
    return {
      username,
      balance,
      token,
      isLoggedIn: !!token,
    };
  });
  const [golikeAccount, setGolikeAccount] = useState<{
    username: string;
    balance: string;
    token: string;
    isLoggedIn: boolean;
  }>(() => {
    if (typeof window === "undefined") {
      return { username: "", balance: "", token: "", isLoggedIn: false };
    }
    const session = loadGolikeSession();
    const token = session?.golike_token || localStorage.getItem("golike_token") || "";
    const username = session?.golike_username || localStorage.getItem("golike_username") || "";
    const balance = localStorage.getItem("golike_balance") || "";
    return {
      username,
      balance,
      token,
      isLoggedIn: !!token,
    };
  });
  const [accounts, setAccounts] = useState<FacebookAccount[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("autolunex_facebook_accounts_v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((acc: FacebookAccount) => {
            const cleanAcc = { ...acc };
            // TUYỆT ĐỐI KHÔNG hardcode isLive = true/false lúc khởi tạo tài khoản nếu chưa được xác thực API
            if (cleanAcc.isLive === undefined) {
              if (cleanAcc.status === "live") {
                cleanAcc.status = "unverified";
              }
            }
            // Tự động phân tách lại pass và uid nếu rawText có dấu | mà pass đang rỗng
            if (!cleanAcc.pass && cleanAcc.rawText && cleanAcc.rawText.includes("|")) {
              const p = cleanAcc.rawText.split("|").map((s) => s.trim());
              if (p.length >= 2) {
                if (!cleanAcc.uid || cleanAcc.uid.startsWith("acc_")) cleanAcc.uid = p[0];
                cleanAcc.pass = p[1];
                for (let i = 2; i < p.length; i++) {
                  if (p[i].includes("c_user=") || p[i].includes("xs=")) cleanAcc.cookie = p[i];
                  else if (p[i].startsWith("EAA")) cleanAcc.token = p[i];
                  else if (!cleanAcc.twoFactor && p[i].length >= 6 && !p[i].includes(":")) cleanAcc.twoFactor = p[i];
                }
              }
            }
            // Tự động chuẩn hóa nếu tài khoản cũ bị lưu nhầm chuỗi cookie vào UID hoặc Name
            if (
              cleanAcc.uid &&
              (cleanAcc.uid.includes(";") ||
                cleanAcc.uid.includes("=") ||
                cleanAcc.uid.includes("ds_user_id="))
            ) {
              const fullCookie =
                cleanAcc.cookie || cleanAcc.rawText || cleanAcc.uid;
              cleanAcc.cookie = fullCookie;
              cleanAcc.platform = "instagram";
              const dsMatch = fullCookie.match(/ds_user_id=(\d+)/);
              if (dsMatch) {
                cleanAcc.uid = dsMatch[1];
                cleanAcc.name = "";
              } else {
                cleanAcc.uid = `acc_ig_${cleanAcc.id.slice(-6)}`;
                cleanAcc.name = "";
              }
            }
            if (
              cleanAcc.name &&
              (cleanAcc.name.includes(";") || cleanAcc.name.includes("="))
            ) {
              cleanAcc.name = "";
            }
            // Nếu là Instagram và name là UID số hoặc @UID số thì xóa để tự động phân giải lại
            if (
              cleanAcc.platform === "instagram" &&
              cleanAcc.name &&
              (/^\d+$/.test(cleanAcc.name.replace(/^@/, "")) ||
                cleanAcc.name === cleanAcc.uid)
            ) {
              cleanAcc.name = "";
            }
            return cleanAcc;
          });
        }
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

  // Tự động đồng bộ tài khoản GoLike từ bridge/LevelDB khi mở app
  useEffect(() => {
    let isMounted = true;
    syncGolikeSessionFromBridge().then((res) => {
      if (isMounted && res?.success && res.user) {
        setGolikeAccount({
          username: res.user.username,
          balance: res.user.balance,
          token: res.user.token,
          isLoggedIn: true,
        });
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Tự động kiểm tra phiên bản ứng dụng ngầm định kỳ
  useEffect(() => {
    let isMounted = true;
    const runCheck = async () => {
      try {
        const res = await checkAppVersion();
        if (isMounted) {
          if (res.isOutdated) {
            setUpdateResult(res);
          } else {
            setUpdateResult(null);
          }
        }
      } catch (e) {
        console.error("Failed to check app version:", e);
      }
    };

    void runCheck();
    // 15 phút kiểm tra ngầm định kỳ 1 lần
    const interval = setInterval(
      () => {
        void runCheck();
      },
      15 * 60 * 1000,
    );

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const [runnerStates, setRunnerStates] = useState<
    Map<string, AccountRunState>
  >(new Map());

  // Đăng ký nhận cập nhật trạng thái tác vụ từ XSMM Task Runner
  useEffect(() => {
    const unsub = xsmmRunner.subscribe((states) => {
      setRunnerStates(new Map(states));
    });
    xsmmRunner.setOnPointsEarned((pts) => {
      setXsmmAccount((prev) => {
        const curPts = Number.parseInt(
          prev.balance.replace(/\D/g, "") || "0",
          10,
        );
        const newPts = curPts + pts;
        const newBalance = `${newPts.toLocaleString("vi-VN")} xu`;
        try {
          localStorage.setItem("xsmm_balance", newBalance);
        } catch {
          // ignore
        }
        return {
          ...prev,
          balance: newBalance,
        };
      });
    });
    return () => unsub();
  }, []);

  // Khôi phục phiên đăng nhập XSMM nếu đã lưu token
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem("xsmm_token");
      if (savedToken) {
        void getXsmmUser(savedToken).then((res) => {
          if (res.success && res.user) {
            const formattedBalance = `${res.user.points.toLocaleString("vi-VN")} xu`;
            try {
              localStorage.setItem("xsmm_username", res.user.username);
              localStorage.setItem("xsmm_balance", formattedBalance);
            } catch {
              // ignore
            }
            setXsmmAccount({
              username: res.user.username,
              balance: formattedBalance,
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
    try {
      localStorage.setItem("xsmm_token", user.token);
      localStorage.setItem("xsmm_username", user.username);
      localStorage.setItem("xsmm_balance", user.balance);
    } catch {
      // ignore
    }
    setXsmmAccount({
      ...user,
      isLoggedIn: true,
    });
    showSuccessToast(`Đăng nhập XSMM thành công! Chào mừng ${user.username}`);
  };

  const handleXsmmLogout = () => {
    try {
      localStorage.removeItem("xsmm_token");
      localStorage.removeItem("xsmm_username");
      localStorage.removeItem("xsmm_balance");
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

  const handleGolikeLoginSuccess = (user: {
    username: string;
    balance: string;
    token: string;
  }) => {
    try {
      localStorage.setItem("golike_token", user.token);
      localStorage.setItem("golike_username", user.username);
      localStorage.setItem("golike_balance", user.balance);
    } catch {
      // ignore
    }
    setGolikeAccount({
      ...user,
      isLoggedIn: true,
    });
    showSuccessToast(`Đăng nhập GoLike thành công! Chào mừng ${user.username}`);
  };

  const handleGolikeLogout = async () => {
    await clearGolikeSession(golikeAccount.token);
    setGolikeAccount({
      username: "",
      balance: "",
      token: "",
      isLoggedIn: false,
    });
    showSuccessToast(
      tr("Đã đăng xuất tài khoản GoLike thành công!", "Signed out of GoLike!"),
    );
  };

  // Đăng xuất key bản quyền ứng dụng (giữ nguyên toàn bộ tài khoản và phiên XSMM)
  const handleKeyLogout = () => {
    try {
      localStorage.removeItem("app_license_key");
      localStorage.removeItem("app_license_days_left");
      localStorage.removeItem("app_license_expired_at");
      localStorage.removeItem("app_license_buyer");
    } catch {
      // ignore
    }
    setSavedLicenseKey("");
    setLicenseInfo({ key: "", daysLeft: null, expiredAt: null, buyer: null });
    setIsUnlocked(false);
    setSettingsDialogOpen(false);
    showSuccessToast(
      tr("Đã đăng xuất Key bản quyền", "License key logged out"),
    );
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
  const [isJobConfigOpen, setIsJobConfigOpen] = useState(false);
  const [checkingIds, setCheckingIds] = useState<string[]>([]);

  // Ref để track UIDs đã được resolve — mỗi UID chỉ gọi API 1 lần, tránh loop vô tận
  // khi setAccounts() trigger lại effect này.
  const resolvedIgUidsRef = useRef<Set<string>>(new Set());

  // Tự động phân giải username thật (akg1sa6tw5nd) và avatar thật cho tài khoản Instagram
  useEffect(() => {
    const igAccountsNeedingResolution = accounts.filter(
      (a) =>
        a.platform === "instagram" &&
        (!a.name ||
          a.name === a.uid ||
          /^\d+$/.test(a.name.replace(/^@/, ""))) &&
        a.uid &&
        /^\d+$/.test(a.uid) &&
        !resolvedIgUidsRef.current.has(a.uid), // bỏ qua những uid đã xử lý rồi
    );

    if (igAccountsNeedingResolution.length === 0) return;

    // Đánh dấu ngay lập tức để các lần trigger tiếp theo bỏ qua
    for (const acc of igAccountsNeedingResolution) {
      resolvedIgUidsRef.current.add(acc.uid);
    }

    let isMounted = true;
    void (async () => {
      let hasChanges = false;
      const updates = new Map<string, { username: string; avatar?: string }>();

      for (const acc of igAccountsNeedingResolution) {
        if (!isMounted) break;
        const proxyParam =
          acc.proxy && acc.proxy !== "Chưa chọn" ? acc.proxy : undefined;
        try {
          const info = await fetchIgUserInfo(acc.uid, proxyParam);
          if (info.isLive && info.username && !/^\d+$/.test(info.username)) {
            updates.set(acc.id, {
              username: `@${info.username.replace(/^@/, "")}`,
              avatar: info.avatar,
            });
            hasChanges = true;
          }
        } catch {
          // ignore — uid vẫn giữ trong resolvedIgUidsRef, sẽ không retry vô tận
        }
      }

      if (isMounted && hasChanges) {
        setAccounts((prev) => {
          const updatedList = prev.map((item) => {
            const up = updates.get(item.id);
            if (up) {
              return {
                ...item,
                name: up.username,
                avatar: up.avatar || item.avatar,
              };
            }
            return item;
          });
          try {
            localStorage.setItem(
              "autolunex_facebook_accounts_v1",
              JSON.stringify(updatedList),
            );
          } catch {
            // ignore
          }
          return updatedList;
        });
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [accounts]);

  const handleCheckAccount = async (targetAccount: FacebookAccount) => {
    if (checkingIds.includes(targetAccount.id)) return;
    setCheckingIds((prev) => [...prev, targetAccount.id]);

    if (targetAccount.platform === "instagram") {
      try {
        const proxyParam =
          targetAccount.proxy && targetAccount.proxy !== "Chưa chọn"
            ? targetAccount.proxy
            : undefined;
        let cookie = targetAccount.cookie?.trim() || "";
        if (!cookie) {
          if (
            targetAccount.rawText?.includes("ds_user_id=") ||
            targetAccount.rawText?.includes("sessionid=")
          ) {
            cookie = targetAccount.rawText.split("|")[0].trim();
          } else if (
            targetAccount.uid?.includes("ds_user_id=") ||
            targetAccount.uid?.includes("sessionid=")
          ) {
            cookie = targetAccount.uid.split("|")[0].trim();
          }
        }

        const dsMatch = cookie.match(/ds_user_id=(\d+)/);
        const realUid = dsMatch?.[1] || targetAccount.uid;

        if (cookie) {
          const info = await checkCookieIg(cookie, proxyParam);
          let finalUsername = info.username?.replace(/^@/, "").trim() || "";
          let finalAvatar = info.avatar || targetAccount.avatar;

          // Nếu chưa có username chuẩn (hoặc bị số), tra cứu trực tiếp qua endpoint User Info chuẩn Android
          if (
            (!finalUsername || /^\d+$/.test(finalUsername)) &&
            realUid &&
            /^\d+$/.test(realUid.replace(/^@/, ""))
          ) {
            const uInfo = await fetchIgUserInfo(
              realUid.replace(/^@/, ""),
              proxyParam,
            );
            if (
              uInfo.isLive &&
              uInfo.username &&
              !/^\d+$/.test(uInfo.username)
            ) {
              finalUsername = uInfo.username.replace(/^@/, "").trim();
              if (uInfo.avatar) finalAvatar = uInfo.avatar;
            }
          }
          if (
            !finalUsername &&
            targetAccount.name &&
            !/^\d+$/.test(targetAccount.name.replace(/^@/, ""))
          ) {
            finalUsername = targetAccount.name.replace(/^@/, "").trim();
          }

          let accountStatus: "live" | "checkpoint" | "die" = "die";
          if (info.isLive) {
            accountStatus = "live";
          } else if (info.isCheckpoint) {
            accountStatus = "checkpoint";
          } else {
            accountStatus = "die";
          }

          const updated: Partial<FacebookAccount> = {
            cookie,
            status: accountStatus,
            name: finalUsername ? `@${finalUsername}` : targetAccount.name,
            uid: info.userId || realUid,
            avatar: finalAvatar,
          };
          setAccounts((prev) => {
            const updatedList = prev.map((item) =>
              item.id === targetAccount.id ? { ...item, ...updated } : item,
            );
            try {
              localStorage.setItem(
                "autolunex_facebook_accounts_v1",
                JSON.stringify(updatedList),
              );
            } catch {
              // ignore
            }
            return updatedList;
          });
          setDetailAccount((prev) =>
            prev && prev.id === targetAccount.id
              ? { ...prev, ...updated }
              : prev,
          );
        } else {
          // Tài khoản Instagram không có cookie: kiểm tra xem UID / Username có tồn tại
          const cleanId = realUid?.replace(/^@/, "").trim() || "";
          if (cleanId) {
            const uInfo = await fetchIgUserInfo(cleanId, proxyParam);
            const finalUsername =
              uInfo.username?.replace(/^@/, "").trim() ||
              targetAccount.name?.replace(/^@/, "").trim() ||
              "";
            const updated: Partial<FacebookAccount> = {
              status: uInfo.isLive ? "live" : "die",
              name: finalUsername ? `@${finalUsername}` : targetAccount.name,
              avatar: uInfo.avatar || targetAccount.avatar,
            };
            setAccounts((prev) => {
              const updatedList = prev.map((item) =>
                item.id === targetAccount.id ? { ...item, ...updated } : item,
              );
              try {
                localStorage.setItem(
                  "autolunex_facebook_accounts_v1",
                  JSON.stringify(updatedList),
                );
              } catch {
                // ignore
              }
              return updatedList;
            });
            setDetailAccount((prev) =>
              prev && prev.id === targetAccount.id
                ? { ...prev, ...updated }
                : prev,
            );
          }
        }
      } catch {
        // ignore
      } finally {
        setCheckingIds((prev) => prev.filter((id) => id !== targetAccount.id));
      }
      return;
    }
    try {
      const proxyParam =
        targetAccount.proxy && targetAccount.proxy !== "Chưa chọn"
          ? targetAccount.proxy
          : undefined;

      // Kiểm tra tài khoản bằng checkLiveApi 100% REST / Graph API
      const result = await checkLiveApi({
        uid: targetAccount.uid,
        cookie: targetAccount.cookie,
        token: targetAccount.token,
        proxy: proxyParam,
        pass: targetAccount.pass,
        twoFactor: targetAccount.twoFactor,
      });

      if (result.isNetworkError) {
        // Nếu request bị Timeout / Lỗi Proxy mạng: Giữ nguyên trạng thái, báo "Lỗi kết nối", KHÔNG đánh dấu là Die.
        return;
      }

      const isLive = result.isLive;
      const updated: Partial<FacebookAccount> = {
        isLive,
        status: isLive ? "live" : "die",
        token: result.token || targetAccount.token,
        cookie: result.cookie || targetAccount.cookie,
        uid: result.uid || targetAccount.uid,
        name: result.name || targetAccount.name,
        avatar: isLive ? (result.avatar || targetAccount.avatar) : undefined,
        cover: isLive ? targetAccount.cover : undefined,
        pages: isLive ? (result.pages || targetAccount.pages) : undefined,
        note: isLive
          ? targetAccount.note || "Sẵn sàng"
          : (result.error || "Đã Die"),
      };

      setAccounts((prev) => {
        const updatedList = prev.map((item) =>
          item.id === targetAccount.id ? { ...item, ...updated } : item,
        );
        try {
          localStorage.setItem(
            "autolunex_facebook_accounts_v1",
            JSON.stringify(updatedList),
          );
        } catch {
          // ignore
        }
        return updatedList;
      });
      setDetailAccount((prev) =>
        prev && prev.id === targetAccount.id ? { ...prev, ...updated } : prev,
      );
    } catch {
      // ignore
    } finally {
      setCheckingIds((prev) => prev.filter((id) => id !== targetAccount.id));
    }
  };

  // Tự động kiểm tra các tài khoản chưa được xác thực API khi khởi động ứng dụng
  useEffect(() => {
    const unverified = accounts.filter((a) => a.isLive === undefined);
    if (unverified.length === 0) return;

    void (async () => {
      for (const acc of unverified) {
        await handleCheckAccount(acc);
        await new Promise((r) => setTimeout(r, 600));
      }
    })();
  }, []);

  const handleCheckPage = async (
    targetAccount: FacebookAccount,
    targetPage: FacebookPageItem,
  ) => {
    const pageKey = `page_${targetAccount.id}_${targetPage.pageId}`;
    if (checkingIds.includes(pageKey)) return;
    setCheckingIds((prev) => [...prev, pageKey]);

    const pageUid = targetPage.additionalProfileId || targetPage.pageId;
    try {
      const res = await checkUidLiveGraph(
        pageUid,
        targetAccount.proxy && targetAccount.proxy !== "Chưa chọn"
          ? targetAccount.proxy
          : undefined,
      );

      showSuccessToast(
        res.isLive
          ? tr(
              `Page [${targetPage.pageName}] đang Hoạt động (Live)!`,
              `Page [${targetPage.pageName}] is Live!`,
            )
          : tr(
              `Page [${targetPage.pageName}] không tồn tại hoặc bị lỗi!`,
              `Page [${targetPage.pageName}] does not exist or died!`,
            ),
      );

      setAccounts((prev) => {
        const updatedList = prev.map((a) => {
          if (a.id !== targetAccount.id) return a;
          return {
            ...a,
            pages: a.pages?.map((item) =>
              item.pageId === targetPage.pageId
                ? { ...item, isLive: res.isLive }
                : item,
            ),
          };
        });
        try {
          localStorage.setItem(
            "autolunex_facebook_accounts_v1",
            JSON.stringify(updatedList),
          );
        } catch {
          // ignore
        }
        return updatedList;
      });
    } catch {
      // ignore
    } finally {
      setCheckingIds((prev) => prev.filter((id) => id !== pageKey));
    }
  };

  const handleUpdateAccountPages = (
    uid: string,
    newPages: FacebookPageItem[],
  ) => {
    setAccounts((prev) => {
      const updated = prev.map((a) => {
        if (a.uid === uid || a.id === uid) {
          return { ...a, pages: newPages };
        }
        return a;
      });
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
  };

  const handleAddAccounts = (lines: string[], format: string) => {
    const formatKeys = format.split("|").map((f) => f.trim().toLowerCase());
    const newAccounts: FacebookAccount[] = lines.map((line, idx) => {
      // 1. Tự động nhận diện tài khoản Instagram (từ tab Instagram hoặc chuỗi cookie có ds_user_id/sessionid/csrftoken)
      const isIg =
        currentPlatform === "instagram" ||
        line.includes("ds_user_id=") ||
        line.includes("sessionid=") ||
        line.includes("csrftoken=");

      if (isIg) {
        let rawCookie = line.trim();
        let proxyStr = "Chưa chọn";
        if (line.includes("|")) {
          const lastPipeIndex = line.lastIndexOf("|");
          rawCookie = line.substring(0, lastPipeIndex).trim();
          proxyStr = line.substring(lastPipeIndex + 1).trim() || "Chưa chọn";
        }
        const dsMatch = rawCookie.match(/ds_user_id=(\d+)/);
        const uid = dsMatch ? dsMatch[1] : `acc_ig_${Date.now()}_${idx + 1}`;
        const account: FacebookAccount = {
          id: `${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          uid,
          name: "",
          cookie: rawCookie,
          tag: "Không có thẻ",
          note: "Sẵn sàng",
          proxy: proxyStr,
          platform: "instagram",
          status: "unverified",
          rawText: line,
        };
        return account;
      }

      // 2. Nhận diện tài khoản Facebook
      const parts = line.split("|").map((p) => p.trim());
      const account: FacebookAccount = {
        id: `${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        uid: parts[0] || `acc_${idx + 1}`,
        tag: "Không có thẻ",
        note: "Sẵn sàng",
        proxy: "Chưa chọn",
        platform: "facebook",
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
        if (parts.length >= 2) {
          account.uid = parts[0];
          account.pass = parts[1];
          for (let pIdx = 2; pIdx < parts.length; pIdx++) {
            const p = parts[pIdx];
            if (p.includes("c_user=") || p.includes("xs=")) {
              account.cookie = p;
            } else if (p.startsWith("EAA")) {
              account.token = p;
            } else if (p.includes(":") && !p.startsWith("http")) {
              account.proxy = p;
            } else if (!account.twoFactor && p.length >= 6) {
              account.twoFactor = p;
            }
          }
        } else if (line.includes("c_user=") || line.includes("xs=")) {
          account.cookie = line;
          const match = line.match(/c_user=([^;]+)/);
          if (match) account.uid = match[1];
        } else if (line.startsWith("EAA")) {
          account.token = line;
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

    setAccounts((prev) => {
      const merged = [...newAccounts, ...prev];
      try {
        localStorage.setItem(
          "autolunex_facebook_accounts_v1",
          JSON.stringify(merged),
        );
      } catch {
        // ignore
      }
      return merged;
    });
    showSuccessToast(
      `Đã thêm ${newAccounts.length} tài khoản ${currentPlatform === "instagram" ? "Instagram" : "Facebook"}!`,
    );

    // Tự động kiểm tra tài khoản ngầm tuần tự cho cả Facebook và Instagram
    void (async () => {
      for (const acc of newAccounts) {
        await handleCheckAccount(acc);
        const safeDelay = 1200 + Math.floor(Math.random() * 800);
        await new Promise((r) => setTimeout(r, safeDelay));
      }
    })();
  };

  const handleRunAccount = (acc: FacebookAccount) => {
    if (currentPage === "gl") {
      showSuccessToast(
        tr(
          "Tính năng chạy nhiệm vụ GoLike đang được phát triển!",
          "GoLike job automation is under development!",
        ),
      );
      return;
    }
    if (acc.status === "checkpoint" || acc.status === "die") {
      showSuccessToast(
        tr(
          `Tài khoản ${acc.name || acc.uid} đang bị ${acc.status === "checkpoint" ? "Checkpoint" : "Die"}, không thể chạy!`,
          `Account ${acc.name || acc.uid} is ${acc.status === "checkpoint" ? "Checkpoint" : "Die"}, cannot run!`,
        ),
      );
      return;
    }

    const savedToken =
      xsmmAccount.token || localStorage.getItem("xsmm_token") || "";
    if (!savedToken) {
      setIsXsmmLoginOpen(true);
      showSuccessToast(
        tr(
          "Vui lòng đăng nhập tài khoản XSMM trước khi chạy nhiệm vụ!",
          "Please log in to XSMM account before running tasks!",
        ),
      );
      return;
    }

    if (xsmmRunner.isRunning(acc.id)) {
      xsmmRunner.stopAccount(acc.id);
      showSuccessToast(
        tr(
          `Đã dừng chạy tài khoản: ${acc.name || acc.uid}`,
          `Stopped running account: ${acc.name || acc.uid}`,
        ),
      );
    } else {
      xsmmRunner.startAccount(acc, savedToken);
      showSuccessToast(
        tr(
          `Bắt đầu chạy nhiệm vụ XSMM: ${acc.name || acc.uid}`,
          `Started running XSMM tasks: ${acc.name || acc.uid}`,
        ),
      );
    }
  };

  const handleRunPage = (acc: FacebookAccount, p: FacebookPageItem) => {
    if (currentPage === "gl") {
      showSuccessToast(
        tr(
          "Tính năng chạy nhiệm vụ GoLike đang được phát triển!",
          "GoLike job automation is under development!",
        ),
      );
      return;
    }
    const pageKey = `page_${acc.id}_${p.pageId}`;
    if (xsmmRunner.isRunning(pageKey)) {
      xsmmRunner.stopAccount(pageKey);
      showSuccessToast(
        tr(
          `Đã dừng chạy Page: ${p.pageName}`,
          `Stopped running page: ${p.pageName}`,
        ),
      );
      return;
    }

    const savedToken =
      xsmmAccount.token || localStorage.getItem("xsmm_token") || "";
    if (!savedToken) {
      setIsXsmmLoginOpen(true);
      showSuccessToast(
        tr(
          "Vui lòng đăng nhập tài khoản XSMM trước khi chạy nhiệm vụ!",
          "Please log in to XSMM account before running tasks!",
        ),
      );
      return;
    }

    const pageUid615 = p.additionalProfileId || p.pageId;
    const pageVirtualAccount: FacebookAccount = {
      id: pageKey,
      uid: pageUid615,
      name: p.pageName,
      token: p.pageToken || acc.token,
      cookie: acc.cookie,
      proxy: acc.proxy,
      avatar: p.avatar,
      platform: "facebook",
      status: p.isLive === false ? "die" : "live",
      rawText: `Page: ${p.pageName} | 615: ${pageUid615}`,
    };

    xsmmRunner.startAccount(pageVirtualAccount, savedToken);
    showSuccessToast(
      tr(
        `Bắt đầu chạy Page 615: ${p.pageName} (${pageUid615})`,
        `Started running Page 615: ${p.pageName} (${pageUid615})`,
      ),
    );
  };

  const handleRunSelected = () => {
    if (selectedIds.length === 0) return;
    if (currentPage === "gl") {
      showSuccessToast(
        tr(
          "Tính năng chạy nhiệm vụ GoLike đang được phát triển!",
          "GoLike job automation is under development!",
        ),
      );
      return;
    }
    const runnableAccounts = accounts.filter(
      (a) =>
        selectedIds.includes(a.id) &&
        a.status !== "checkpoint" &&
        a.status !== "die",
    );
    const runnablePages: { acc: FacebookAccount; page: FacebookPageItem }[] =
      [];
    for (const a of accounts) {
      if (a.status === "checkpoint" || a.status === "die") continue;
      for (const p of a.pages || []) {
        if (
          selectedIds.includes(`page_${a.id}_${p.pageId}`) &&
          p.isLive !== false
        ) {
          runnablePages.push({ acc: a, page: p });
        }
      }
    }

    if (runnableAccounts.length === 0 && runnablePages.length === 0) {
      showSuccessToast(
        tr(
          "Các tài khoản/page được chọn đều bị Checkpoint/Die, không thể chạy!",
          "Selected accounts/pages are Checkpoint/Die, cannot run!",
        ),
      );
      return;
    }

    const savedToken =
      xsmmAccount.token || localStorage.getItem("xsmm_token") || "";
    if (!savedToken) {
      setIsXsmmLoginOpen(true);
      showSuccessToast(
        tr(
          "Vui lòng đăng nhập tài khoản XSMM trước khi chạy nhiệm vụ!",
          "Please log in to XSMM account before running tasks!",
        ),
      );
      return;
    }

    if (runnableAccounts.length > 0) {
      xsmmRunner.startAccounts(runnableAccounts, savedToken);
    }
    for (const { acc, page } of runnablePages) {
      handleRunPage(acc, page);
    }

    const totalRunning = runnableAccounts.length + runnablePages.length;
    showSuccessToast(
      tr(
        `Bắt đầu chạy ${totalRunning} mục hợp lệ (Profile & Page)!`,
        `Started running ${totalRunning} valid items (Profile & Page)!`,
      ),
    );
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
    showSuccessToast(
      tr("Đã xóa vĩnh viễn tài khoản!", "Account permanently deleted!"),
    );
  };

  const handleCopy = (text: string) => {
    void navigator.clipboard.writeText(text);
    showSuccessToast(tr("Đã sao chép vào bộ nhớ tạm!", "Copied to clipboard!"));
  };

  const filteredAccounts = accounts.filter(
    (a) => (a.platform || "facebook") === currentPlatform,
  );

  const getAllSelectableIds = () => {
    const ids: string[] = [];
    for (const a of filteredAccounts) {
      ids.push(a.id);
      for (const p of a.pages || []) {
        ids.push(`page_${a.id}_${p.pageId}`);
      }
    }
    return ids;
  };

  const toggleSelectAll = () => {
    const allIds = getAllSelectableIds();
    if (selectedIds.length === allIds.length && allIds.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allIds);
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
        return "";
      case "account":
        return tr("Tiện ích / Nuôi Acc", "Utilities / Account Farm");
      case "reg-page":
        return tr("Tiện ích / Reg Page", "Utilities / Reg Page");
      case "settings":
        return t("rail.settings", "Settings");
      default:
        return "";
    }
  };

  return (
    <div className="flex h-full flex-col bg-background text-foreground font-(family-name:--font-geist-sans) overflow-hidden select-none">
      {/* Key login screen — shown when not unlocked; passes savedKey for auto-recheck */}
      {!isUnlocked && (
        <KeyLoginScreen
          autoCheckKey={savedLicenseKey || undefined}
          onUnlock={(key, daysLeft, expiredAt, buyer) => {
            localStorage.setItem("app_license_key", key);
            if (daysLeft != null) {
              localStorage.setItem("app_license_days_left", String(daysLeft));
            } else {
              localStorage.removeItem("app_license_days_left");
            }
            if (expiredAt) {
              localStorage.setItem("app_license_expired_at", expiredAt);
            } else {
              localStorage.removeItem("app_license_expired_at");
            }
            if (buyer) {
              localStorage.setItem("app_license_buyer", buyer);
            } else {
              localStorage.removeItem("app_license_buyer");
            }
            setSavedLicenseKey(key);
            setLicenseInfo({ key, daysLeft, expiredAt, buyer });
            setIsUnlocked(true);
          }}
        />
      )}
      {/* Top titlebar với drag region & thông tin XSMM / GoLike */}
      <AppHeader
        activePlatform={currentPlatform}
        onPlatformChange={setCurrentPlatform}
        pageTitle={getPageTitle(currentPage)}
        showXsmm={currentPage === "profiles"}
        xsmmAccount={xsmmAccount}
        onXsmmLoginClick={() => setIsXsmmLoginOpen(true)}
        onXsmmLogoutClick={handleXsmmLogout}
        showGolike={currentPage === "gl"}
        golikeAccount={golikeAccount}
        onGolikeLoginClick={() => setIsGolikeLoginOpen(true)}
        onGolikeLogoutClick={handleGolikeLogout}
        onNewClick={() => setIsAddFacebookOpen(true)}
      />

      {/* Main content area */}
      <div className="flex min-h-0 flex-1 flex-col">
        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto px-6 py-5">
          {(currentPage === "profiles" || currentPage === "account" || currentPage === "gl") && (
            <div className="flex w-full flex-1 flex-col">
              {/* Sub-navigation switcher for Tiện ích */}
              {currentPage === "account" && (
                <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-border/40">
                  <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/30 border border-border/60">
                    <button
                      type="button"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-background text-foreground shadow-2xs border border-border/80 cursor-pointer"
                    >
                      <Users className="size-3.5 text-emerald-400 shrink-0" />
                      <span>{tr("Nuôi Acc", "Account Farm")}</span>
                      <span className="ml-1 size-1.5 rounded-full bg-emerald-500 shrink-0" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPage("reg-page")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <Flag className="size-3.5 text-indigo-400 shrink-0" />
                      <span>Reg Page</span>
                    </button>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {tr(
                      "Tiện ích nuôi & quản lý tài khoản",
                      "Account management & automation tools",
                    )}
                  </div>
                </div>
              )}

              {/* Toolbar thao tác hàng loạt khi có tài khoản được chọn */}
              {selectedIds.length > 0 && (
                <div className="mb-2.5 flex items-center justify-between px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs">
                  <div className="font-medium text-foreground">
                    {tr("Đã chọn ", "Selected ")}
                    <span className="font-bold text-primary">
                      {selectedIds.length}
                    </span>{" "}
                    {tr("tài khoản", "accounts")}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Nút Cài đặt / Setup Job */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsJobConfigOpen(true)}
                      className="h-7 text-[11px] gap-1.5 cursor-pointer bg-background hover:bg-muted font-medium border-border/80 shadow-xs text-foreground"
                      title={tr(
                        "Cài đặt loại job, thời gian delay làm job, chờ nhận job...",
                        "Setup job types, action delay, wait delay...",
                      )}
                    >
                      <SlidersHorizontal className="size-3 text-primary" />
                      <span>{tr("Cài đặt Job", "Job Settings")}</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const toCheckAccounts = filteredAccounts.filter((a) =>
                          selectedIds.includes(a.id),
                        );
                        const toCheckPages: {
                          acc: FacebookAccount;
                          page: FacebookPageItem;
                        }[] = [];
                        for (const a of filteredAccounts) {
                          for (const p of a.pages || []) {
                            if (
                              selectedIds.includes(`page_${a.id}_${p.pageId}`)
                            ) {
                              toCheckPages.push({ acc: a, page: p });
                            }
                          }
                        }
                        void (async () => {
                          for (const acc of toCheckAccounts) {
                            await handleCheckAccount(acc);
                            const safeDelay =
                              1200 + Math.floor(Math.random() * 800);
                            await new Promise((r) => setTimeout(r, safeDelay));
                          }
                          for (const { acc, page } of toCheckPages) {
                            await handleCheckPage(acc, page);
                            const safeDelay =
                              1200 + Math.floor(Math.random() * 800);
                            await new Promise((r) => setTimeout(r, safeDelay));
                          }
                        })();
                      }}
                      className="h-7 text-[11px] gap-1 cursor-pointer"
                    >
                      <RefreshCw className="size-3" />
                      <span>
                        {tr("Kiểm tra lại", "Re-check")} ({selectedIds.length})
                      </span>
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        const count = selectedIds.length;
                        setAccounts((prev) => {
                          const updated = prev
                            .filter((a) => !selectedIds.includes(a.id))
                            .map((a) => {
                              if (!a.pages?.length) return a;
                              const remainingPages = a.pages.filter(
                                (p) =>
                                  !selectedIds.includes(
                                    `page_${a.id}_${p.pageId}`,
                                  ),
                              );
                              if (remainingPages.length === a.pages.length)
                                return a;
                              return { ...a, pages: remainingPages };
                            });
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
                          tr(
                            `Đã xóa vĩnh viễn ${count} mục đã chọn!`,
                            `Permanently deleted ${count} selected items!`,
                          ),
                        );
                      }}
                      className="h-7 text-[11px] gap-1 cursor-pointer"
                    >
                      <Trash2 className="size-3" />
                      <span>{tr("Xóa vĩnh viễn", "Delete permanently")}</span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleRunSelected}
                      className="h-7 text-[11px] gap-1.5 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
                    >
                      <Play className="size-3 fill-current" />
                      <span>
                        {tr("Chạy", "Run")} ({selectedIds.length})
                      </span>
                    </Button>
                  </div>
                </div>
              )}

              {/* Table View matching Image 2 */}
              <div className="flex flex-1 flex-col rounded-lg border border-border/60 bg-background overflow-hidden shadow-xs">
                {/* Table Header */}
                <div className="grid grid-cols-[40px_2.8fr_1.2fr_1.5fr_1.2fr_1.5fr_125px] items-center px-3 py-2.5 text-xs font-semibold text-muted-foreground border-b border-border/60 bg-background select-none shrink-0">
                  <div className="flex items-center justify-center">
                    <Checkbox
                      checked={
                        getAllSelectableIds().length > 0 &&
                        selectedIds.length === getAllSelectableIds().length
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </div>
                  <div className="flex items-center gap-1 hover:text-foreground cursor-pointer">
                    <span>{tr("Tên & UID", "Name & UID")}</span>
                    <span className="text-[10px]">▲</span>
                  </div>
                  <div>{tr("TIỆN ÍCH", "UTILITIES")}</div>
                  <div>Proxy / VPN</div>
                  <div>{tr("TRẠNG THÁI", "STATUS")}</div>
                  <div>{tr("HÀNH ĐỘNG", "ACTION / STATE")}</div>
                  <div className="text-right pr-2">
                    {tr("Thao tác", "Actions")}
                  </div>
                </div>

                {/* Table Rows or Empty State */}
                {filteredAccounts.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center py-28 text-center select-none">
                    {currentPage === "profiles" && !xsmmAccount.isLoggedIn ? (
                      <div className="flex flex-col items-center gap-2.5">
                        <div className="flex size-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          <ShieldCheck className="size-6" />
                        </div>
                        <p className="text-xs font-semibold text-foreground">
                          {tr(
                            "Chưa kết nối tài khoản XSMM",
                            "XSMM account not connected",
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground max-w-xs leading-relaxed">
                          {tr(
                            "Vui lòng đăng nhập tài khoản XSMM để quản lý và tự động hóa tài khoản.",
                            "Please sign in to XSMM account to manage and automate accounts.",
                          )}
                        </p>
                        <Button
                          size="sm"
                          onClick={() => setIsXsmmLoginOpen(true)}
                          className="mt-2 h-7.5 text-xs bg-amber-500 hover:bg-amber-600 text-black font-semibold cursor-pointer gap-1.5"
                        >
                          <Key className="size-3.5" />
                          <span>
                            {tr(
                              "Đăng nhập tài khoản XSMM",
                              "Sign in XSMM account",
                            )}
                          </span>
                        </Button>
                      </div>
                    ) : currentPage === "gl" && !golikeAccount.isLoggedIn ? (
                      <div className="flex flex-col items-center gap-2.5">
                        <div className="flex size-12 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          <ShieldCheck className="size-6" />
                        </div>
                        <p className="text-xs font-semibold text-foreground">
                          {tr(
                            "Chưa kết nối tài khoản GoLike",
                            "GoLike account not connected",
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground max-w-xs leading-relaxed">
                          {tr(
                            "Vui lòng đăng nhập tài khoản GoLike để quản lý và tự động hóa tài khoản.",
                            "Please sign in to GoLike account to manage and automate accounts.",
                          )}
                        </p>
                        <Button
                          size="sm"
                          onClick={() => setIsGolikeLoginOpen(true)}
                          className="mt-2 h-7.5 text-xs bg-cyan-600 hover:bg-cyan-700 text-white font-semibold cursor-pointer gap-1.5"
                        >
                          <Key className="size-3.5" />
                          <span>
                            {tr(
                              "Đăng nhập tài khoản GoLike",
                              "Sign in GoLike account",
                            )}
                          </span>
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
                            ? tr(
                                "Chưa có tài khoản Instagram nào",
                                "No Instagram accounts yet",
                              )
                            : tr(
                                "Chưa có tài khoản Facebook nào",
                                "No Facebook accounts yet",
                              )}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {tr(
                            `Bấm nút "+ Mới" ở góc trên bên phải để thêm tài khoản ${currentPlatform === "instagram" ? "Instagram" : "Facebook"}.`,
                            `Click "+ New" button at top right to add a ${currentPlatform === "instagram" ? "Instagram" : "Facebook"} account.`,
                          )}
                        </p>
                        <Button
                          size="sm"
                          onClick={() => setIsAddFacebookOpen(true)}
                          className="mt-2 h-7.5 text-xs cursor-pointer gap-1.5"
                        >
                          <Plus className="size-3.5" />
                          <span>
                            {currentPlatform === "instagram"
                              ? tr(
                                  "Thêm tài khoản Instagram",
                                  "Add Instagram Account",
                                )
                              : tr(
                                  "Thêm tài khoản Facebook",
                                  "Add Facebook Account",
                                )}
                          </span>
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 min-h-0 divide-y divide-border/30 overflow-y-auto">
                    {filteredAccounts.map((acc) => {
                      const isChecking = checkingIds.includes(acc.id);
                      const isSelected = selectedIds.includes(acc.id);
                      const isCheckpointOrDie =
                        acc.isLive === false ||
                        acc.status === "checkpoint" ||
                        acc.status === "die";
                      const runState = runnerStates.get(acc.id);
                      const isRunning = runState?.isRunning ?? false;
                      const avatarSrc =
                        isCheckpointOrDie
                          ? undefined
                          : acc.avatar;

                      return (
                        <div key={acc.id} className="flex flex-col">
                          <div
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
                              "grid grid-cols-[40px_2.8fr_1.2fr_1.5fr_1.2fr_1.5fr_125px] items-center px-3 py-1.5 min-h-[46px] text-xs text-foreground cursor-pointer transition-colors select-none outline-none focus-visible:bg-muted/50",
                              isSelected
                                ? "bg-primary/10 border-l-2 border-primary"
                                : isCheckpointOrDie
                                  ? "bg-muted/30 opacity-60 hover:bg-muted/40"
                                  : "hover:bg-muted/30",
                              !acc.pages?.length && "h-[46px]",
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
                              <div
                                className={cn(
                                  isCheckpointOrDie && "grayscale opacity-75",
                                )}
                              >
                                <AccountAvatar
                                  url={avatarSrc}
                                  isInstagram={acc.platform === "instagram"}
                                />
                              </div>
                              <div className="flex flex-col min-w-0 justify-center">
                                <span
                                  className={cn(
                                    "font-semibold truncate leading-tight",
                                    isCheckpointOrDie
                                      ? "text-muted-foreground"
                                      : "text-foreground",
                                  )}
                                >
                                  {acc.name ||
                                    (acc.platform === "instagram"
                                      ? "Đang đồng bộ..."
                                      : acc.uid)}
                                </span>
                                <span className="text-[10px] font-mono text-muted-foreground truncate leading-tight">
                                  {acc.platform === "instagram"
                                    ? `UID: ${acc.uid}`
                                    : acc.name && acc.name !== acc.uid
                                      ? acc.uid
                                      : `UID: ${acc.uid}`}
                                </span>
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
                                  title={tr(
                                    "Click để copy Token",
                                    "Click to copy Token",
                                  )}
                                >
                                  Token
                                </button>
                              ) : null}
                              {acc.twoFactor ? (
                                <span className="text-[11px] font-mono">
                                  2FA
                                </span>
                              ) : null}
                              {!acc.token && !acc.twoFactor && (
                                <span>{tr("Mặc định", "Default")}</span>
                              )}
                            </div>

                            {/* Proxy / VPN */}
                            <div className="text-muted-foreground truncate pr-2 font-mono text-[11px]">
                              {acc.proxy || tr("Chưa chọn", "Not set")}
                            </div>

                            {/* TRẠNG THÁI */}
                            <div className="flex items-center min-w-[95px]">
                              {isChecking ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-muted text-muted-foreground whitespace-nowrap">
                                  <RefreshCw className="size-2.5 animate-spin shrink-0" />
                                  {tr("Đang kiểm tra", "Checking")}
                                </span>
                              ) : runState &&
                                (runState.successCount > 0 ||
                                  runState.earnedPoints > 0) ? (
                                <span
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 whitespace-nowrap"
                                  title={`${runState.successCount} thành công, ${runState.errorCount} lỗi`}
                                >
                                  ✓ {runState.successCount}{" "}
                                  {runState.earnedPoints > 0
                                    ? `(+${runState.earnedPoints})`
                                    : ""}
                                </span>
                              ) : acc.isLive === true ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 whitespace-nowrap">
                                  Live
                                </span>
                              ) : acc.isLive === false || acc.status === "die" || acc.status === "checkpoint" ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20 whitespace-nowrap">
                                  Die
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20 whitespace-nowrap">
                                  {tr("Chưa kiểm tra", "Unchecked")}
                                </span>
                              )}
                            </div>

                            {/* HÀNH ĐỘNG */}
                            <div className="text-muted-foreground truncate pr-2 font-medium">
                              {isCheckpointOrDie ? (
                                <span className="text-rose-500/80 font-medium">
                                  {acc.status === "checkpoint"
                                    ? tr("Bị Checkpoint", "Checkpoint")
                                    : tr("Đã Die", "Died")}
                                </span>
                              ) : isRunning ? (
                                <span
                                  className="inline-flex items-center gap-1.5 text-emerald-500 font-semibold truncate"
                                  title={runState?.status}
                                >
                                  <span className="relative flex size-2 shrink-0">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
                                  </span>
                                  <span className="truncate">
                                    {runState?.status ||
                                      tr("Đang chạy...", "Running...")}
                                  </span>
                                </span>
                              ) : runState?.lastError ? (
                                <span
                                  className="text-amber-500 truncate"
                                  title={runState.lastError}
                                >
                                  {runState.lastError}
                                </span>
                              ) : acc.note &&
                                acc.note !== "Không có ghi chú" ? (
                                acc.note
                              ) : (
                                tr("Sẵn sàng", "Ready")
                              )}
                            </div>

                            {/* Thao tác */}
                            <div className="flex items-center justify-end gap-1.5 pr-2">
                              {/* Nút chấm than: Xem toàn bộ thông tin tài khoản */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDetailAccount(acc);
                                  setIsDetailOpen(true);
                                }}
                                title={tr(
                                  "Xem toàn bộ thông tin tài khoản",
                                  "View full account details",
                                )}
                                className="p-1 text-primary hover:bg-primary/10 rounded transition-colors cursor-pointer"
                              >
                                <CircleAlert className="size-3.5" />
                              </button>

                              {/* Nút kiểm tra lại trạng thái Live/Die/Checkpoint */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleCheckAccount(acc);
                                }}
                                title={tr(
                                  "Kiểm tra lại tài khoản",
                                  "Re-check account",
                                )}
                                className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors cursor-pointer"
                              >
                                <RefreshCw
                                  className={cn(
                                    "size-3.5",
                                    isChecking && "animate-spin text-primary",
                                  )}
                                />
                              </button>

                              {/* Nút Chạy/Dừng tài khoản */}
                              <button
                                type="button"
                                disabled={isCheckpointOrDie}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isCheckpointOrDie) return;
                                  handleRunAccount(acc);
                                }}
                                title={
                                  isCheckpointOrDie
                                    ? tr(
                                        "Tài khoản bị Checkpoint/Die, không thể chạy",
                                        "Account is Checkpoint/Die, cannot run",
                                      )
                                    : isRunning
                                      ? tr(
                                          "Dừng chạy tài khoản",
                                          "Stop running account",
                                        )
                                      : tr("Chạy tài khoản", "Run account")
                                }
                                className={cn(
                                  "p-1 rounded transition-colors",
                                  isCheckpointOrDie
                                    ? "text-muted-foreground/30 opacity-40 cursor-not-allowed"
                                    : isRunning
                                      ? "text-rose-500 bg-rose-500/15 hover:bg-rose-500/25 cursor-pointer"
                                      : "text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 cursor-pointer",
                                )}
                              >
                                {isRunning ? (
                                  <Square className="size-3.5 fill-current" />
                                ) : (
                                  <Play className="size-3.5 fill-current" />
                                )}
                              </button>

                              {/* Nút xóa */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteAccount(acc.id);
                                }}
                                title={tr("Xóa tài khoản", "Delete account")}
                                className="p-1 text-muted-foreground hover:text-destructive rounded transition-colors cursor-pointer"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Danh sách Pages con của tài khoản bên dưới */}
                          {acc.pages && acc.pages.length > 0 && (
                            <div className="border-t border-border/20 bg-muted/10 divide-y divide-border/20">
                              <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5 bg-muted/20">
                                <Flag className="size-3.5 text-blue-500 shrink-0 ml-2" />
                                <span>
                                  {tr(
                                    `Danh sách Page / Profile+ (${acc.pages.length}):`,
                                    `Pages / Profile+ (${acc.pages.length}):`,
                                  )}
                                </span>
                              </div>
                              {acc.pages.map((p) => {
                                const displayUid =
                                  p.additionalProfileId || p.pageId;
                                const pageKey = `page_${acc.id}_${p.pageId}`;
                                const pageRunState =
                                  runnerStates.get(pageKey);
                                const isPageRunning =
                                  pageRunState?.isRunning ?? false;
                                const isPageChecking =
                                  checkingIds.includes(pageKey);

                                const isPageSelected =
                                  selectedIds.includes(pageKey);

                                return (
                                  <div
                                    key={p.pageId}
                                    tabIndex={0}
                                    role="button"
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        toggleSelectOne(pageKey);
                                      }
                                    }}
                                    onClick={(e) => {
                                      const target = e.target as HTMLElement;
                                      if (
                                        target.closest("button") ||
                                        target.closest("a") ||
                                        target.closest('[role="checkbox"]')
                                      ) {
                                        return;
                                      }
                                      toggleSelectOne(pageKey);
                                    }}
                                    className={cn(
                                      "grid grid-cols-[40px_2.8fr_1.2fr_1.5fr_1.2fr_1.5fr_125px] items-center px-3 py-1.5 min-h-[44px] text-xs text-foreground cursor-pointer hover:bg-muted/30 transition-colors select-none outline-none focus-visible:bg-muted/50",
                                      isPageRunning && "bg-emerald-500/5",
                                      isPageSelected &&
                                        "bg-primary/10 border-l-2 border-primary",
                                    )}
                                  >
                                    {/* Cột 0 (40px): Checkbox tích chọn như Profile */}
                                    <div className="flex items-center justify-center">
                                      <Checkbox
                                        checked={isPageSelected}
                                        onCheckedChange={() =>
                                          toggleSelectOne(pageKey)
                                        }
                                      />
                                    </div>

                                    {/* Cột 1 (2.8fr): Avatar, Tên Page & UID */}
                                    <div className="flex items-center gap-2 min-w-0 pr-2">
                                      <span className="text-[12px] font-mono text-muted-foreground/60 shrink-0 ml-1">
                                        ↳
                                      </span>
                                      <AccountAvatar url={p.avatar} />
                                      <div className="flex flex-col min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-medium truncate text-foreground leading-tight text-[11.5px]">
                                            {p.pageName}
                                          </span>
                                          <span className="text-[9px] font-mono px-1 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20 font-bold shrink-0">
                                            Page 615
                                          </span>
                                          {isPageRunning ? (
                                            <span
                                              className="relative flex size-2 shrink-0"
                                              title={pageRunState?.status}
                                            >
                                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                              <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
                                            </span>
                                          ) : pageRunState &&
                                            pageRunState.successCount > 0 ? (
                                            <span
                                              className="text-[9px] font-mono px-1 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold shrink-0"
                                              title={`${pageRunState.successCount} thành công, ${pageRunState.errorCount} lỗi`}
                                            >
                                              ✓ {pageRunState.successCount}
                                            </span>
                                          ) : null}
                                        </div>
                                        <span className="font-mono text-[9.5px] text-muted-foreground truncate leading-tight">
                                          UID: {displayUid}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Cột 2 (1.2fr): Token của Page */}
                                    <div className="flex items-center pr-2">
                                      {p.pageToken ? (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (p.pageToken) {
                                              handleCopy(p.pageToken);
                                            }
                                          }}
                                          className="text-[9.5px] px-1.5 py-0.5 font-mono bg-blue-500/10 text-blue-500 rounded border border-blue-500/20 hover:bg-blue-500/20 shrink-0 cursor-pointer inline-flex items-center gap-1"
                                          title={tr(
                                            "Copy Page Token",
                                            "Copy Page Token",
                                          )}
                                        >
                                          <Key className="size-2.5" />
                                          <span>Token</span>
                                        </button>
                                      ) : (
                                        <span className="text-muted-foreground/40 text-[10px]">
                                          —
                                        </span>
                                      )}
                                    </div>

                                    {/* Cột 3 (1.5fr): Proxy / VPN */}
                                    <div className="text-muted-foreground truncate font-mono text-[11px] pr-2">
                                      {acc.proxy || "—"}
                                    </div>

                                    {/* Cột 4 (1.2fr): Trạng thái */}
                                    <div className="pr-2">
                                      {isPageChecking ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-muted text-muted-foreground whitespace-nowrap">
                                          <RefreshCw className="size-2.5 animate-spin shrink-0" />
                                          {tr("Đang kiểm tra", "Checking")}
                                        </span>
                                      ) : pageRunState &&
                                        (pageRunState.successCount > 0 ||
                                          pageRunState.earnedPoints > 0) ? (
                                        <span
                                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 whitespace-nowrap"
                                          title={`${pageRunState.successCount} thành công, ${pageRunState.errorCount} lỗi`}
                                        >
                                          ✓ {pageRunState.successCount}{" "}
                                          {pageRunState.earnedPoints > 0
                                            ? `(+${pageRunState.earnedPoints})`
                                            : ""}
                                        </span>
                                      ) : p.isLive === false ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20 whitespace-nowrap">
                                          Die
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 whitespace-nowrap">
                                          Live
                                        </span>
                                      )}
                                    </div>

                                    {/* Cột 5 (1.5fr): Hành động */}
                                    <div className="text-muted-foreground truncate pr-2 font-medium">
                                      {isPageRunning ? (
                                        <span
                                          className="inline-flex items-center gap-1.5 text-emerald-500 font-semibold truncate"
                                          title={pageRunState?.status}
                                        >
                                          <span className="relative flex size-2 shrink-0">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                            <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
                                          </span>
                                          <span className="truncate">
                                            {pageRunState?.status ||
                                              tr("Đang chạy...", "Running...")}
                                          </span>
                                        </span>
                                      ) : pageRunState?.lastError ? (
                                        <span
                                          className="text-amber-500 truncate"
                                          title={pageRunState.lastError}
                                        >
                                          {pageRunState.lastError}
                                        </span>
                                      ) : (
                                        p.category || tr("Sẵn sàng", "Ready")
                                      )}
                                    </div>

                                    {/* Cột 6 (125px): Thao tác — căn khớp tuyệt đối với Thao tác của Profile */}
                                    <div className="flex items-center justify-end gap-1.5 pr-2">
                                      {/* Nút xem chi tiết Page */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDetailAccount({
                                            id: pageKey,
                                            uid: displayUid,
                                            name: p.pageName,
                                            token: p.pageToken || acc.token,
                                            cookie: acc.cookie,
                                            proxy: acc.proxy,
                                            avatar: p.avatar,
                                            platform: "facebook",
                                            status:
                                              p.isLive === false
                                                ? "die"
                                                : "live",
                                            rawText: `Page: ${p.pageName} | UID 615: ${displayUid}`,
                                          });
                                          setIsDetailOpen(true);
                                        }}
                                        title={tr(
                                          "Xem chi tiết Page",
                                          "View page details",
                                        )}
                                        className="p-1 text-primary hover:bg-primary/10 rounded transition-colors cursor-pointer"
                                      >
                                        <CircleAlert className="size-3.5" />
                                      </button>

                                      {/* Nút kiểm tra lại Page */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          void handleCheckPage(acc, p);
                                        }}
                                        title={tr(
                                          "Kiểm tra lại Page",
                                          "Re-check page",
                                        )}
                                        className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors cursor-pointer"
                                      >
                                        <RefreshCw
                                          className={cn(
                                            "size-3.5",
                                            isPageChecking &&
                                              "animate-spin text-primary",
                                          )}
                                        />
                                      </button>

                                      {/* Nút Chạy/Dừng Page */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRunPage(acc, p);
                                        }}
                                        title={
                                          isPageRunning
                                            ? tr(
                                                "Dừng chạy Page",
                                                "Stop running page",
                                              )
                                            : tr(
                                                "Chạy nhiệm vụ bằng Page",
                                                "Run task with page",
                                              )
                                        }
                                        className={cn(
                                          "p-1 rounded transition-colors cursor-pointer",
                                          isPageRunning
                                            ? "text-rose-500 bg-rose-500/15 hover:bg-rose-500/25"
                                            : "text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10",
                                        )}
                                      >
                                        {isPageRunning ? (
                                          <Square className="size-3.5 fill-current" />
                                        ) : (
                                          <Play className="size-3.5 fill-current" />
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {(currentPage === "ttc" ||
            currentPage === "nvc") && (
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
                    <span>{tr("Tên", "Name")}</span>
                    <span className="text-[10px]">▲</span>
                  </div>
                  <div>{tr("Thẻ", "Tags")}</div>
                  <div>{tr("Ghi chú", "Note")}</div>
                  <div>Proxy / VPN</div>
                  <div>{tr("TIỆN ÍCH", "UTILITIES")}</div>
                  <div>{tr("TRẠNG THÁI TÀI KHOẢN", "ACCOUNT STATUS")}</div>
                  <div>{tr("HÀNH ĐỘNG", "ACTION")}</div>
                  <div className="text-right">#</div>
                </div>

                {/* Empty State */}
                <div className="flex flex-1 flex-col items-center justify-center py-20 text-center">
                  <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm mb-3">
                    {currentPage.toUpperCase()}
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {tr(
                      `Chưa có tài khoản ${currentPage.toUpperCase()} nào`,
                      `No ${currentPage.toUpperCase()} accounts yet`,
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    {tr(
                      `Giao diện ${currentPage.toUpperCase()} đã sẵn sàng. Logic kết nối và làm nhiệm vụ sẽ được cấu hình trong bước tiếp theo.`,
                      `${currentPage.toUpperCase()} interface is ready. Task connection logic will be configured in subsequent updates.`,
                    )}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {currentPage === "reg-page" && (
            <RegPageView
              onNavigateToNuoiAcc={() => setCurrentPage("account")}
              availableAccountsCount={
                filteredAccounts.filter((a) => a.status === "live").length ||
                filteredAccounts.length
              }
              accounts={accounts}
              onUpdateAccountPages={handleUpdateAccountPages}
            />
          )}
        </main>

        {/* Apple dock style bottom navigation bar with icons & logo */}
        <RailNav
          currentPage={currentPage}
          onNavigate={handleRailNavigate}
          onOpenAbout={() => {
            setAboutDialogOpen(true);
          }}
          onOpenUtilities={() => setIsUtilitiesChoiceOpen(true)}
        />
      </div>

      {/* Utilities Choice Dialog (1. Reg Page, 2. Nuôi Acc) */}
      <UtilitiesDialog
        open={isUtilitiesChoiceOpen}
        onOpenChange={setIsUtilitiesChoiceOpen}
        onSelectOption={(option) => {
          if (option === "reg-page") {
            setCurrentPage("reg-page");
          } else {
            setCurrentPage("account");
          }
        }}
      />

      {/* Dialog Thêm tài khoản */}
      <AddFacebookAccountDialog
        isOpen={isAddFacebookOpen}
        onClose={() => setIsAddFacebookOpen(false)}
        onAddAccounts={handleAddAccounts}
        isXsmmLoggedIn={xsmmAccount.isLoggedIn}
        platform={currentPlatform}
        isGolike={currentPage === "gl"}
        onXsmmLoginSuccess={handleXsmmLoginSuccess}
      />

      {/* Dialog Đăng nhập XSMM */}
      <XsmmLoginDialog
        isOpen={isXsmmLoginOpen}
        onClose={() => setIsXsmmLoginOpen(false)}
        onLoginSuccess={handleXsmmLoginSuccess}
      />

      {/* Dialog Đăng nhập GoLike */}
      <GolikeLoginDialog
        isOpen={isGolikeLoginOpen}
        onClose={() => setIsGolikeLoginOpen(false)}
        onLoginSuccess={handleGolikeLoginSuccess}
      />

      {/* Settings Dialog */}
      <AppSettingsDialog
        isOpen={settingsDialogOpen}
        onClose={() => {
          setSettingsDialogOpen(false);
          setCurrentPage("profiles");
        }}
        accounts={accounts}
        licenseInfo={licenseInfo}
        onKeyLogout={handleKeyLogout}
        onUpdateFound={(res) => {
          setSettingsDialogOpen(false);
          setUpdateResult(res);
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
        account={
          detailAccount
            ? accounts.find((a) => a.id === detailAccount.id) || detailAccount
            : null
        }
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setDetailAccount(null);
        }}
        onRecheck={(acc) => void handleCheckAccount(acc as FacebookAccount)}
        onUpdateMedia={(updated) => {
          if (!detailAccount) return;
          setAccounts((prev) => {
            const updatedList = prev.map((a) => {
              if (a.id === detailAccount.id) {
                return {
                  ...a,
                  avatar: updated.avatar || a.avatar,
                  cover: updated.cover || a.cover,
                  token: updated.token || a.token,
                  name: updated.name || a.name,
                  pages: updated.pages || a.pages,
                };
              }
              if (a.pages && a.pages.length > 0) {
                const pageIndex = a.pages.findIndex(
                  (p) =>
                    `page_${a.id}_${p.pageId}` === detailAccount.id ||
                    p.pageId === detailAccount.uid ||
                    p.additionalProfileId === detailAccount.uid,
                );
                if (pageIndex !== -1) {
                  const newPages = [...a.pages];
                  newPages[pageIndex] = {
                    ...newPages[pageIndex],
                    avatar: updated.avatar || newPages[pageIndex].avatar,
                  };
                  return { ...a, pages: newPages };
                }
              }
              return a;
            });
            try {
              localStorage.setItem(
                "autolunex_facebook_accounts_v1",
                JSON.stringify(updatedList),
              );
            } catch {
              // ignore
            }
            return updatedList;
          });
          setDetailAccount((prev) => (prev ? { ...prev, ...updated } : prev));
        }}
        isChecking={
          detailAccount ? checkingIds.includes(detailAccount.id) : false
        }
      />

      {/* Dialog Cài đặt cấu hình chạy Job XSMM */}
      <XsmmJobConfigDialog
        isOpen={isJobConfigOpen}
        onClose={() => setIsJobConfigOpen(false)}
      />

      {/* Khóa bắt buộc cập nhật nếu phát hiện phiên bản cũ */}
      {updateResult?.isOutdated && (
        <ForceUpdateModal
          updateInfo={updateResult}
          onRecheck={async () => {
            const res = await checkAppVersion();
            setUpdateResult(res.isOutdated ? res : null);
          }}
        />
      )}
    </div>
  );
}
