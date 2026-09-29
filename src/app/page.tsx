"use client";

import {
  CircleAlert,
  Flag,
  Key,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
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
import { KeyLoginScreen } from "@/components/key-login-screen";
import { type AppPage, RailNav } from "@/components/rail-nav";
import { RegPageView } from "@/components/reg-page-view";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { UtilitiesDialog } from "@/components/utilities-dialog";
import { XsmmLoginDialog } from "@/components/xsmm-login-dialog";
import {
  checkCookieLive,
  checkUidLive,
  facebookLogin,
  fetchAccountDetailsWithToken,
  getTokenAndInfoFromCookie,
} from "@/lib/facebook-api";
import { checkCookieIg, fetchIgUserInfo } from "@/lib/instagram-api";
import { MOTION_EASE_OUT } from "@/lib/motion";
import { showSuccessToast } from "@/lib/toast-utils";
import { cn } from "@/lib/utils";
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
  const { t, i18n } = useTranslation();
  const isVi = (i18n.language?.split("-")[0] || "vi") === "vi";
  const tr = (vi: string, en: string) => (isVi ? vi : en);
  // License: always start locked, recheck saved key silently on mount
  const [savedLicenseKey] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("app_license_key") ?? "";
  });
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<AppPage>("profiles");
  const [aboutDialogOpen, setAboutDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [isAddFacebookOpen, setIsAddFacebookOpen] = useState(false);
  const [isXsmmLoginOpen, setIsXsmmLoginOpen] = useState(false);
  const [isUtilitiesChoiceOpen, setIsUtilitiesChoiceOpen] = useState(false);
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
        if (Array.isArray(parsed)) {
          return parsed.map((acc: FacebookAccount) => {
            const cleanAcc = { ...acc };
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
        return {
          ...prev,
          balance: `${newPts.toLocaleString("vi-VN")} xu`,
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
    if (targetAccount.platform === "instagram") {
      setCheckingIds((prev) => [...prev, targetAccount.id]);
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
          if (!finalUsername || /^\d+$/.test(finalUsername)) {
            const uInfo = await fetchIgUserInfo(realUid, proxyParam);
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

          const updated: Partial<FacebookAccount> = {
            cookie,
            status: (info.isLive ? "live" : "checkpoint") as
              | "live"
              | "checkpoint"
              | "die",
            name: finalUsername ? `@${finalUsername}` : "",
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
        }
      } catch {
        // ignore
      } finally {
        setCheckingIds((prev) => prev.filter((id) => id !== targetAccount.id));
      }
      return;
    }

    setCheckingIds((prev) => [...prev, targetAccount.id]);
    try {
      const proxyParam =
        targetAccount.proxy && targetAccount.proxy !== "Chưa chọn"
          ? targetAccount.proxy
          : undefined;

      let isLive = false;
      let accountStatus: "live" | "checkpoint" | "die" = "die";
      let fetchedUid = targetAccount.uid;
      let fetchedName = targetAccount.name;
      let fetchedAvatar = targetAccount.avatar;
      let fetchedCover = targetAccount.cover;
      let fetchedMail = targetAccount.mail;
      let fetchedToken = targetAccount.token;
      let fetchedCookie = targetAccount.cookie;

      const hasCookie = Boolean(
        fetchedCookie &&
          (fetchedCookie.includes("c_user=") || fetchedCookie.includes("xs=")),
      );
      const hasToken = Boolean(fetchedToken?.trim().startsWith("EAA"));
      const hasPassword = Boolean(targetAccount.pass?.trim());
      const hasUid = Boolean(fetchedUid && /^\d+$/.test(fetchedUid.trim()));

      // 1. Nếu có Cookie: Ưu tiên kiểm tra Cookie vì đây là session đăng nhập chính
      if (hasCookie && fetchedCookie) {
        try {
          const cookieInfo = await getTokenAndInfoFromCookie(
            fetchedCookie,
            proxyParam,
          );
          if (cookieInfo.isLive) {
            isLive = true;
            accountStatus = "live";
            if (cookieInfo.token && !fetchedToken)
              fetchedToken = cookieInfo.token;
            if (cookieInfo.name) fetchedName = cookieInfo.name;
            if (cookieInfo.avatar) fetchedAvatar = cookieInfo.avatar;
            if (cookieInfo.cover) fetchedCover = cookieInfo.cover;
            if (cookieInfo.email) fetchedMail = cookieInfo.email;
            if (
              cookieInfo.uid &&
              (!fetchedUid || fetchedUid.startsWith("acc_"))
            ) {
              fetchedUid = cookieInfo.uid;
            }
          } else {
            const mbasicCheck = await checkCookieLive(
              fetchedCookie,
              proxyParam,
            );
            if (mbasicCheck.isLive) {
              isLive = true;
              accountStatus = "live";
              if (mbasicCheck.name && !fetchedName)
                fetchedName = mbasicCheck.name;
              if (
                mbasicCheck.uid &&
                (!fetchedUid || fetchedUid.startsWith("acc_"))
              ) {
                fetchedUid = mbasicCheck.uid;
              }
            } else {
              isLive = false;
              accountStatus =
                mbasicCheck.status === "checkpoint" ||
                cookieInfo.error?.toLowerCase().includes("checkpoint")
                  ? "checkpoint"
                  : "die";
            }
          }
        } catch {
          isLive = false;
          accountStatus = "die";
        }
      }

      // 2. Nếu có Token (và chưa Live từ Cookie)
      if (!isLive && hasToken && fetchedToken) {
        try {
          const info = await fetchAccountDetailsWithToken(
            fetchedToken,
            proxyParam,
          );
          if (info.isLive) {
            isLive = true;
            accountStatus = "live";
            if (info.uid && (!fetchedUid || !/^\d+$/.test(fetchedUid))) {
              fetchedUid = info.uid;
            }
            if (info.name) fetchedName = info.name;
            if (info.avatar) fetchedAvatar = info.avatar;
            if (info.cover) fetchedCover = info.cover;
            if (info.email) fetchedMail = info.email;
          } else {
            isLive = false;
            accountStatus = info.error?.toLowerCase().includes("checkpoint")
              ? "checkpoint"
              : "die";
          }
        } catch {
          isLive = false;
          accountStatus = "die";
        }
      }

      // 3. Nếu chưa Live, không có Cookie/Token hoặc đã hỏng nhưng có Pass + UID: Thử đăng nhập API
      if (
        !isLive &&
        !hasCookie &&
        !hasToken &&
        hasUid &&
        hasPassword &&
        targetAccount.pass
      ) {
        try {
          const loginRes = await facebookLogin({
            email: fetchedUid,
            password: targetAccount.pass,
            auth2fa: targetAccount.twoFactor,
            cookie: fetchedCookie,
            proxy: proxyParam,
          });
          if (loginRes.success && loginRes.token) {
            isLive = true;
            accountStatus = "live";
            fetchedToken = loginRes.token;
            if (loginRes.cookie) fetchedCookie = loginRes.cookie;
            if (loginRes.uid && (!fetchedUid || !/^\d+$/.test(fetchedUid))) {
              fetchedUid = loginRes.uid;
            }
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
          } else {
            isLive = false;
            accountStatus = loginRes.error?.toLowerCase().includes("checkpoint")
              ? "checkpoint"
              : "die";
          }
        } catch {
          isLive = false;
          accountStatus = "die";
        }
      }

      // 4. Nếu chỉ có UID thuần (không có Cookie, không có Token, không có Pass)
      if (!isLive && !hasCookie && !hasToken && !hasPassword && hasUid) {
        try {
          const uidStatus = await checkUidLive(fetchedUid, proxyParam);
          if (uidStatus.isLive) {
            isLive = true;
            accountStatus = "live";
            if (uidStatus.name && !fetchedName) fetchedName = uidStatus.name;
            if (uidStatus.avatarUrl && !fetchedAvatar) {
              fetchedAvatar = uidStatus.avatarUrl;
            }
          } else {
            isLive = false;
            accountStatus = "die";
          }
        } catch {
          isLive = false;
          accountStatus = "die";
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
        status: (isLive ? "live" : accountStatus) as
          | "live"
          | "checkpoint"
          | "die",
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

  const handleRunSelected = () => {
    if (selectedIds.length === 0) return;
    const runnableAccounts = accounts.filter(
      (a) =>
        selectedIds.includes(a.id) &&
        a.status !== "checkpoint" &&
        a.status !== "die",
    );
    if (runnableAccounts.length === 0) {
      showSuccessToast(
        tr(
          "Các tài khoản được chọn đều bị Checkpoint/Die, không thể chạy!",
          "Selected accounts are Checkpoint/Die, cannot run!",
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

    xsmmRunner.startAccounts(runnableAccounts, savedToken);
    showSuccessToast(
      tr(
        `Bắt đầu chạy ${runnableAccounts.length} tài khoản hợp lệ trên XSMM!`,
        `Started running ${runnableAccounts.length} valid accounts on XSMM!`,
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
    <div className="flex h-dvh flex-col bg-background text-foreground font-(family-name:--font-geist-sans) overflow-hidden select-none">
      {/* Key login screen — shown when not unlocked; passes savedKey for auto-recheck */}
      {!isUnlocked && (
        <KeyLoginScreen
          autoCheckKey={savedLicenseKey || undefined}
          onUnlock={(key) => {
            localStorage.setItem("app_license_key", key);
            setIsUnlocked(true);
          }}
        />
      )}
      {/* Top titlebar với drag region & thông tin XSMM */}
      <AppHeader
        activePlatform={currentPlatform}
        onPlatformChange={setCurrentPlatform}
        pageTitle={getPageTitle(currentPage)}
        showXsmm={currentPage !== "account" && currentPage !== "reg-page"}
        xsmmAccount={xsmmAccount}
        onXsmmLoginClick={() => setIsXsmmLoginOpen(true)}
        onXsmmLogoutClick={handleXsmmLogout}
        onNewClick={() => setIsAddFacebookOpen(true)}
      />

      {/* Main content area */}
      <div className="flex min-h-0 flex-1 flex-col">
        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto px-6 py-5">
          {(currentPage === "profiles" || currentPage === "account") && (
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const toCheck = filteredAccounts.filter((a) =>
                          selectedIds.includes(a.id),
                        );
                        void (async () => {
                          for (const acc of toCheck) {
                            await handleCheckAccount(acc);
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
                          tr(
                            `Đã xóa vĩnh viễn ${selectedIds.length} tài khoản!`,
                            `Permanently deleted ${selectedIds.length} accounts!`,
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
                        filteredAccounts.length > 0 &&
                        selectedIds.length === filteredAccounts.length
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
                  <div className="divide-y divide-border/30 overflow-y-auto max-h-[calc(100vh-180px)]">
                    {filteredAccounts.map((acc) => {
                      const isChecking = checkingIds.includes(acc.id);
                      const isSelected = selectedIds.includes(acc.id);
                      const isCheckpointOrDie =
                        acc.status === "checkpoint" || acc.status === "die";
                      const runState = runnerStates.get(acc.id);
                      const isRunning = runState?.isRunning ?? false;
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
                            "grid grid-cols-[40px_2.8fr_1.2fr_1.5fr_1.2fr_1.5fr_125px] items-center px-3 py-1.5 min-h-[46px] h-[46px] text-xs text-foreground cursor-pointer transition-colors select-none outline-none focus-visible:bg-muted/50",
                            isSelected
                              ? "bg-primary/10 border-l-2 border-primary"
                              : isCheckpointOrDie
                                ? "bg-muted/30 opacity-60 hover:bg-muted/40"
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
                              <span className="text-[11px] font-mono">2FA</span>
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
                            ) : acc.status === "live" ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 whitespace-nowrap">
                                Live
                              </span>
                            ) : acc.status === "die" ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20 whitespace-nowrap">
                                Die
                              </span>
                            ) : acc.status === "checkpoint" ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20 whitespace-nowrap">
                                Checkpoint
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
                            ) : acc.note && acc.note !== "Không có ghi chú" ? (
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
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
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
        xsmmAccount={xsmmAccount}
        accounts={accounts}
        onXsmmLoginClick={() => setIsXsmmLoginOpen(true)}
        onXsmmLogoutClick={handleXsmmLogout}
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
