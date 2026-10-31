"use client";

import {
  CircleAlert,
  Coins,
  Eye,
  EyeOff,
  Flag,
  Key,
  LayoutGrid,
  LayoutList,
  Link2,
  LogOut,
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
import { AccountGridView } from "@/components/account-grid-view";
import { AddFacebookAccountDialog } from "@/components/add-facebook-account-dialog";
import { AppHeader, TiktokIcon } from "@/components/app-header";
import { AppSettingsDialog } from "@/components/app-settings-dialog";
import { ForceUpdateModal } from "@/components/force-update-modal";
import { KeyLoginScreen } from "@/components/key-login-screen";
import { type AppPage, RailNav } from "@/components/rail-nav";
import { RegPageView } from "@/components/reg-page-view";
import { OverviewView } from "@/components/overview-view";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { UtilitiesDialog } from "@/components/utilities-dialog";
import { XsmmJobConfigDialog } from "@/components/xsmm-job-config-dialog";
import { XsmmLoginDialog } from "@/components/xsmm-login-dialog";
import { NvcLoginDialog } from "@/components/nvc-login-dialog";
import { DolikeLoginDialog } from "@/components/dolike-login-dialog";
import {
  getDolikeWallet,
  getDolikePlatformAccounts,
  linkDolikeAccountFull,
  logoutDolike,
  verifyDolikeToken,
} from "@/lib/dolike-api";
import {
  getNvcMe,
  getNvcFacebookAccounts,
  addNvcFacebookAccounts,
} from "@/lib/nvc-api";
import {
  checkFacebookAccountFull,
  checkLiveApi,
  checkUidLiveGraph,
  type FacebookPageItem,
} from "@/lib/facebook-api";
import { checkCookieIg, fetchIgUserInfo } from "@/lib/instagram-api";
import { MOTION_EASE_OUT } from "@/lib/motion";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { cn } from "@/lib/utils";
import {
  type AppVersionCheckResult,
  checkAppVersion,
} from "@/lib/version-checker";
import { addXsmmAccount, getXsmmUser } from "@/lib/xsmm-api";
import { type AccountRunState, xsmmRunner } from "@/lib/xsmm-runner";
import { dolikeRunner } from "@/lib/dolike-runner";
import {
  type AdbDeviceInfo,
  getAdbDevices,
  launchTiktokApp,
  clickTiktokProfileTab,
  detectTiktokUsername,
} from "@/lib/adb-service";

export interface TikTokAccountItem {
  id: string;
  username: string;
  nickname?: string;
  avatar?: string;
  isCurrent?: boolean;
  status?: "live" | "die" | "ready" | string;
}

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
  platform?: "tiktok" | "facebook" | "instagram";
  isDolike?: boolean;
  status: "live" | "checkpoint" | "die" | "unverified";
  isLive?: boolean;
  rawText: string;
  pages?: FacebookPageItem[];
  tiktokAccounts?: TikTokAccountItem[];
  dolikeEmail?: string;
  dolikeBalance?: string;
  dolikeLinked?: boolean;
}

export const isDoLikeAccount = (a: FacebookAccount) =>
  Boolean(a.isDolike || a.id.startsWith("acc_dl_") || a.dolikeEmail);

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
    <div
      className={cn(
        "relative size-7 rounded-full overflow-hidden shrink-0 border flex items-center justify-center shadow-2xs",
        hasError && isInstagram
          ? "bg-[#E1306C]/10 border-[#E1306C]/25"
          : "bg-muted/60 border-border/70",
      )}
    >
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

  // Chế độ xem danh sách tài khoản: mặc định là "grid" (dạng thẻ)
  const [accountViewMode, setAccountViewMode] = useState<"table" | "grid">(() => {
    if (typeof window === "undefined") return "grid";
    return (
      (localStorage.getItem("autolunex_account_view_mode") as "table" | "grid") ||
      "grid"
    );
  });

  const handleSetViewMode = (mode: "table" | "grid") => {
    setAccountViewMode(mode);
    try {
      localStorage.setItem("autolunex_account_view_mode", mode);
    } catch {
      // ignore
    }
  };

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
  const [isNvcLoginOpen, setIsNvcLoginOpen] = useState(false);
  const [nvcAccount, setNvcAccount] = useState<{
    username: string;
    balance: string;
    sessionCookie: string;
    isLoggedIn: boolean;
  }>(() => {
    if (typeof window === "undefined") {
      return { username: "", balance: "", sessionCookie: "", isLoggedIn: false };
    }
    const username = localStorage.getItem("nvc_username") || "";
    const balance = localStorage.getItem("nvc_balance") || "";
    const sessionCookie = localStorage.getItem("nvc_session_cookie") || "";
    return {
      username,
      balance,
      sessionCookie,
      isLoggedIn: !!username,
    };
  });
  const [isDolikeLoginOpen, setIsDolikeLoginOpen] = useState(false);
  const [dolikeAccount, setDolikeAccount] = useState<{
    email: string;
    displayName?: string;
    userId?: string;
    balance: string;
    sessionCookie: string;
    bearerToken?: string;
    isLoggedIn: boolean;
  }>(() => {
    if (typeof window === "undefined") {
      return {
        email: "",
        displayName: "",
        userId: "",
        balance: "",
        sessionCookie: "",
        bearerToken: "",
        isLoggedIn: false,
      };
    }
    const email = localStorage.getItem("dolike_email") || "";
    let displayName = localStorage.getItem("dolike_display_name") || "";
    let userId = localStorage.getItem("dolike_user_id") || "";
    const balance = localStorage.getItem("dolike_balance") || "";
    const bearerToken =
      localStorage.getItem("dolike_auth_token") ||
      localStorage.getItem("dolike_bearer_token") ||
      "";

    const placeholderMatch =
      (email && email.match(/^(?:email|user)_(\d+)$/i)) ||
      (displayName && displayName.match(/^(?:email|user)_(\d+)$/i));
    if (placeholderMatch) {
      userId = userId || placeholderMatch[1];
      displayName = `UID: ${placeholderMatch[1]}`;
      try {
        localStorage.setItem("dolike_display_name", displayName);
        if (userId) localStorage.setItem("dolike_user_id", userId);
      } catch {
        // ignore
      }
    }

    return {
      email,
      displayName:
        displayName ||
        (email && email.includes("@")
          ? email.split("@")[0]
          : userId
            ? `UID: ${userId}`
            : ""),
      userId,
      balance,
      sessionCookie: "",
      bearerToken,
      isLoggedIn: !!(email || bearerToken),
    };
  });
  const [dolikeLinkedUsernames, setDolikeLinkedUsernames] = useState<string[]>(
    () => {
      if (typeof window === "undefined") return [];
      try {
        const saved = localStorage.getItem("dolike_linked_usernames");
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    },
  );
  const [dolikeLinkingIds, setDolikeLinkingIds] = useState<string[]>([]);
  const hasCheckedDolikeAccountsRef = useRef(false);
  const [nvcLinkedUids, setNvcLinkedUids] = useState<string[]>([]);
  const [nvcLinkingIds, setNvcLinkingIds] = useState<string[]>([]);
  const [xsmmLinkingIds, setXsmmLinkingIds] = useState<string[]>([]);
  const hasCheckedNvcAccountsRef = useRef(false);
  const [accounts, setAccounts] = useState<FacebookAccount[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("autolunex_facebook_accounts_v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((acc: FacebookAccount) => {
            const cleanAcc = { ...acc };
            if (cleanAcc.isLive === undefined) {
              if (cleanAcc.status === "live") {
                cleanAcc.isLive = true;
              } else if (cleanAcc.status === "die" || cleanAcc.status === "checkpoint") {
                cleanAcc.isLive = false;
              }
            }
            if (cleanAcc.isDolike) {
              cleanAcc.platform = "instagram";
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
            // Tự động sửa nếu proxy của Instagram bị dính chuỗi ngày tháng hoặc cookie bị dính pipes
            if (cleanAcc.platform === "instagram") {
              if (cleanAcc.proxy && /^\d{4}[-/]\d{2}[-/]\d{2}/.test(cleanAcc.proxy)) {
                cleanAcc.proxy = "Chưa chọn";
              }
              if (cleanAcc.cookie && cleanAcc.cookie.includes("|")) {
                const parts = cleanAcc.cookie.split("|").map((s) => s.trim());
                const cPart = parts.find(
                  (p) =>
                    p.includes("ds_user_id=") ||
                    p.includes("sessionid=") ||
                    p.includes("csrftoken="),
                );
                if (cPart) cleanAcc.cookie = cPart;
              }
            }
            return cleanAcc;
          }).filter(
            (a: FacebookAccount) =>
              !(a.id?.startsWith("acc_dl_") && !a.uid && !a.name),
          );
        }
      }
    } catch {
      // ignore
    }
    return [];
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [revealedEmails, setRevealedEmails] = useState<Record<string, boolean>>({});
  const toggleRevealEmail = (id: string) => {
    setRevealedEmails((prev) => ({ ...prev, [id]: !prev[id] }));
  };
  const [currentPlatform, setCurrentPlatform] = useState<
    "tiktok" | "facebook" | "instagram"
  >("facebook");

  // Đối với TikTok: luôn cố định dạng thẻ ("grid"), không cho phép xem dạng dài
  const effectiveViewMode = currentPlatform === "tiktok" ? "grid" : accountViewMode;

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

  // Đăng ký nhận cập nhật trạng thái tác vụ từ DoLike Runner (Độc lập cho DoLike)
  useEffect(() => {
    const unsub = dolikeRunner.subscribe((states) => {
      setRunnerStates((prev) => {
        const next = new Map(prev);
        for (const [k, v] of states) {
          next.set(k, v);
        }
        return next;
      });
    });
    dolikeRunner.setOnBalanceUpdated((balance) => {
      setDolikeAccount((prev) => {
        try {
          localStorage.setItem("dolike_balance", balance);
        } catch {
          // ignore
        }
        return {
          ...prev,
          balance,
        };
      });
    });
    return () => unsub();
  }, []);

  // Tự động đồng bộ thiết bị Android cắm qua cáp USB thành thẻ tài khoản TikTok
  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncAdbDeviceToAccount = (dev: AdbDeviceInfo) => {
      if (!dev || !dev.serial) return;

      const devName = dev.display_name || dev.market_name || dev.model || `Android ${dev.serial}`;
      const devNote = `Pin: ${dev.battery_level !== null ? `${dev.battery_level}%` : "Sẵn sàng"} | Android ${dev.android_version || "10+"} | Mã máy: ${dev.model || "USB"}`;
      const devTag = `USB • ${dev.brand ? dev.brand.toUpperCase() : "Android"}`;

      setAccounts((prev) => {
        const existingIdx = prev.findIndex((a) => a.uid === dev.serial);
        let updated: FacebookAccount[];
        if (existingIdx >= 0) {
          updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            name: devName,
            note: devNote,
            tag: devTag,
            status: "live" as const,
            isLive: true,
            platform: "tiktok",
          };
        } else {
          const newAcc: FacebookAccount = {
            id: `adb_${dev.serial}`,
            uid: dev.serial,
            name: devName,
            note: devNote,
            tag: devTag,
            platform: "tiktok",
            status: "live" as const,
            isLive: true,
            rawText: `${dev.serial} | ${devName} | USB_ADB`,
          };
          updated = [newAcc, ...prev];
        }
        try {
          localStorage.setItem("autolunex_facebook_accounts_v1", JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });
    };

    const handleAdbConnected = (event: Event) => {
      const customEvent = event as CustomEvent<AdbDeviceInfo>;
      if (customEvent.detail) {
        syncAdbDeviceToAccount(customEvent.detail);
      }
    };

    const handleAdbDisconnected = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      const serial = customEvent.detail;
      if (!serial) return;

      setAccounts((prev) => {
        const existingIdx = prev.findIndex((a) => a.uid === serial);
        if (existingIdx < 0) return prev;
        const updated: FacebookAccount[] = [...prev];
        const oldNote = updated[existingIdx].note || "";
        updated[existingIdx] = {
          ...updated[existingIdx],
          status: "die" as const,
          isLive: false,
          note: oldNote.includes("Đã ngắt") ? oldNote : `${oldNote} (Đã ngắt USB)`,
        };
        try {
          localStorage.setItem("autolunex_facebook_accounts_v1", JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });
    };

    window.addEventListener("autolunex:adb-device-connected", handleAdbConnected);
    window.addEventListener("autolunex:adb-device-disconnected", handleAdbDisconnected);

    // Tự động quét và hiển thị ngay các thiết bị đã cắm sẵn từ trước
    void getAdbDevices().then((devices) => {
      devices
        .filter((d) => d.state === "device")
        .forEach((dev) => {
          syncAdbDeviceToAccount(dev);
        });
    });

    return () => {
      window.removeEventListener("autolunex:adb-device-connected", handleAdbConnected);
      window.removeEventListener("autolunex:adb-device-disconnected", handleAdbDisconnected);
    };
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

  // Đồng bộ số dư NVC ngầm khi mở ứng dụng nếu có session
  useEffect(() => {
    let isMounted = true;
    const cookie =
      nvcAccount.sessionCookie ||
      (typeof window !== "undefined"
        ? localStorage.getItem("nvc_session_cookie")
        : "") ||
      "";

    if (!cookie) return;

    void (async () => {
      try {
        const res = await getNvcMe(cookie);
        if (res.success && res.user && isMounted) {
          const freshUser = res.user;
          const freshUsername = freshUser.username;
          const formatted = `${Number(freshUser.coinBalance || 0).toLocaleString("vi-VN")} xu`;
          try {
            localStorage.setItem("nvc_username", freshUsername);
            localStorage.setItem("nvc_balance", formatted);
          } catch {
            // ignore
          }
          setNvcAccount((prev) => ({
            ...prev,
            username: freshUsername,
            balance: formatted,
            isLoggedIn: true,
          }));
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // Tự động kiểm tra danh sách tài khoản đã liên kết trên Nhiệm Vụ Chéo (chỉ gọi 1 lần khi vào tab NVC / đăng nhập)
  useEffect(() => {
    if (currentPage !== "nvc" || !nvcAccount.isLoggedIn) return;
    if (hasCheckedNvcAccountsRef.current) return;
    hasCheckedNvcAccountsRef.current = true;

    const cookie =
      nvcAccount.sessionCookie ||
      (typeof window !== "undefined"
        ? localStorage.getItem("nvc_session_cookie")
        : "") ||
      "";

    if (!cookie) return;

    void getNvcFacebookAccounts(cookie).then((res) => {
      if (res.success && Array.isArray(res.accounts)) {
        const uids: string[] = [];
        for (const a of res.accounts) {
          if (a.externalUid) uids.push(String(a.externalUid));
          if (a.userId) uids.push(String(a.userId));
          if (a.fbid) uids.push(String(a.fbid));
          if (Array.isArray(a.candidates)) {
            for (const c of a.candidates) {
              if (c?.id) uids.push(String(c.id));
            }
          }
        }
        setNvcLinkedUids(Array.from(new Set(uids)));
      }
    });
  }, [currentPage, nvcAccount.isLoggedIn, nvcAccount.sessionCookie]);

  const handleNvcLoginSuccess = (user: {
    username: string;
    balance: string;
    sessionCookie?: string;
  }) => {
    hasCheckedNvcAccountsRef.current = false;
    setNvcAccount({
      username: user.username,
      balance: user.balance,
      sessionCookie: user.sessionCookie || "",
      isLoggedIn: true,
    });
  };

  const handleNvcLogout = () => {
    hasCheckedNvcAccountsRef.current = false;
    setNvcLinkedUids([]);
    setNvcLinkingIds([]);
    try {
      localStorage.removeItem("nvc_username");
      localStorage.removeItem("nvc_balance");
      localStorage.removeItem("nvc_session_cookie");
    } catch {
      // ignore
    }
    setNvcAccount({
      username: "",
      balance: "",
      sessionCookie: "",
      isLoggedIn: false,
    });
    showSuccessToast("Đã đăng xuất tài khoản Nhiệm Vụ Chéo");
  };

  // Đồng bộ số dư DoLike ngầm nếu có Token Bearer chuẩn GoMax
  useEffect(() => {
    let isMounted = true;
    const token =
      dolikeAccount.bearerToken ||
      (typeof window !== "undefined"
        ? localStorage.getItem("dolike_auth_token") ||
          localStorage.getItem("dolike_bearer_token")
        : "") ||
      "";

    if (!token) return;

    void (async () => {
      try {
        const res = await verifyDolikeToken(token);
        if (res.success && isMounted) {
          if (res.balance) {
            try {
              localStorage.setItem("dolike_balance", res.balance);
              if (res.email) localStorage.setItem("dolike_email", res.email);
              if (res.displayName) {
                localStorage.setItem("dolike_display_name", res.displayName);
              }
            } catch {
              // ignore
            }
          }
          setDolikeAccount((prev) => ({
            ...prev,
            balance: res.balance ?? prev.balance,
            email: res.email ?? prev.email,
            displayName: res.displayName ?? prev.displayName,
            bearerToken: token,
            isLoggedIn: true,
          }));
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [dolikeAccount.bearerToken]);


  const handleDolikeLoginSuccess = (user: {
    email: string;
    displayName?: string;
    userId?: string | number;
    balance: string;
    sessionCookie?: string;
    bearerToken?: string;
  }) => {
    let resolvedUserId = user.userId ? String(user.userId) : "";
    if (!resolvedUserId) {
      const match = (user.email || "").match(/^(?:email|user)_(\d+)$/i);
      if (match) resolvedUserId = match[1];
    }
    const finalDisplay =
      user.displayName ||
      (resolvedUserId
        ? `UID: ${resolvedUserId}`
        : user.email && user.email.includes("@")
          ? user.email.split("@")[0]
          : "DoLike User");
    try {
      localStorage.setItem("dolike_email", user.email);
      localStorage.setItem("dolike_display_name", finalDisplay);
      localStorage.setItem("dolike_balance", user.balance);
      if (resolvedUserId) {
        localStorage.setItem("dolike_user_id", resolvedUserId);
      }
      if (user.sessionCookie) {
        localStorage.setItem("dolike_session_cookie", user.sessionCookie);
      }
      if (user.bearerToken) {
        localStorage.setItem("dolike_auth_token", user.bearerToken);
        localStorage.setItem("dolike_bearer_token", user.bearerToken);
      }
    } catch {
      // ignore
    }

    setDolikeAccount({
      email: user.email,
      displayName: finalDisplay,
      userId: resolvedUserId,
      balance: user.balance,
      sessionCookie: user.sessionCookie || "",
      bearerToken: user.bearerToken || "",
      isLoggedIn: true,
    });

    if (user.sessionCookie || user.bearerToken) {
      void (async () => {
        try {
          const res = await getDolikePlatformAccounts({
            cookie: user.sessionCookie,
            bearerToken: user.bearerToken,
          });
          if (res.success && Array.isArray(res.accounts)) {
            const ulist = res.accounts
              .map((a) =>
                (a.username || a.account_url || a.account_name || "")
                  .replace(/^@/, "")
                  .trim()
                  .toLowerCase(),
              )
              .filter(Boolean);
            if (ulist.length > 0) {
              setDolikeLinkedUsernames((prev) => {
                const merged = Array.from(new Set([...prev, ...ulist]));
                try {
                  localStorage.setItem(
                    "dolike_linked_usernames",
                    JSON.stringify(merged),
                  );
                } catch {
                  // ignore
                }
                return merged;
              });
            }
          }
        } catch {
          // ignore
        }
      })();
    }

    // Dọn sạch các dòng trống cũ nếu có
    setAccounts((prev) => {
      const cleaned = prev.filter(
        (a) => !(a.id?.startsWith("acc_dl_") && !a.uid && !a.name),
      );
      if (cleaned.length !== prev.length) {
        try {
          localStorage.setItem(
            "autolunex_facebook_accounts_v1",
            JSON.stringify(cleaned),
          );
        } catch {
          // ignore
        }
      }
      return cleaned;
    });

    showSuccessToast(
      tr(
        `Đã kết nối tài khoản DoLike [${finalDisplay}] thành công!`,
        `Connected DoLike account [${finalDisplay}] successfully!`,
      ),
    );
  };

  // Tự động kiểm tra và đồng bộ danh sách tài khoản đã liên kết từ DoLike
  useEffect(() => {
    if (currentPage !== "dolike") return;
    if (!dolikeAccount.sessionCookie && !dolikeAccount.bearerToken) return;
    if (hasCheckedDolikeAccountsRef.current) return;
    hasCheckedDolikeAccountsRef.current = true;

    void (async () => {
      try {
        const res = await getDolikePlatformAccounts({
          cookie: dolikeAccount.sessionCookie,
          bearerToken: dolikeAccount.bearerToken,
        });
        if (res.success && Array.isArray(res.accounts)) {
          const ulist = res.accounts
            .map((a) =>
              (a.username || a.account_url || a.account_name || "")
                .replace(/^@/, "")
                .trim()
                .toLowerCase(),
            )
            .filter(Boolean);
          if (ulist.length > 0) {
            setDolikeLinkedUsernames((prev) => {
              const merged = Array.from(new Set([...prev, ...ulist]));
              try {
                localStorage.setItem(
                  "dolike_linked_usernames",
                  JSON.stringify(merged),
                );
              } catch {
                // ignore
              }
              return merged;
            });
          }
        }
      } catch {
        // ignore
      }
    })();
  }, [currentPage, dolikeAccount]);

  const handleDolikeLogout = () => {
    logoutDolike();
    try {
      localStorage.removeItem("dolike_linked_usernames");
      localStorage.removeItem("dolike_user_id");
    } catch {
      // ignore
    }
    setDolikeAccount({
      email: "",
      displayName: "",
      userId: "",
      balance: "",
      sessionCookie: "",
      bearerToken: "",
      isLoggedIn: false,
    });
    setDolikeLinkedUsernames([]);
    setAccounts((prev) => {
      const updated = prev
        .filter((a) => a.uid || a.name)
        .map((a) => {
          if (a.dolikeEmail) {
            return {
              ...a,
              dolikeEmail: undefined,
              dolikeBalance: undefined,
              dolikeLinked: undefined,
            };
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
    showSuccessToast("Đã đăng xuất tài khoản DoLike");
  };

  const handleLinkDolikeAccount = async (targetAccount: FacebookAccount) => {
    if (
      !dolikeAccount.isLoggedIn &&
      !dolikeAccount.sessionCookie &&
      !dolikeAccount.bearerToken
    ) {
      showErrorToast(
        tr(
          "Vui lòng đăng nhập tài khoản DoLike trước!",
          "Please log in to DoLike first!",
        ),
      );
      setIsDolikeLoginOpen(true);
      return;
    }

    const cleanUsername = (targetAccount.name || targetAccount.uid || "")
      .replace(/^@/, "")
      .trim();

    if (!cleanUsername) {
      showErrorToast(
        tr(
          "Tài khoản chưa có Username Instagram để liên kết!",
          "Account missing Instagram username to link!",
        ),
      );
      return;
    }

    setDolikeLinkingIds((prev) => [...prev, targetAccount.id]);
    try {
      const dlCookie =
        dolikeAccount.sessionCookie ||
        (typeof window !== "undefined"
          ? localStorage.getItem("dolike_session_cookie") || undefined
          : undefined);
      const dlBearer =
        dolikeAccount.bearerToken ||
        (typeof window !== "undefined"
          ? localStorage.getItem("dolike_bearer_token") || undefined
          : undefined);

      const res = await linkDolikeAccountFull({
        accountUrl: cleanUsername,
        platform: "instagram",
        cookie: dlCookie,
        bearerToken: dlBearer,
      });

      if (res.success) {
        const normUser = cleanUsername.toLowerCase();
        setDolikeLinkedUsernames((prev) => {
          const updated = Array.from(new Set([...prev, normUser]));
          try {
            localStorage.setItem(
              "dolike_linked_usernames",
              JSON.stringify(updated),
            );
          } catch {
            // ignore
          }
          return updated;
        });

        setAccounts((prev) => {
          const updatedList = prev.map((item) =>
            item.id === targetAccount.id
              ? { ...item, dolikeLinked: true }
              : item,
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

        const successMsg = res.alreadyLinked
          ? tr(
              `Đã xác nhận tài khoản @${cleanUsername} trên DoLike (không cần liên kết lại).`,
              `Account @${cleanUsername} verified on DoLike (no re-linking needed).`,
            )
          : tr(
              `Đã liên kết tài khoản @${cleanUsername} lên DoLike thành công!`,
              `Successfully linked account @${cleanUsername} to DoLike!`,
            );
        showSuccessToast(successMsg);
      } else {
        showErrorToast(
          res.error ||
            tr(
              "Lỗi liên kết tài khoản vào DoLike",
              "Failed to link account to DoLike",
            ),
        );
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : tr("Lỗi kết nối DoLike", "DoLike connection error");
      showErrorToast(msg);
    } finally {
      setDolikeLinkingIds((prev) =>
        prev.filter((id) => id !== targetAccount.id),
      );
    }
  };

  const handleBulkLinkDolike = async () => {
    if (
      !dolikeAccount.isLoggedIn &&
      !dolikeAccount.sessionCookie &&
      !dolikeAccount.bearerToken
    ) {
      showErrorToast(
        tr(
          "Vui lòng đăng nhập tài khoản DoLike trước!",
          "Please log in to DoLike first!",
        ),
      );
      setIsDolikeLoginOpen(true);
      return;
    }

    const targetAccounts =
      selectedIds.length > 0
        ? filteredAccounts.filter((a) => selectedIds.includes(a.id))
        : filteredAccounts;
    if (targetAccounts.length === 0) return;

    const targetAccountIds = targetAccounts.map((a) => a.id);
    setDolikeLinkingIds((prev) =>
      Array.from(new Set([...prev, ...targetAccountIds])),
    );
    let successCount = 0;
    const newLinked: string[] = [];

    const dlCookie =
      dolikeAccount.sessionCookie ||
      (typeof window !== "undefined"
        ? localStorage.getItem("dolike_session_cookie") || undefined
        : undefined);
    const dlBearer =
      dolikeAccount.bearerToken ||
      (typeof window !== "undefined"
        ? localStorage.getItem("dolike_bearer_token") || undefined
        : undefined);

    for (const acc of targetAccounts) {
      const cleanUser = (acc.name || acc.uid || "")
        .replace(/^@/, "")
        .trim();
      if (!cleanUser) continue;
      try {
        const res = await linkDolikeAccountFull({
          accountUrl: cleanUser,
          platform: "instagram",
          cookie: dlCookie,
          bearerToken: dlBearer,
        });
        if (res.success) {
          successCount++;
          newLinked.push(cleanUser.toLowerCase());
        }
      } catch {
        // ignore
      }
      await new Promise((r) => setTimeout(r, 600));
    }

    if (newLinked.length > 0) {
      setDolikeLinkedUsernames((prev) => {
        const merged = Array.from(new Set([...prev, ...newLinked]));
        try {
          localStorage.setItem(
            "dolike_linked_usernames",
            JSON.stringify(merged),
          );
        } catch {
          // ignore
        }
        return merged;
      });
      setAccounts((prev) => {
        const updatedList = prev.map((item) => {
          const u = (item.name || item.uid || "")
            .replace(/^@/, "")
            .trim()
            .toLowerCase();
          if (newLinked.includes(u)) {
            return { ...item, dolikeLinked: true };
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

    setDolikeLinkingIds((prev) =>
      prev.filter((id) => !targetAccountIds.includes(id)),
    );

    if (successCount > 0) {
      showSuccessToast(
        tr(
          `Đã liên kết ${successCount} tài khoản vào DoLike thành công!`,
          `Successfully linked ${successCount} accounts to DoLike!`,
        ),
      );
    } else {
      showErrorToast(
        tr(
          "Không có tài khoản nào được liên kết vào DoLike",
          "No accounts linked to DoLike",
        ),
      );
    }
  };

  const handleLinkNvcAccount = async (targetAccount: FacebookAccount) => {
    if (!nvcAccount.isLoggedIn) {
      showErrorToast(
        tr(
          "Vui lòng đăng nhập Nhiệm Vụ Chéo trước!",
          "Please log in to NVC first!",
        ),
      );
      setIsNvcLoginOpen(true);
      return;
    }
    const cookie =
      nvcAccount.sessionCookie ||
      (typeof window !== "undefined"
        ? localStorage.getItem("nvc_session_cookie")
        : "") ||
      "";
    if (!cookie) {
      showErrorToast(
        tr("Phiên đăng nhập NVC đã hết hạn", "NVC session expired"),
      );
      return;
    }

    setNvcLinkingIds((prev) => [...prev, targetAccount.id]);
    try {
      const res = await addNvcFacebookAccounts(cookie, [targetAccount.uid]);
      if (res.success) {
        setNvcLinkedUids((prev) =>
          Array.from(new Set([...prev, targetAccount.uid, ...res.linkedUids])),
        );
        showSuccessToast(
          tr(
            `Đã liên kết nick [${targetAccount.uid}] vào NVC thành công!`,
            `Successfully linked account [${targetAccount.uid}] to NVC!`,
          ),
        );
      } else {
        showErrorToast(
          res.error ||
            tr("Chưa liên kết được tài khoản vào NVC", "Failed to link account to NVC"),
        );
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : tr("Lỗi kết nối NVC", "NVC connection error");
      showErrorToast(msg);
    } finally {
      setNvcLinkingIds((prev) => prev.filter((id) => id !== targetAccount.id));
    }
  };

  const handleLinkXsmmAccount = async (targetAccount: FacebookAccount) => {
    const savedToken =
      xsmmAccount.token || localStorage.getItem("xsmm_token") || "";
    if (!savedToken) {
      setIsXsmmLoginOpen(true);
      showErrorToast(
        tr(
          "Vui lòng đăng nhập tài khoản XSMM trước!",
          "Please log in to XSMM account first!",
        ),
      );
      return;
    }
    setXsmmLinkingIds((prev) => [...prev, targetAccount.id]);
    try {
      const isIg = targetAccount.platform === "instagram";
      const targetUser = isIg
        ? (targetAccount.name || targetAccount.uid || "")
            .replace(/^@/, "")
            .trim()
        : targetAccount.uid;
      const res = await addXsmmAccount(savedToken, {
        type: isIg ? "instagram" : "facebook",
        link_account: targetUser,
      });
      if (res.success) {
        showSuccessToast(
          tr(
            `Đã liên kết [${targetUser}] vào XSMM thành công!`,
            `Successfully linked [${targetUser}] to XSMM!`,
          ),
        );
      } else {
        showErrorToast(
          res.error ||
            tr(
              "Không thể liên kết tài khoản vào XSMM",
              "Failed to link account to XSMM",
            ),
        );
      }
    } catch (err: unknown) {
      showErrorToast(err instanceof Error ? err.message : String(err));
    } finally {
      setXsmmLinkingIds((prev) =>
        prev.filter((id) => id !== targetAccount.id),
      );
    }
  };

  const handleLinkNvcPage = async (pageKey: string, pageUid: string) => {
    if (!nvcAccount.isLoggedIn) {
      showErrorToast(
        tr(
          "Vui lòng đăng nhập Nhiệm Vụ Chéo trước!",
          "Please log in to NVC first!",
        ),
      );
      setIsNvcLoginOpen(true);
      return;
    }
    const cookie =
      nvcAccount.sessionCookie ||
      (typeof window !== "undefined"
        ? localStorage.getItem("nvc_session_cookie")
        : "") ||
      "";
    if (!cookie) return;

    setNvcLinkingIds((prev) => [...prev, pageKey]);
    try {
      const res = await addNvcFacebookAccounts(cookie, [pageUid]);
      if (res.success) {
        setNvcLinkedUids((prev) =>
          Array.from(new Set([...prev, pageUid, ...res.linkedUids])),
        );
        showSuccessToast(
          tr(
            `Đã liên kết Page [${pageUid}] vào NVC thành công!`,
            `Successfully linked Page [${pageUid}] to NVC!`,
          ),
        );
      } else {
        showErrorToast(
          res.error || tr("Lỗi chưa liên kết được Page", "Failed to link Page"),
        );
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : tr("Lỗi kết nối NVC", "NVC error");
      showErrorToast(msg);
    } finally {
      setNvcLinkingIds((prev) => prev.filter((id) => id !== pageKey));
    }
  };

  const handleBulkLinkNvc = async () => {
    if (!nvcAccount.isLoggedIn) {
      showErrorToast(
        tr(
          "Vui lòng đăng nhập Nhiệm Vụ Chéo trước!",
          "Please log in to NVC first!",
        ),
      );
      setIsNvcLoginOpen(true);
      return;
    }
    const cookie =
      nvcAccount.sessionCookie ||
      (typeof window !== "undefined"
        ? localStorage.getItem("nvc_session_cookie")
        : "") ||
      "";
    if (!cookie) return;

    const selectedAccounts = filteredAccounts.filter((a) =>
      selectedIds.includes(a.id),
    );
    const uidsToLink = selectedAccounts.map((a) => a.uid).filter(Boolean);

    for (const a of filteredAccounts) {
      for (const p of a.pages || []) {
        if (selectedIds.includes(`page_${a.id}_${p.pageId}`)) {
          const pUid = p.additionalProfileId || p.pageId;
          if (pUid) uidsToLink.push(pUid);
        }
      }
    }

    if (uidsToLink.length === 0) return;

    setNvcLinkingIds((prev) => Array.from(new Set([...prev, ...selectedIds])));
    try {
      const res = await addNvcFacebookAccounts(cookie, uidsToLink);
      if (res.success) {
        setNvcLinkedUids((prev) =>
          Array.from(new Set([...prev, ...uidsToLink, ...res.linkedUids])),
        );
        showSuccessToast(
          tr(
            `Đã liên kết ${uidsToLink.length} tài khoản vào NVC thành công!`,
            `Successfully linked ${uidsToLink.length} accounts to NVC!`,
          ),
        );
      } else {
        showErrorToast(
          res.error ||
            tr(
              "Lỗi chưa liên kết được tài khoản vào NVC",
              "Failed to link accounts to NVC",
            ),
        );
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : tr("Lỗi kết nối NVC", "NVC error");
      showErrorToast(msg);
    } finally {
      setNvcLinkingIds((prev) =>
        prev.filter((id) => !selectedIds.includes(id)),
      );
    }
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
    if (page === "nvc") {
      setCurrentPlatform("facebook");
    }
    if (page === "dolike") {
      setCurrentPlatform("instagram");
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
      const updates = new Map<
        string,
        {
          username: string;
          avatar?: string;
          isLive?: boolean;
          status?: "live" | "checkpoint" | "die" | "unverified";
        }
      >();
      let hasChanges = false;

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
              isLive: true,
              status: "live",
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
                isLive: up.isLive ?? item.isLive,
                status: up.status ?? item.status,
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

    // Xử lý kiểm tra thiết bị Android cắm qua cáp USB
    if (
      targetAccount.tag?.includes("USB") ||
      targetAccount.id.startsWith("adb_") ||
      targetAccount.platform === "tiktok"
    ) {
      try {
        const devices = await getAdbDevices();
        const found = devices.find((d) => d.serial === targetAccount.uid);
        if (found && found.state === "device") {
          const devName =
            found.display_name ||
            found.market_name ||
            found.model ||
            targetAccount.name;
          const devNote = `Pin: ${found.battery_level !== null ? `${found.battery_level}%` : "Sẵn sàng"} | Android ${found.android_version || "10+"} | Mã máy: ${found.model || "USB"}`;

          // Điều khiển thiết bị mở TikTok VN, nếu chưa cài đặt thì thông báo người dùng cài đặt
          void (async () => {
            const res = await launchTiktokApp(targetAccount.uid);
            if (res.notInstalled) {
              showErrorToast(
                `Vui lòng cài đặt TikTok để chạy! Thiết bị ${devName} chưa có ứng dụng TikTok (com.ss.android.ugc.trill).`,
              );
              return;
            }
            if (!res.success) {
              showErrorToast(`Không thể mở TikTok trên thiết bị ${devName}: ${res.error || "Lỗi khởi động"}`);
              return;
            }

            showSuccessToast(`Đã mở TikTok VN trên ${devName}! Đang đợi giao diện ổn định...`);

            // Tự động tìm và bấm nút Hồ sơ ở thanh điều hướng dưới cùng (không cố định tọa độ, không click avatar tròn)
            const clickRes = await clickTiktokProfileTab(targetAccount.uid);
            if (!clickRes.success) {
              showErrorToast(
                clickRes.error || `Không tìm thấy nút Hồ sơ ở thanh dưới cùng trên thiết bị ${devName}`,
              );
              return;
            }

            showSuccessToast(`Đã bấm vào tab Hồ sơ trên ${devName}! Đang nhận diện tài khoản...`);

            // Quét nhận diện username TikTok đang mở trên trang cá nhân
            const detectedUser = await detectTiktokUsername(targetAccount.uid);
            if (detectedUser) {
              setAccounts((prev) => {
                const updated = prev.map((a) => {
                  if (a.id === targetAccount.id) {
                    const existingList = a.tiktokAccounts || [];
                    const foundIdx = existingList.findIndex(
                      (item) => item.username === detectedUser,
                    );
                    let nextList: TikTokAccountItem[];
                    if (foundIdx >= 0) {
                      nextList = existingList.map((item, idx) => ({
                        ...item,
                        isCurrent: idx === foundIdx,
                      }));
                    } else {
                      nextList = [
                        {
                          id: detectedUser,
                          username: detectedUser,
                          nickname: detectedUser.replace(/^@/, ""),
                          isCurrent: true,
                          status: "live",
                        },
                        ...existingList.map((item) => ({
                          ...item,
                          isCurrent: false,
                        })),
                      ];
                    }
                    return {
                      ...a,
                      name: detectedUser,
                      tiktokAccounts: nextList,
                    };
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
              showSuccessToast(
                `Đã nhận diện thành công tài khoản TikTok: ${detectedUser}`,
              );
            }
          })();

          setAccounts((prev) => {
            const updated: FacebookAccount[] = prev.map((a) =>
              a.id === targetAccount.id
                ? {
                    ...a,
                    name: devName,
                    note: devNote,
                    status: "live" as const,
                    isLive: true,
                  }
                : a,
            );
            try {
              localStorage.setItem("autolunex_facebook_accounts_v1", JSON.stringify(updated));
            } catch {
              // ignore
            }
            return updated;
          });
          showSuccessToast(
            `Thiết bị ${devName} kết nối ổn định! Pin: ${found.battery_level !== null ? `${found.battery_level}%` : "Sẵn sàng"}`,
          );
        } else if (found && found.state === "unauthorized") {
          showErrorToast(
            `Thiết bị ${found.model || targetAccount.name} chưa được cấp quyền Gỡ lỗi USB trên điện thoại.`,
          );
        } else {
          setAccounts((prev) => {
            const updated: FacebookAccount[] = prev.map((a) =>
              a.id === targetAccount.id
                ? {
                    ...a,
                    status: "die" as const,
                    isLive: false,
                    note: `${a.note || ""} (Đã ngắt USB)`.replace(
                      " (Đã ngắt USB) (Đã ngắt USB)",
                      " (Đã ngắt USB)",
                    ),
                  }
                : a,
            );
            try {
              localStorage.setItem("autolunex_facebook_accounts_v1", JSON.stringify(updated));
            } catch {
              // ignore
            }
            return updated;
          });
          showErrorToast(
            `Không tìm thấy thiết bị ${targetAccount.name}. Vui lòng cắm lại cáp USB.`,
          );
        }
      } catch (err: unknown) {
        showErrorToast(
          `Lỗi kiểm tra thiết bị: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        setCheckingIds((prev) => prev.filter((id) => id !== targetAccount.id));
      }
      return;
    }

    if (targetAccount.platform === "instagram" || isDoLikeAccount(targetAccount)) {
      try {
        let proxyParam =
          targetAccount.proxy && targetAccount.proxy !== "Chưa chọn"
            ? targetAccount.proxy
            : undefined;
        // Bỏ qua nếu proxy là chuỗi ngày tháng
        if (proxyParam && /^\d{4}[-/]\d{2}[-/]\d{2}/.test(proxyParam)) {
          proxyParam = undefined;
        }

        let cookie = targetAccount.cookie?.trim() || "";
        if (cookie.includes("|")) {
          const parts = cookie.split("|").map((s) => s.trim());
          const cPart = parts.find(
            (p) =>
              p.includes("ds_user_id=") ||
              p.includes("sessionid=") ||
              p.includes("csrftoken="),
          );
          if (cPart) cookie = cPart;
        }
        if (!cookie || !cookie.includes("=")) {
          if (targetAccount.rawText) {
            const parts = targetAccount.rawText.split("|").map((s) => s.trim());
            const cPart = parts.find(
              (p) =>
                p.includes("ds_user_id=") ||
                p.includes("sessionid=") ||
                p.includes("csrftoken="),
            );
            if (cPart) cookie = cPart;
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

          const isLive = accountStatus === "live";

          const updated: Partial<FacebookAccount> = {
            cookie,
            platform: "instagram",
            proxy:
              proxyParam ||
              (targetAccount.proxy && !/^\d{4}[-/]\d{2}[-/]\d{2}/.test(targetAccount.proxy)
                ? targetAccount.proxy
                : "Chưa chọn"),
            status: accountStatus,
            isLive,
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
            const isLive = !!uInfo.isLive;
            const updated: Partial<FacebookAccount> = {
              platform: "instagram",
              status: isLive ? "live" : "die",
              isLive,
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
      // 0. Nhận diện tài khoản TikTok
      const isTikTok = currentPlatform === "tiktok";
      if (isTikTok) {
        const parts = line.split("|").map((p) => p.trim());
        const uid = parts[0] || `acc_tt_${Date.now()}_${idx + 1}`;
        const pass = parts.length > 1 && !parts[1].includes(":") ? parts[1] : undefined;
        let cookie: string | undefined;
        let proxyStr = "Chưa chọn";

        for (let i = 1; i < parts.length; i++) {
          const part = parts[i];
          if (part.includes("sessionid=") || part.includes("ttwid=") || part.includes(";")) {
            cookie = part;
          } else if (part.includes(":") && !part.includes(" ") && !/^\d{4}[-/]\d{2}[-/]\d{2}/.test(part)) {
            proxyStr = part;
          }
        }

        const account: FacebookAccount = {
          id: `${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          uid,
          name: uid.startsWith("@") ? uid : `@${uid}`,
          pass,
          cookie,
          tag: "Không có thẻ",
          note: "Sẵn sàng",
          proxy: proxyStr,
          platform: "tiktok",
          status: "unverified",
          rawText: line,
        };
        return account;
      }

      // 1. Tự động nhận diện tài khoản Instagram (từ tab DoLike, tab Instagram hoặc chuỗi cookie có ds_user_id/sessionid/csrftoken)
      const isIg =
        currentPage === "dolike" ||
        currentPlatform === "instagram" ||
        line.includes("ds_user_id=") ||
        line.includes("sessionid=") ||
        line.includes("csrftoken=");

      if (isIg) {
        let rawCookie = line.trim();
        let proxyStr = "Chưa chọn";
        if (line.includes("|")) {
          const parts = line.split("|").map((p) => p.trim());
          const cIdx = parts.findIndex(
            (p) =>
              p.includes("ds_user_id=") ||
              p.includes("sessionid=") ||
              p.includes("csrftoken="),
          );
          if (cIdx !== -1) {
            rawCookie = parts[cIdx];
            const pPart = parts.find(
              (p, i) =>
                i !== cIdx &&
                p.includes(":") &&
                !p.includes(" ") &&
                !/^\d{4}[-/]\d{2}[-/]\d{2}/.test(p),
            );
            if (pPart) proxyStr = pPart;
          } else {
            const lastPipeIndex = line.lastIndexOf("|");
            rawCookie = line.substring(0, lastPipeIndex).trim();
            const maybeProxy = line.substring(lastPipeIndex + 1).trim();
            if (maybeProxy && maybeProxy.includes(":") && !maybeProxy.includes(" ") && !/^\d{4}[-/]\d{2}[-/]\d{2}/.test(maybeProxy)) {
              proxyStr = maybeProxy;
            }
          }
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
      const currentPrev = [...prev];
      if (currentPage === "dolike") {
        for (const n of newAccounts) {
          n.isDolike = true;
          n.platform = "instagram";
        }
        const placeholderIdx = currentPrev.findIndex(
          (a) =>
            isDoLikeAccount(a) &&
            !a.uid &&
            !a.name,
        );
        if (placeholderIdx !== -1 && newAccounts.length > 0) {
          const placeholder = currentPrev[placeholderIdx];
          newAccounts[0].dolikeEmail = placeholder.dolikeEmail || dolikeAccount.email;
          newAccounts[0].dolikeBalance = placeholder.dolikeBalance || dolikeAccount.balance || "0 đ";
          newAccounts[0].isDolike = true;
          currentPrev.splice(placeholderIdx, 1);
        } else if (dolikeAccount.email) {
          for (const n of newAccounts) {
            if (!n.dolikeEmail) {
              n.dolikeEmail = dolikeAccount.email;
              n.dolikeBalance = dolikeAccount.balance || "0 đ";
            }
          }
        }
      } else {
        for (const n of newAccounts) {
          n.isDolike = false;
        }
      }
      const merged = [...newAccounts, ...currentPrev];
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
      `Đã thêm ${newAccounts.length} tài khoản ${
        currentPlatform === "tiktok"
          ? "TikTok"
          : currentPlatform === "instagram"
            ? "Instagram"
            : "Facebook"
      }!`,
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

  const handleRunAccount = async (acc: FacebookAccount) => {
    if (acc.status === "checkpoint" || acc.status === "die") {
      showSuccessToast(
        tr(
          `Tài khoản ${acc.name || acc.uid} đang bị ${acc.status === "checkpoint" ? "Checkpoint" : "Die"}, không thể chạy!`,
          `Account ${acc.name || acc.uid} is ${acc.status === "checkpoint" ? "Checkpoint" : "Die"}, cannot run!`,
        ),
      );
      return;
    }

    if (currentPage === "dolike") {
      if (!dolikeAccount.isLoggedIn && !dolikeAccount.email) {
        setIsDolikeLoginOpen(true);
        showSuccessToast(
          tr(
            "Vui lòng đăng nhập tài khoản DoLike trước khi chạy nhiệm vụ!",
            "Please log in to DoLike account before running tasks!",
          ),
        );
        return;
      }
      if (!acc.cookie && !acc.rawText) {
        showSuccessToast(
          tr(
            "Tài khoản chưa có Cookie Instagram để chạy nhiệm vụ!",
            "Account missing Instagram Cookie to run tasks!",
          ),
        );
        return;
      }
      if (dolikeRunner.isRunning(acc.id)) {
        dolikeRunner.stopAccount(acc.id);
        showSuccessToast(
          tr(
            `Đã dừng chạy tài khoản DoLike: ${acc.name || acc.uid}`,
            `Stopped running DoLike account: ${acc.name || acc.uid}`,
          ),
        );
      } else {
        // Tự động liên kết DoLike nếu chưa liên kết
        const cleanUser = (acc.name || acc.uid || "")
          .replace(/^@/, "")
          .trim()
          .toLowerCase();
        if (cleanUser && !dolikeLinkedUsernames.includes(cleanUser)) {
          showSuccessToast(
            tr(
              `Đang tự động liên kết tài khoản @${cleanUser} vào DoLike...`,
              `Auto-linking @${cleanUser} to DoLike...`,
            ),
          );
          await handleLinkDolikeAccount(acc);
        }

        const dlCookie =
          dolikeAccount.sessionCookie ||
          (typeof window !== "undefined"
            ? localStorage.getItem("dolike_session_cookie") || undefined
            : undefined);
        const dlBearer =
          dolikeAccount.bearerToken ||
          (typeof window !== "undefined"
            ? localStorage.getItem("dolike_bearer_token") || undefined
            : undefined);

        void dolikeRunner.startAccount(acc, {
          cookie: dlCookie,
          bearerToken: dlBearer,
        });
        showSuccessToast(
          tr(
            `Bắt đầu chạy nhiệm vụ DoLike: ${acc.name || acc.uid}`,
            `Started running DoLike task: ${acc.name || acc.uid}`,
          ),
        );
      }
      return;
    }

    if (currentPage === "nvc") {
      if (!nvcAccount.isLoggedIn) {
        setIsNvcLoginOpen(true);
        showSuccessToast(
          tr(
            "Vui lòng đăng nhập Nhiệm Vụ Chéo trước khi chạy!",
            "Please log in to NVC before running!",
          ),
        );
        return;
      }
      // Tự động liên kết NVC nếu chưa liên kết
      if (acc.uid && !nvcLinkedUids.includes(acc.uid)) {
        showSuccessToast(
          tr(
            `Đang tự động liên kết nick [${acc.uid}] vào NVC...`,
            `Auto-linking account [${acc.uid}] to NVC...`,
          ),
        );
        await handleLinkNvcAccount(acc);
      }
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

  const handleRunSelected = async () => {
    if (selectedIds.length === 0) return;
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

    if (currentPage === "dolike") {
      if (!dolikeAccount.isLoggedIn && !dolikeAccount.email) {
        setIsDolikeLoginOpen(true);
        showSuccessToast(
          tr(
            "Vui lòng đăng nhập tài khoản DoLike trước khi chạy nhiệm vụ!",
            "Please log in to DoLike account before running tasks!",
          ),
        );
        return;
      }

      // Tự động liên kết các tài khoản chưa liên kết trước khi chạy
      const unlinked = runnableAccounts.filter((a) => {
        const cleanUser = (a.name || a.uid || "")
          .replace(/^@/, "")
          .trim()
          .toLowerCase();
        return cleanUser && !dolikeLinkedUsernames.includes(cleanUser);
      });
      if (unlinked.length > 0) {
        showSuccessToast(
          tr(
            `Tự động liên kết ${unlinked.length} tài khoản vào DoLike trước khi chạy...`,
            `Auto-linking ${unlinked.length} accounts to DoLike before running...`,
          ),
        );
        for (const acc of unlinked) {
          await handleLinkDolikeAccount(acc);
        }
      }

      const dlCookie =
        dolikeAccount.sessionCookie ||
        (typeof window !== "undefined"
          ? localStorage.getItem("dolike_session_cookie") || undefined
          : undefined);
      const dlBearer =
        dolikeAccount.bearerToken ||
        (typeof window !== "undefined"
          ? localStorage.getItem("dolike_bearer_token") || undefined
          : undefined);

      void dolikeRunner.startAccounts(runnableAccounts, {
        cookie: dlCookie,
        bearerToken: dlBearer,
      });
      showSuccessToast(
        tr(
          `Bắt đầu chạy ${runnableAccounts.length} tài khoản DoLike!`,
          `Started running ${runnableAccounts.length} DoLike accounts!`,
        ),
      );
      return;
    }

    if (currentPage === "nvc") {
      if (!nvcAccount.isLoggedIn) {
        setIsNvcLoginOpen(true);
        showSuccessToast(
          tr(
            "Vui lòng đăng nhập Nhiệm Vụ Chéo trước khi chạy!",
            "Please log in to NVC before running!",
          ),
        );
        return;
      }
      const unlinkedNvc = runnableAccounts.filter(
        (a) => a.uid && !nvcLinkedUids.includes(a.uid),
      );
      if (unlinkedNvc.length > 0) {
        showSuccessToast(
          tr(
            `Tự động liên kết ${unlinkedNvc.length} tài khoản vào NVC trước khi chạy...`,
            `Auto-linking ${unlinkedNvc.length} accounts to NVC before running...`,
          ),
        );
        for (const acc of unlinkedNvc) {
          await handleLinkNvcAccount(acc);
        }
      }
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
      const updated = prev
        .map((a) => {
          if (a.id !== id) return a;
          // Nếu ở tab DoLike và dòng này có tài khoản DoLike, chỉ xóa nick Instagram và giữ lại DoLike
          if (currentPage === "dolike" && a.dolikeEmail) {
            return {
              ...a,
              uid: "",
              name: "",
              cookie: undefined,
              token: undefined,
              pass: undefined,
              twoFactor: undefined,
              avatar: undefined,
              cover: undefined,
              rawText: "",
              proxy: undefined,
              status: "unverified" as const,
              isLive: undefined,
              note: undefined,
              tag: undefined,
              isDolike: true,
            };
          }
          return null;
        })
        .filter((a): a is FacebookAccount => a !== null);
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
      currentPage === "dolike"
        ? tr(
            "Đã xóa nick Instagram, vẫn giữ lại tài khoản DoLike!",
            "Deleted Instagram account, kept DoLike account!",
          )
        : tr("Đã xóa vĩnh viễn tài khoản!", "Account permanently deleted!"),
    );
  };

  const handleCopy = (text: string) => {
    void navigator.clipboard.writeText(text);
    showSuccessToast(tr("Đã sao chép vào bộ nhớ tạm!", "Copied to clipboard!"));
  };

  const filteredAccounts = accounts.filter((a) => {
    if (currentPage === "dolike") {
      return (a.platform || "facebook") === "instagram" && isDoLikeAccount(a);
    }
    return (a.platform || "facebook") === currentPlatform && !isDoLikeAccount(a);
  });

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
      case "nvc":
      case "dolike":
        return "";
      case "overview":
        return tr("Tổng quan", "Overview");
      case "ttc":
        return "TTC";
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
      {/* Top titlebar với drag region & thông tin XSMM / NVC */}
      <AppHeader
        activePlatform={currentPlatform}
        onPlatformChange={setCurrentPlatform}
        pageTitle={getPageTitle(currentPage)}
        showXsmm={currentPage === "profiles"}
        xsmmAccount={xsmmAccount}
        onXsmmLoginClick={() => setIsXsmmLoginOpen(true)}
        onXsmmLogoutClick={handleXsmmLogout}
        showNvc={currentPage === "nvc"}
        nvcAccount={nvcAccount}
        onNvcLoginClick={() => setIsNvcLoginOpen(true)}
        onNvcLogoutClick={handleNvcLogout}
        showDolike={currentPage === "dolike"}
        dolikeAccount={{
          username:
            dolikeAccount.displayName ||
            dolikeAccount.email ||
            "DoLike User",
          balance: dolikeAccount.balance || "0 đ",
          isLoggedIn: dolikeAccount.isLoggedIn,
          userId: dolikeAccount.userId,
          email: dolikeAccount.email,
        }}
        onDolikeLoginClick={() => setIsDolikeLoginOpen(true)}
        onDolikeLogoutClick={handleDolikeLogout}
        hideTiktok={currentPage !== "profiles"}
        hideInstagram={currentPage === "nvc" || currentPage === "overview"}
        hideFacebook={currentPage === "dolike" || currentPage === "overview"}
        onNewClick={
          currentPage === "overview"
            ? undefined
            : () => setIsAddFacebookOpen(true)
        }
      />

      {/* Main content area */}
      <div className="flex min-h-0 flex-1 flex-col">
        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto px-6 py-5">
          {(currentPage === "profiles" ||
            currentPage === "account" ||
            currentPage === "nvc") && (
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

              {/* Toolbar thao tác luôn luôn hiển thị cố định */}
              <div className="mb-2.5 flex items-center justify-between px-3.5 py-1.5 rounded-xl bg-muted/40 border border-border/60 text-xs">
                <div className="font-medium text-foreground flex items-center gap-2">
                  {selectedIds.length > 0 ? (
                    <>
                      <span>{tr("Đã chọn", "Selected")}:</span>
                      <span className="font-bold text-primary px-1.5 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                        {selectedIds.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedIds([])}
                        className="text-[11px] text-muted-foreground hover:text-foreground underline cursor-pointer ml-1"
                      >
                        {tr("Bỏ chọn", "Deselect")}
                      </button>
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      {tr("Tất cả:", "Total:")}{" "}
                      <strong className="text-foreground">
                        {filteredAccounts.length}
                      </strong>{" "}
                      {tr("tài khoản", "accounts")}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Nút Cài đặt / Setup Job: Luôn luôn bấm được */}
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

                  {/* Nút Kiểm tra lại: nếu có chọn thì check đã chọn, nếu không chọn thì check tất cả */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const toCheckAccounts =
                        selectedIds.length > 0
                          ? filteredAccounts.filter((a) =>
                              selectedIds.includes(a.id),
                            )
                          : filteredAccounts;
                      const toCheckPages: {
                        acc: FacebookAccount;
                        page: FacebookPageItem;
                      }[] = [];
                      for (const a of filteredAccounts) {
                        for (const p of a.pages || []) {
                          if (
                            selectedIds.length === 0 ||
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
                    className="h-7 text-[11px] gap-1 cursor-pointer bg-background hover:bg-muted"
                  >
                    <RefreshCw className="size-3" />
                    <span>
                      {selectedIds.length > 0
                        ? `${tr("Kiểm tra lại", "Re-check")} (${selectedIds.length})`
                        : tr("Kiểm tra tất cả", "Re-check all")}
                    </span>
                  </Button>

                  {/* Nút Liên kết NVC (nếu ở tab NVC) */}
                  {currentPage === "nvc" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleBulkLinkNvc()}
                      className="h-7 text-[11px] gap-1 cursor-pointer bg-blue-500/10 text-blue-500 border-blue-500/30 hover:bg-blue-500/20"
                      title={tr(
                        "Liên kết các tài khoản vào Nhiệm Vụ Chéo",
                        "Link accounts to NVC",
                      )}
                    >
                      <Link2 className="size-3" />
                      <span>
                        {selectedIds.length > 0
                          ? `${tr("Liên kết NVC", "Link NVC")} (${selectedIds.length})`
                          : tr("Liên kết tất cả", "Link all")}
                      </span>
                    </Button>
                  )}

                  {/* Nút Xóa vĩnh viễn (chỉ sáng khi có chọn) */}
                  {selectedIds.length > 0 && (
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
                  )}

                  {/* Nút Chạy: Chạy đã chọn hoặc Chạy tất cả */}
                  <Button
                    size="sm"
                    onClick={() => {
                      if (selectedIds.length > 0) {
                        handleRunSelected();
                      } else {
                        // Chạy tất cả các tài khoản đang hiển thị
                        for (const acc of filteredAccounts) {
                          handleRunAccount(acc);
                        }
                      }
                    }}
                    className="h-7 text-[11px] gap-1.5 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
                  >
                    <Play className="size-3 fill-current" />
                    <span>
                      {selectedIds.length > 0
                        ? `${tr("Chạy", "Run")} (${selectedIds.length})`
                        : `${tr("Chạy tất cả", "Run all")} (${filteredAccounts.length})`}
                    </span>
                  </Button>
                </div>
              </div>

              {/* Table / Grid View Container */}
              <div className="flex flex-1 flex-col rounded-lg border border-border/60 bg-background overflow-hidden shadow-xs">
                {/* Header thanh điều hướng chế độ xem */}
                {effectiveViewMode === "grid" && filteredAccounts.length > 0 ? (
                  <div className="flex items-center justify-between px-3.5 py-2 text-xs font-semibold text-muted-foreground border-b border-border/60 bg-muted/20 select-none shrink-0">
                    <div className="flex items-center gap-2.5">
                      <Checkbox
                        checked={
                          getAllSelectableIds().length > 0 &&
                          selectedIds.length === getAllSelectableIds().length
                        }
                        onCheckedChange={toggleSelectAll}
                      />
                      <span className="text-xs font-semibold text-foreground">
                        {tr("Chọn tất cả", "Select all")} ({filteredAccounts.length}{" "}
                        {tr("tài khoản", "accounts")})
                      </span>
                    </div>
                    {currentPlatform !== "tiktok" && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground font-medium">
                          {tr("Chế độ xem:", "View:")}
                        </span>
                        <div className="flex items-center gap-0.5 bg-muted/60 p-0.5 rounded-md border border-border/50">
                          <button
                            type="button"
                            onClick={() => handleSetViewMode("table")}
                            title={tr("Dạng dài (Bảng chi tiết)", "Table view")}
                            className="p-1 rounded transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
                          >
                            <LayoutList className="size-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetViewMode("grid")}
                            title={tr("Dạng thẻ (Card lưới)", "Card/Grid view")}
                            className="p-1 rounded transition-colors cursor-pointer bg-background text-foreground shadow-2xs font-semibold"
                          >
                            <LayoutGrid className="size-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Table Header */
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
                    <div>{tr("LIÊN KẾT", "LINKED")}</div>
                    <div>Proxy / VPN</div>
                    <div>{tr("TRẠNG THÁI", "STATUS")}</div>
                    <div>{tr("HÀNH ĐỘNG", "ACTION / STATE")}</div>
                    <div className="flex items-center justify-end gap-2 pr-1">
                      <span>{tr("Thao tác", "Actions")}</span>
                      <div className="flex items-center gap-0.5 bg-muted/60 p-0.5 rounded-md border border-border/50">
                        <button
                          type="button"
                          onClick={() => handleSetViewMode("table")}
                          title={tr("Dạng dài (Bảng chi tiết)", "Table view")}
                          className="p-1 rounded transition-colors cursor-pointer bg-background text-foreground shadow-2xs font-semibold"
                        >
                          <LayoutList className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetViewMode("grid")}
                          title={tr("Dạng thẻ (Card lưới)", "Card/Grid view")}
                          className="p-1 rounded transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
                        >
                          <LayoutGrid className="size-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

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
                    ) : currentPage === "nvc" && !nvcAccount.isLoggedIn ? (
                      <div className="flex flex-col items-center gap-2.5">
                        <div className="flex size-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
                          <ShieldCheck className="size-6" />
                        </div>
                        <p className="text-xs font-semibold text-foreground">
                          {tr(
                            "Chưa kết nối tài khoản Nhiệm Vụ Chéo",
                            "NVC account not connected",
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground max-w-xs leading-relaxed">
                          {tr(
                            "Vui lòng đăng nhập tài khoản NVC để quản lý và tự động hóa tài khoản.",
                            "Please sign in to NVC account to manage and automate accounts.",
                          )}
                        </p>
                        <Button
                          size="sm"
                          onClick={() => setIsNvcLoginOpen(true)}
                          className="mt-2 h-7.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer gap-1.5"
                        >
                          <Key className="size-3.5" />
                          <span>
                            {tr(
                              "Đăng nhập tài khoản NVC",
                              "Sign in NVC account",
                            )}
                          </span>
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div
                          className={cn(
                            "flex size-12 items-center justify-center rounded-xl",
                            currentPlatform === "tiktok"
                              ? "bg-foreground/10 text-foreground border border-border/40"
                              : currentPlatform === "instagram"
                                ? "bg-[#E1306C]/10 text-[#E1306C]"
                                : "bg-[#1877F2]/10 text-[#1877F2]",
                          )}
                        >
                          {currentPlatform === "tiktok" ? (
                            <TiktokIcon className="size-6 text-foreground" />
                          ) : currentPlatform === "instagram" ? (
                            <FaInstagram className="size-6" />
                          ) : (
                            <FaFacebook className="size-6" />
                          )}
                        </div>
                        <p className="text-xs font-semibold text-foreground">
                          {currentPlatform === "tiktok"
                            ? tr(
                                "Chưa có tài khoản TikTok nào",
                                "No TikTok accounts yet",
                              )
                            : currentPlatform === "instagram"
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
                            `Bấm nút "+ Mới" ở góc trên bên phải để thêm tài khoản ${
                              currentPlatform === "tiktok"
                                ? "TikTok"
                                : currentPlatform === "instagram"
                                  ? "Instagram"
                                  : "Facebook"
                            }.`,
                            `Click "+ New" button at top right to add a ${
                              currentPlatform === "tiktok"
                                ? "TikTok"
                                : currentPlatform === "instagram"
                                  ? "Instagram"
                                  : "Facebook"
                            } account.`,
                          )}
                        </p>
                        <Button
                          size="sm"
                          onClick={() => setIsAddFacebookOpen(true)}
                          className="mt-2 h-7.5 text-xs cursor-pointer gap-1.5"
                        >
                          <Plus className="size-3.5" />
                          <span>
                            {currentPlatform === "tiktok"
                              ? tr(
                                  "Thêm tài khoản TikTok",
                                  "Add TikTok Account",
                                )
                              : currentPlatform === "instagram"
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
                ) : effectiveViewMode === "grid" ? (
                  <AccountGridView
                    accounts={filteredAccounts}
                    selectedIds={selectedIds}
                    onToggleSelectOne={toggleSelectOne}
                    checkingIds={checkingIds}
                    runnerStates={runnerStates}
                    currentPage={currentPage}
                    nvcLinkedUids={nvcLinkedUids}
                    nvcLinkingIds={nvcLinkingIds}
                    onLinkNvcAccount={(acc) => void handleLinkNvcAccount(acc)}
                    dolikeLinkedUsernames={dolikeLinkedUsernames}
                    dolikeLinkingIds={dolikeLinkingIds}
                    onLinkDolikeAccount={(acc) => void handleLinkDolikeAccount(acc)}
                    xsmmLinkingIds={xsmmLinkingIds}
                    onLinkXsmmAccount={(acc) => void handleLinkXsmmAccount(acc)}
                    onCheckAccount={(acc) => void handleCheckAccount(acc)}
                    onRunAccount={(acc) => void handleRunAccount(acc)}
                    onDeleteAccount={handleDeleteAccount}
                    onDetailAccount={(acc) => {
                      setDetailAccount(acc);
                      setIsDetailOpen(true);
                    }}
                    onCheckPage={handleCheckPage}
                    onRunPage={handleRunPage}
                    tr={tr}
                  />
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

                            {/* LIÊN KẾT */}
                            <div className="text-muted-foreground truncate pr-2 flex items-center gap-1.5">
                              {currentPage === "nvc" ? (
                                (() => {
                                  const isLinked = nvcLinkedUids.includes(acc.uid);
                                  const isLinking = nvcLinkingIds.includes(acc.id);

                                  if (isLinked) {
                                    return (
                                      <span
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 whitespace-nowrap"
                                        title={tr(
                                          "Đã liên kết trên Nhiệm Vụ Chéo",
                                          "Linked on NVC",
                                        )}
                                      >
                                        <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                                        {tr("Đã liên kết", "Linked")}
                                      </span>
                                    );
                                  }

                                  return (
                                    <button
                                      type="button"
                                      disabled={isLinking}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void handleLinkNvcAccount(acc);
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20 hover:bg-blue-500/20 transition-colors cursor-pointer whitespace-nowrap"
                                      title={tr(
                                        "Nhấn để liên kết tài khoản vào Nhiệm Vụ Chéo",
                                        "Click to link account to NVC",
                                      )}
                                    >
                                      {isLinking ? (
                                        <>
                                          <RefreshCw className="size-2.5 animate-spin shrink-0" />
                                          <span>
                                            {tr("Đang liên kết...", "Linking...")}
                                          </span>
                                        </>
                                      ) : (
                                        <>
                                          <Link2 className="size-2.5 shrink-0" />
                                          <span>
                                            {tr("Chưa liên kết", "Unlinked")}
                                          </span>
                                        </>
                                      )}
                                    </button>
                                  );
                                })()
                              ) : acc.token ? (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 whitespace-nowrap"
                                  title={tr(
                                    "Đã liên kết token vào hệ thống",
                                    "Linked with token",
                                  )}
                                >
                                  <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                                  {tr("Đã liên kết", "Linked")}
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-muted text-muted-foreground border border-border/40 whitespace-nowrap"
                                  title={tr("Chưa liên kết", "Not linked")}
                                >
                                  <span className="size-1.5 rounded-full bg-muted-foreground/60 shrink-0" />
                                  {tr("Chưa liên kết", "Unlinked")}
                                </span>
                              )}
                              {acc.twoFactor ? (
                                <span className="text-[10px] font-mono text-muted-foreground/80 px-1 py-0.5 rounded bg-muted/40 border border-border/30">
                                  2FA
                                </span>
                              ) : null}
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
                              ) : acc.isLive === true || acc.status === "live" ? (
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
                                      {currentPage === "nvc" ? (
                                        (() => {
                                          const isPageLinked =
                                            nvcLinkedUids.includes(displayUid);
                                          const isPageLinking =
                                            nvcLinkingIds.includes(pageKey);

                                          if (isPageLinked) {
                                            return (
                                              <span
                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 whitespace-nowrap"
                                                title={tr(
                                                  "Page đã liên kết trên Nhiệm Vụ Chéo",
                                                  "Page linked on NVC",
                                                )}
                                              >
                                                <span className="size-1 rounded-full bg-emerald-500 shrink-0" />
                                                {tr("Đã liên kết", "Linked")}
                                              </span>
                                            );
                                          }

                                          return (
                                            <button
                                              type="button"
                                              disabled={isPageLinking}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                void handleLinkNvcPage(
                                                  pageKey,
                                                  displayUid,
                                                );
                                              }}
                                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20 hover:bg-blue-500/20 transition-colors cursor-pointer whitespace-nowrap"
                                              title={tr(
                                                "Nhấn để liên kết Page vào Nhiệm Vụ Chéo",
                                                "Click to link Page to NVC",
                                              )}
                                            >
                                              {isPageLinking ? (
                                                <>
                                                  <RefreshCw className="size-2 animate-spin shrink-0" />
                                                  <span>
                                                    {tr(
                                                      "Đang liên kết...",
                                                      "Linking...",
                                                    )}
                                                  </span>
                                                </>
                                              ) : (
                                                <>
                                                  <Link2 className="size-2 shrink-0" />
                                                  <span>
                                                    {tr(
                                                      "Chưa liên kết",
                                                      "Unlinked",
                                                    )}
                                                  </span>
                                                </>
                                              )}
                                            </button>
                                          );
                                        })()
                                      ) : p.pageToken ? (
                                        <span
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 whitespace-nowrap"
                                          title={tr(
                                            "Page đã có token liên kết",
                                            "Page linked with token",
                                          )}
                                        >
                                          <span className="size-1 rounded-full bg-emerald-500 shrink-0" />
                                          {tr("Đã liên kết", "Linked")}
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-medium bg-muted text-muted-foreground border border-border/40 whitespace-nowrap">
                                          <span className="size-1 rounded-full bg-muted-foreground/60 shrink-0" />
                                          {tr("Chưa liên kết", "Unlinked")}
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

          {currentPage === "ttc" && (
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
                  <div>{tr("LIÊN KẾT", "LINKED")}</div>
                  <div>{tr("TRẠNG THÁI TÀI KHOẢN", "ACCOUNT STATUS")}</div>
                  <div>{tr("HÀNH ĐỘNG", "ACTION")}</div>
                  <div className="text-right">#</div>
                </div>

                {/* Empty State */}
                <div className="flex flex-1 flex-col items-center justify-center py-20 text-center">
                  <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm mb-3">
                    TTC
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {tr(
                      "Chưa có tài khoản TTC nào",
                      "No TTC accounts yet",
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    {tr(
                      "Giao diện TTC đã sẵn sàng. Logic kết nối và làm nhiệm vụ sẽ được cấu hình trong bước tiếp theo.",
                      "TTC interface is ready. Task connection logic will be configured in subsequent updates.",
                    )}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {currentPage === "dolike" && (
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: MOTION_EASE_OUT }}
              className="flex w-full flex-1 flex-col"
            >
              {/* Actions Toolbar DoLike: Luôn luôn hiển thị */}
              <div className="mb-2.5 flex items-center justify-between px-3.5 py-1.5 rounded-xl bg-muted/40 border border-border/60 shadow-xs">
                <div className="flex items-center gap-2 text-xs">
                  {selectedIds.length > 0 ? (
                    <>
                      <span className="font-medium text-foreground">
                        {tr("Đã chọn:", "Selected:")}
                      </span>
                      <span className="rounded bg-primary/20 px-1.5 py-0.5 font-bold text-primary text-[11px]">
                        {selectedIds.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedIds([])}
                        className="text-[11px] text-muted-foreground hover:text-foreground underline cursor-pointer ml-1"
                      >
                        {tr("Bỏ chọn", "Deselect")}
                      </button>
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      {tr("Tất cả:", "Total:")}{" "}
                      <strong className="text-foreground">
                        {filteredAccounts.length}
                      </strong>{" "}
                      {tr("tài khoản", "accounts")}
                    </span>
                  )}
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

                  {/* Nút Kiểm tra lại */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const toCheckAccounts =
                        selectedIds.length > 0
                          ? filteredAccounts.filter((a) =>
                              selectedIds.includes(a.id),
                            )
                          : filteredAccounts;
                      void (async () => {
                        for (const acc of toCheckAccounts) {
                          await handleCheckAccount(acc);
                          const safeDelay =
                            1200 + Math.floor(Math.random() * 800);
                          await new Promise((r) => setTimeout(r, safeDelay));
                        }
                      })();
                    }}
                    className="h-7 text-[11px] gap-1 cursor-pointer bg-background hover:bg-muted"
                  >
                    <RefreshCw className="size-3" />
                    <span>
                      {selectedIds.length > 0
                        ? `${tr("Kiểm tra lại", "Re-check")} (${selectedIds.length})`
                        : tr("Kiểm tra tất cả", "Re-check all")}
                    </span>
                  </Button>

                  {/* Nút Liên kết DoLike */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleBulkLinkDolike()}
                    disabled={dolikeLinkingIds.length > 0}
                    className="h-7 text-[11px] gap-1 cursor-pointer text-fuchsia-400 border-fuchsia-500/30 hover:bg-fuchsia-500/10 font-medium"
                    title={tr(
                      "Kiểm tra và liên kết các tài khoản Instagram vào DoLike",
                      "Check and link Instagram accounts to DoLike",
                    )}
                  >
                    {dolikeLinkingIds.length > 0 ? (
                      <RefreshCw className="size-3 animate-spin" />
                    ) : (
                      <Link2 className="size-3" />
                    )}
                    <span>
                      {dolikeLinkingIds.length > 0
                        ? tr("Đang liên kết...", "Linking...")
                        : selectedIds.length > 0
                          ? `${tr("Liên kết DoLike", "Link DoLike")} (${selectedIds.length})`
                          : tr("Liên kết tất cả", "Link all")}
                    </span>
                  </Button>

                  {/* Nút Xóa vĩnh viễn (chỉ sáng khi có chọn) */}
                  {selectedIds.length > 0 && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        const count = selectedIds.length;
                        setAccounts((prev) => {
                          const updated = prev
                            .map((a) => {
                              if (!selectedIds.includes(a.id)) return a;
                              if (a.dolikeEmail) {
                                return {
                                  ...a,
                                  uid: "",
                                  name: "",
                                  cookie: undefined,
                                  token: undefined,
                                  pass: undefined,
                                  twoFactor: undefined,
                                  avatar: undefined,
                                  cover: undefined,
                                  rawText: "",
                                  proxy: undefined,
                                  status: "unverified" as const,
                                  isLive: undefined,
                                  note: undefined,
                                  tag: undefined,
                                  isDolike: true,
                                };
                              }
                              return null;
                            })
                            .filter((a): a is FacebookAccount => a !== null);
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
                            `Đã xóa nick Instagram của ${count} mục đã chọn, vẫn giữ lại tài khoản DoLike!`,
                            `Deleted Instagram of ${count} items, kept DoLike accounts!`,
                          ),
                        );
                      }}
                      className="h-7 text-[11px] gap-1 cursor-pointer"
                    >
                      <Trash2 className="size-3" />
                      <span>{tr("Xóa vĩnh viễn", "Delete permanently")}</span>
                    </Button>
                  )}

                  {/* Nút Chạy: Chạy đã chọn hoặc Chạy tất cả */}
                  <Button
                    size="sm"
                    onClick={() => {
                      if (selectedIds.length > 0) {
                        void handleRunSelected();
                      } else {
                        // Chạy tất cả các tài khoản đang hiển thị
                        for (const acc of filteredAccounts) {
                          void handleRunAccount(acc);
                        }
                      }
                    }}
                    className="h-7 text-[11px] gap-1.5 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
                  >
                    <Play className="size-3 fill-current" />
                    <span>
                      {selectedIds.length > 0
                        ? `${tr("Chạy", "Run")} (${selectedIds.length})`
                        : `${tr("Chạy tất cả", "Run all")} (${filteredAccounts.length})`}
                    </span>
                  </Button>
                </div>
              </div>

              {/* Table / Grid View Container matching XSMM */}
              <div className="flex flex-1 flex-col rounded-lg border border-border/60 bg-background overflow-hidden shadow-xs">
                {/* Header thanh điều hướng chế độ xem */}
                {effectiveViewMode === "grid" && filteredAccounts.length > 0 ? (
                  <div className="flex items-center justify-between px-3.5 py-2 text-xs font-semibold text-muted-foreground border-b border-border/60 bg-muted/20 select-none shrink-0">
                    <div className="flex items-center gap-2.5">
                      <Checkbox
                        checked={
                          getAllSelectableIds().length > 0 &&
                          selectedIds.length === getAllSelectableIds().length
                        }
                        onCheckedChange={toggleSelectAll}
                      />
                      <span className="text-xs font-semibold text-foreground">
                        {tr("Chọn tất cả", "Select all")} ({filteredAccounts.length}{" "}
                        {tr("tài khoản", "accounts")})
                      </span>
                    </div>
                    {currentPlatform !== "tiktok" && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground font-medium">
                          {tr("Chế độ xem:", "View:")}
                        </span>
                        <div className="flex items-center gap-0.5 bg-muted/60 p-0.5 rounded-md border border-border/50">
                          <button
                            type="button"
                            onClick={() => handleSetViewMode("table")}
                            title={tr("Dạng dài (Bảng chi tiết)", "Table view")}
                            className="p-1 rounded transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
                          >
                            <LayoutList className="size-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetViewMode("grid")}
                            title={tr("Dạng thẻ (Card lưới)", "Card/Grid view")}
                            className="p-1 rounded transition-colors cursor-pointer bg-background text-foreground shadow-2xs font-semibold"
                          >
                            <LayoutGrid className="size-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Table Header đồng bộ chuẩn NVC và XSMM */
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
                    <div>{tr("LIÊN KẾT", "LINKED")}</div>
                    <div>Proxy / VPN</div>
                    <div>{tr("TRẠNG THÁI", "STATUS")}</div>
                    <div>{tr("HÀNH ĐỘNG", "ACTION / STATE")}</div>
                    <div className="flex items-center justify-end gap-2 pr-1">
                      <span>{tr("Thao tác", "Actions")}</span>
                      <div className="flex items-center gap-0.5 bg-muted/60 p-0.5 rounded-md border border-border/50">
                        <button
                          type="button"
                          onClick={() => handleSetViewMode("table")}
                          title={tr("Dạng dài (Bảng chi tiết)", "Table view")}
                          className="p-1 rounded transition-colors cursor-pointer bg-background text-foreground shadow-2xs font-semibold"
                        >
                          <LayoutList className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetViewMode("grid")}
                          title={tr("Dạng thẻ (Card lưới)", "Card/Grid view")}
                          className="p-1 rounded transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
                        >
                          <LayoutGrid className="size-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Table Rows or Empty State */}
                {filteredAccounts.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center py-28 text-center select-none">
                    {!dolikeAccount.isLoggedIn ? (
                      <div className="flex flex-col items-center gap-2.5">
                        <div className="flex size-12 items-center justify-center rounded-xl bg-fuchsia-500/10 text-fuchsia-500 border border-fuchsia-500/20">
                          <ShieldCheck className="size-6" />
                        </div>
                        <p className="text-xs font-semibold text-foreground">
                          {tr(
                            "Chưa kết nối tài khoản DoLike",
                            "DoLike account not connected",
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground max-w-xs leading-relaxed">
                          {tr(
                            "Vui lòng đăng nhập tài khoản DoLike để quản lý và tự động hóa kiếm tiền với Instagram.",
                            "Please sign in to DoLike account to manage and automate Instagram tasks.",
                          )}
                        </p>
                        <Button
                          size="sm"
                          onClick={() => setIsDolikeLoginOpen(true)}
                          className="mt-2 h-7.5 text-xs bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-semibold cursor-pointer gap-1.5"
                        >
                          <Key className="size-3.5" />
                          <span>
                            {tr(
                              "Đăng nhập tài khoản DoLike",
                              "Sign in DoLike account",
                            )}
                          </span>
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex size-12 items-center justify-center rounded-xl bg-[#E1306C]/10 text-[#E1306C]">
                          <FaInstagram className="size-6" />
                        </div>
                        <p className="text-xs font-semibold text-foreground">
                          {tr(
                            "Chưa có tài khoản Instagram nào",
                            "No Instagram accounts yet",
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {tr(
                            'Bấm nút "+ Mới" ở góc trên bên phải để thêm tài khoản Instagram chạy DoLike.',
                            'Click "+ New" button at top right to add Instagram account for DoLike.',
                          )}
                        </p>
                        <Button
                          size="sm"
                          onClick={() => setIsAddFacebookOpen(true)}
                          className="mt-2 h-7.5 text-xs cursor-pointer gap-1.5"
                        >
                          <Plus className="size-3.5" />
                          <span>
                            {tr(
                              "Thêm tài khoản Instagram",
                              "Add Instagram Account",
                            )}
                          </span>
                        </Button>
                      </div>
                    )}
                  </div>
                ) : effectiveViewMode === "grid" ? (
                  <AccountGridView
                    accounts={filteredAccounts}
                    selectedIds={selectedIds}
                    onToggleSelectOne={toggleSelectOne}
                    checkingIds={checkingIds}
                    runnerStates={runnerStates}
                    currentPage={currentPage}
                    nvcLinkedUids={nvcLinkedUids}
                    nvcLinkingIds={nvcLinkingIds}
                    onLinkNvcAccount={(acc) => void handleLinkNvcAccount(acc)}
                    dolikeLinkedUsernames={dolikeLinkedUsernames}
                    dolikeLinkingIds={dolikeLinkingIds}
                    onLinkDolikeAccount={(acc) => void handleLinkDolikeAccount(acc)}
                    xsmmLinkingIds={xsmmLinkingIds}
                    onLinkXsmmAccount={(acc) => void handleLinkXsmmAccount(acc)}
                    onCheckAccount={(acc) => void handleCheckAccount(acc)}
                    onRunAccount={(acc) => void handleRunAccount(acc)}
                    onDeleteAccount={handleDeleteAccount}
                    onDetailAccount={(acc) => {
                      setDetailAccount(acc);
                      setIsDetailOpen(true);
                    }}
                    onCheckPage={handleCheckPage}
                    onRunPage={handleRunPage}
                    tr={tr}
                  />
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
                      const avatarSrc = isCheckpointOrDie
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
                                target.closest("a") ||
                                target.closest('[role="checkbox"]')
                              ) {
                                return;
                              }
                              toggleSelectOne(acc.id);
                            }}
                            className={cn(
                              "grid grid-cols-[40px_2.8fr_1.2fr_1.5fr_1.2fr_1.5fr_125px] items-center px-3 py-2 text-xs text-foreground cursor-pointer hover:bg-muted/40 transition-colors select-none outline-none focus-visible:bg-muted/50",
                              isRunning && "bg-emerald-500/5",
                              isSelected &&
                                "bg-primary/10 border-l-2 border-primary",
                            )}
                          >
                            {/* Checkbox */}
                            <div className="flex items-center justify-center">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelectOne(acc.id)}
                              />
                            </div>

                            {/* Tên & UID */}
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <AccountAvatar
                                url={avatarSrc}
                                isInstagram={acc.platform === "instagram" || true}
                              />
                              <div className="flex flex-col min-w-0">
                                {acc.name || acc.uid ? (
                                  <>
                                    <span className="font-medium truncate text-foreground leading-tight">
                                      {acc.name || acc.uid}
                                    </span>
                                    <span className="text-[10px] font-mono text-muted-foreground truncate leading-tight">
                                      UID: {acc.uid}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedIds([acc.id]);
                                        setIsAddFacebookOpen(true);
                                      }}
                                      className="text-left font-semibold text-xs text-[#E1306C] hover:underline cursor-pointer flex items-center gap-1 leading-tight"
                                      title={tr(
                                        "Gán hoặc thêm nick Instagram",
                                        "Add Instagram account",
                                      )}
                                    >
                                      <Plus className="size-3" />
                                      <span>
                                        {tr(
                                          "Thêm nick Instagram",
                                          "Add Instagram",
                                        )}
                                      </span>
                                    </button>
                                    <span className="text-[10px] text-muted-foreground truncate leading-tight">
                                      {tr("Chưa gán nick IG", "No IG linked yet")}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Cột 3 (1.2fr): LIÊN KẾT DoLike */}
                            <div className="text-muted-foreground truncate pr-2 flex items-center gap-1.5 flex-wrap">
                              {(() => {
                                const cleanUser = (acc.name || acc.uid || "")
                                  .replace(/^@/, "")
                                  .trim()
                                  .toLowerCase();
                                const isLinked =
                                  acc.dolikeLinked === true ||
                                  (cleanUser ? dolikeLinkedUsernames.includes(cleanUser) : false);
                                const isLinking = dolikeLinkingIds.includes(acc.id);

                                if (isLinked) {
                                  return (
                                    <span
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 whitespace-nowrap"
                                      title={tr(
                                        "Tài khoản Instagram này đã được liên kết trên DoLike",
                                        "This Instagram account is linked to DoLike",
                                      )}
                                    >
                                      <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                                      <Link2 className="size-2.5 shrink-0" />
                                      <span>{tr("Đã liên kết", "Linked")}</span>
                                    </span>
                                  );
                                }

                                return (
                                  <button
                                    type="button"
                                    disabled={isLinking}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void handleLinkDolikeAccount(acc);
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20 transition-colors cursor-pointer whitespace-nowrap"
                                    title={tr(
                                      "Nhấn để kiểm tra và liên kết tài khoản Instagram này vào DoLike",
                                      "Click to check and link this Instagram account to DoLike",
                                    )}
                                  >
                                    {isLinking ? (
                                      <>
                                        <RefreshCw className="size-2.5 animate-spin shrink-0" />
                                        <span>
                                          {tr("Đang liên kết...", "Linking...")}
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <Link2 className="size-2.5 shrink-0" />
                                        <span>
                                          {tr("Chưa liên kết", "Unlinked")}
                                        </span>
                                      </>
                                    )}
                                  </button>
                                );
                              })()}
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
                              ) : acc.isLive === true || acc.status === "live" ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 whitespace-nowrap">
                                  Live
                                </span>
                              ) : acc.isLive === false ||
                                acc.status === "die" ||
                                acc.status === "checkpoint" ? (
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
                              {/* Xem thông tin */}
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

                              {/* Kiểm tra lại */}
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

                              {/* Chạy / Dừng */}
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

                              {/* Xóa */}
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
                        </div>
                      );
                    })}
                  </div>
                )}
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

          {currentPage === "overview" && (
            <OverviewView
              accounts={accounts}
              xsmmAccount={xsmmAccount}
              nvcAccount={nvcAccount}
              dolikeAccount={{
                email: dolikeAccount.email,
                balance: dolikeAccount.balance,
                isLoggedIn: dolikeAccount.isLoggedIn,
              }}
              licenseInfo={licenseInfo}
              onNavigate={(page) => setCurrentPage(page)}
              onSelectPlatform={(plat) => setCurrentPlatform(plat)}
              onOpenJobConfig={() => setIsJobConfigOpen(true)}
              onOpenXsmmLogin={() => setIsXsmmLoginOpen(true)}
              onOpenNvcLogin={() => setIsNvcLoginOpen(true)}
              onOpenDolikeLogin={() => setIsDolikeLoginOpen(true)}
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
        hideXsmmAuth={currentPage === "dolike" || currentPlatform === "instagram"}
        platform={currentPlatform}
        onXsmmLoginSuccess={handleXsmmLoginSuccess}
      />

      {/* Dialog Đăng nhập XSMM */}
      <XsmmLoginDialog
        isOpen={isXsmmLoginOpen}
        onClose={() => setIsXsmmLoginOpen(false)}
        onLoginSuccess={handleXsmmLoginSuccess}
      />

      {/* Dialog Đăng nhập NVC */}
      <NvcLoginDialog
        isOpen={isNvcLoginOpen}
        onClose={() => setIsNvcLoginOpen(false)}
        onLoginSuccess={handleNvcLoginSuccess}
      />

      {/* Dialog Đăng nhập DoLike */}
      <DolikeLoginDialog
        isOpen={isDolikeLoginOpen}
        onClose={() => setIsDolikeLoginOpen(false)}
        onLoginSuccess={handleDolikeLoginSuccess}
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
                  tiktokAccounts: updated.tiktokAccounts || a.tiktokAccounts,
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
        platform={currentPlatform}
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
