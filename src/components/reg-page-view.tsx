"use client";

import { useEffect, useRef, useState } from "react";
import {
  LuChevronDown,
  LuChevronRight,
  LuCopy,
  LuExternalLink,
  LuFileSpreadsheet,
  LuFlag,
  LuPause,
  LuPlay,
  LuRotateCcw,
  LuSearch,
  LuSettings,
  LuTrash2,
  LuUser,
  LuUsers,
} from "react-icons/lu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getTokenAndInfoFromCookie } from "@/lib/facebook-api";
import {
  createFacebookPageApi,
  generateRandomName,
  getRandomCategory,
} from "@/lib/facebook-page-api";
import { showSuccessToast } from "@/lib/toast-utils";
import { cn } from "@/lib/utils";

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
  status: "live" | "checkpoint" | "unverified";
  rawText: string;
}

interface RegPageViewProps {
  onNavigateToNuoiAcc: () => void;
  availableAccountsCount?: number;
  accounts?: FacebookAccount[];
}

export interface CreatedPageItem {
  id: string;
  pageId: string;
  name: string;
  category: string;
  nameType: "vietnamese" | "western";
  creatorUid: string;
  creatorName?: string;
  createdAt: string;
  status: "success" | "pending" | "failed";
  rawResponse?: string;
}

const STORAGE_KEY_PAGES = "autolunex_created_pages_v1";

export function RegPageView({
  onNavigateToNuoiAcc,
  availableAccountsCount = 0,
  accounts = [],
}: RegPageViewProps) {
  // Config States (Tên tự sinh hoàn toàn)
  const [nameType, setNameType] = useState<"vietnamese" | "western">(
    "vietnamese",
  );
  const [regCount, setRegCount] = useState(15);
  const [delayMs, setDelayMs] = useState(1500);
  const [threadsCount, setThreadsCount] = useState(1);
  const [proxyMode, setProxyMode] = useState<"account" | "direct">("account");

  // Selection of Accounts (Mặc định chọn các nick live)
  const [selectedAccountUids, setSelectedAccountUids] = useState<string[]>(
    () => {
      const liveUids = accounts
        .filter(
          (a) =>
            (a.platform ?? "facebook") === "facebook" &&
            a.status !== "checkpoint",
        )
        .map((a) => a.uid);
      return liveUids.length > 0 ? liveUids : accounts.map((a) => a.uid);
    },
  );

  // Expanded accounts to show their created pages
  const [expandedAccountUids, setExpandedAccountUids] = useState<string[]>(() =>
    accounts.map((a) => a.uid),
  );

  // Per-account real-time execution status & success count
  const [accountStatuses, setAccountStatuses] = useState<
    Record<string, string>
  >({});
  const [accountSuccessCounts, setAccountSuccessCounts] = useState<
    Record<string, number>
  >({});

  // Running & Global Progress States
  const [isRunning, setIsRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Hệ thống sẵn sàng");
  const stopRequestedRef = useRef(false);

  // Search Query
  const [searchQuery, setSearchQuery] = useState("");

  // Created pages list loaded from localStorage
  const [createdPages, setCreatedPages] = useState<CreatedPageItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PAGES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  // Save created pages to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PAGES, JSON.stringify(createdPages));
    } catch {
      // ignore
    }
  }, [createdPages]);

  // Sync selected accounts and expanded accounts if accounts prop changes
  useEffect(() => {
    if (selectedAccountUids.length === 0 && accounts.length > 0) {
      const liveUids = accounts
        .filter(
          (a) =>
            (a.platform ?? "facebook") === "facebook" &&
            a.status !== "checkpoint",
        )
        .map((a) => a.uid);
      setSelectedAccountUids(
        liveUids.length > 0 ? liveUids : accounts.map((a) => a.uid),
      );
      setExpandedAccountUids(accounts.map((a) => a.uid));
    }
  }, [accounts, selectedAccountUids.length]);

  // Account selection helpers
  const handleSelectAllAccounts = () => {
    setSelectedAccountUids(accounts.map((a) => a.uid));
  };

  const handleSelectOnlyLive = () => {
    const liveUids = accounts
      .filter((a) => a.status === "live")
      .map((a) => a.uid);
    setSelectedAccountUids(liveUids);
    showSuccessToast(`Đã chọn ${liveUids.length} tài khoản Live!`);
  };

  const handleDeselectAllAccounts = () => {
    setSelectedAccountUids([]);
  };

  const handleToggleAccount = (uid: string) => {
    setSelectedAccountUids((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid],
    );
  };

  const handleToggleExpandAccount = (uid: string) => {
    setExpandedAccountUids((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid],
    );
  };

  const handleCopy = (text: string) => {
    void navigator.clipboard.writeText(text);
    showSuccessToast("Đã sao chép vào bộ nhớ tạm!");
  };

  const handleClearAllPages = () => {
    if (createdPages.length === 0) return;
    if (confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử Fanpage đã tạo?")) {
      setCreatedPages([]);
      showSuccessToast("Đã xóa toàn bộ lịch sử Fanpage đã tạo!");
    }
  };

  const handleExportPages = () => {
    if (createdPages.length === 0) {
      showSuccessToast("Chưa có trang nào để xuất file!");
      return;
    }
    const lines = createdPages.map(
      (p) =>
        `${p.pageId}|${p.name}|${p.category}|${p.creatorUid}|${p.createdAt}`,
    );
    const blob = new Blob([lines.join("\r\n")], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fanpages_autolunex_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showSuccessToast("Đã xuất danh sách Fanpage thành file text!");
  };

  // Logic Reg Page Runner hỗ trợ chạy nhiều tài khoản
  const handleToggleRun = async () => {
    if (isRunning) {
      stopRequestedRef.current = true;
      setIsRunning(false);
      setStatusMessage("Đã tạm dừng tiến trình");
      showSuccessToast("Đã tạm dừng tiến trình Reg Page!");
      return;
    }

    const targetAccounts = accounts.filter((a) =>
      selectedAccountUids.includes(a.uid),
    );

    if (targetAccounts.length === 0) {
      showSuccessToast(
        "Vui lòng tick chọn ít nhất 1 tài khoản để bắt đầu chạy!",
      );
      return;
    }

    setIsRunning(true);
    stopRequestedRef.current = false;
    showSuccessToast(
      `Bắt đầu khởi chạy Reg Page cho ${targetAccounts.length} tài khoản...`,
    );

    let totalCreatedAll = 0;

    const processSingleAccount = async (acc: FacebookAccount) => {
      setAccountStatuses((prev) => ({
        ...prev,
        [acc.uid]: "Đang kiểm tra Token EAAA...",
      }));

      let token = acc.token?.trim() || "";
      const proxy =
        proxyMode === "account" ? acc.proxy?.trim() || undefined : undefined;

      if (!token && acc.cookie) {
        try {
          const info = await getTokenAndInfoFromCookie(acc.cookie, proxy);
          if (info.token) {
            token = info.token;
          }
        } catch {
          // ignore
        }
      }

      if (!token) {
        setAccountStatuses((prev) => ({
          ...prev,
          [acc.uid]: "Lỗi: Thiếu Token EAAA",
        }));
        return;
      }

      let createdCount = 0;

      for (let step = 1; step <= regCount; step++) {
        if (stopRequestedRef.current) break;

        const rawName = generateRandomName(nameType);
        // Tên Page có chữ "Page : " ở trước theo yêu cầu của user
        const formattedPageName = `Page : ${rawName}`;
        const randomCat = getRandomCategory();

        setAccountStatuses((prev) => ({
          ...prev,
          [acc.uid]: `Đang tạo (${step}/${regCount}): ${formattedPageName}`,
        }));

        const res = await createFacebookPageApi({
          pageName: rawName,
          token,
          categoryId: randomCat.id,
          proxy,
        });

        if (res.isSuccess && (res.pageId || res.profilePlusId)) {
          createdCount++;
          totalCreatedAll++;
          const finalId = res.profilePlusId || res.pageId || "";

          const newPage: CreatedPageItem = {
            id: `page_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            pageId: finalId,
            name: formattedPageName,
            category: randomCat.name,
            nameType,
            creatorUid: acc.uid,
            creatorName: acc.name,
            createdAt: new Date().toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
            status: "success",
            rawResponse: res.rawResponse,
          };

          setCreatedPages((prev) => [newPage, ...prev]);
          // Tự động mở rộng danh sách của acc này để thấy page con vừa tạo
          setExpandedAccountUids((prev) =>
            prev.includes(acc.uid) ? prev : [...prev, acc.uid],
          );
          setAccountSuccessCounts((prev) => ({
            ...prev,
            [acc.uid]: (prev[acc.uid] || 0) + 1,
          }));
          setAccountStatuses((prev) => ({
            ...prev,
            [acc.uid]: `Đã tạo ${createdCount}/${regCount}: ${formattedPageName}`,
          }));
        } else {
          const errMsg = res.errorMessage || "Không thể tạo trang";
          setAccountStatuses((prev) => ({
            ...prev,
            [acc.uid]: `Lỗi: ${errMsg} (${createdCount}/${regCount})`,
          }));

          if (
            errMsg.includes("giới hạn") ||
            errMsg.includes("quá nhiều") ||
            errMsg.includes("Checkpoint") ||
            errMsg.includes("limit")
          ) {
            setAccountStatuses((prev) => ({
              ...prev,
              [acc.uid]: `Dừng: Bị giới hạn tạo trang (${createdCount} Page)`,
            }));
            break;
          }
        }

        // Delay giữa các lần tạo
        if (step < regCount && !stopRequestedRef.current) {
          const delayTime = Math.max(delayMs, 500);
          for (let rem = Math.ceil(delayTime / 1000); rem > 0; rem--) {
            if (stopRequestedRef.current) break;
            setAccountStatuses((prev) => ({
              ...prev,
              [acc.uid]: `Chờ ${rem}s... [${createdCount}/${regCount}]`,
            }));
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      }

      if (!stopRequestedRef.current) {
        setAccountStatuses((prev) => ({
          ...prev,
          [acc.uid]: `Hoàn tất (${createdCount}/${regCount} Page)`,
        }));
      }
    };

    try {
      const concurrency = Math.max(1, Math.min(threadsCount, 5));

      if (concurrency === 1) {
        for (let i = 0; i < targetAccounts.length; i++) {
          if (stopRequestedRef.current) break;
          const acc = targetAccounts[i];
          setStatusMessage(
            `Đang xử lý tài khoản ${i + 1}/${targetAccounts.length}: ${acc.name || acc.uid}`,
          );
          await processSingleAccount(acc);
        }
      } else {
        const queue = [...targetAccounts];
        const workers = Array.from({ length: concurrency }).map(async () => {
          while (queue.length > 0 && !stopRequestedRef.current) {
            const acc = queue.shift();
            if (!acc) break;
            await processSingleAccount(acc);
          }
        });
        await Promise.all(workers);
      }

      setStatusMessage(
        totalCreatedAll > 0
          ? `Đã hoàn tất! Tổng cộng tạo thành công ${totalCreatedAll} Fanpage.`
          : "Tiến trình kết thúc.",
      );
      showSuccessToast(
        `Đã tạo thành công tổng cộng ${totalCreatedAll} Fanpage!`,
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Lỗi xảy ra trong tiến trình";
      setStatusMessage(`Lỗi: ${msg}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Filtered accounts matching search
  const filteredAccounts = accounts.filter((a) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const hasMatchingPage = createdPages.some(
      (p) =>
        p.creatorUid === a.uid &&
        (p.name.toLowerCase().includes(q) ||
          p.pageId.toLowerCase().includes(q)),
    );
    return (
      a.uid.toLowerCase().includes(q) ||
      a.name?.toLowerCase().includes(q) ||
      hasMatchingPage
    );
  });

  return (
    <div className="flex w-full flex-1 flex-col gap-3 min-h-0 select-none">
      {/* Top Bar: Switcher Nuôi Acc / Reg Page & Quick Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-border/40">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/30 border border-border/60">
          <button
            type="button"
            onClick={onNavigateToNuoiAcc}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
          >
            <LuUsers className="size-3.5 shrink-0" />
            <span>Nuôi Acc</span>
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-background text-foreground shadow-2xs border border-border/80 cursor-pointer"
          >
            <LuFlag className="size-3.5 text-indigo-400 shrink-0" />
            <span>Reg Page</span>
            <span className="ml-1 size-1.5 rounded-full bg-indigo-500 shrink-0" />
          </button>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/20 border border-border/60 text-xs">
            <span className="text-muted-foreground">Acc chủ đã tick:</span>
            <span className="font-semibold text-primary font-mono">
              {selectedAccountUids.length}/
              {availableAccountsCount || accounts.length}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
            <span>Page đã reg:</span>
            <span className="font-bold font-mono">{createdPages.length}</span>
          </div>
        </div>
      </div>

      {/* Main Content Area: Split 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-3 flex-1 min-h-0">
        {/* Left Column: Cấu hình Reg Page (Gọn gàng, không ô nhập tên) */}
        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background p-3.5 shadow-2xs overflow-y-auto">
          <div className="flex items-center justify-between border-b border-border/40 pb-2">
            <div className="flex items-center gap-2">
              <LuSettings className="size-4 text-indigo-400" />
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                Cấu hình Reg Page
              </span>
            </div>
            <span className="text-[10.5px] text-muted-foreground font-mono">
              Auto Name
            </span>
          </div>

          {/* Chọn Loại tên (Tên Việt hoặc Tên Tây) */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-foreground">
              Loại tên sinh tự động
            </Label>
            <select
              value={nameType}
              onChange={(e) =>
                setNameType(e.target.value as "vietnamese" | "western")
              }
              className="h-8 w-full rounded-lg border border-border/70 bg-muted/20 px-2.5 text-xs text-foreground outline-none focus:border-primary/50 cursor-pointer font-medium"
            >
              <option value="vietnamese" className="bg-background">
                Tên Việt (Họ + Đệm + Tên thuần Việt)
              </option>
              <option value="western" className="bg-background">
                Tên Tây (First Name + Last Name)
              </option>
            </select>
            <p className="text-[10.5px] text-muted-foreground leading-normal">
              Tên sinh ra sẽ có tiền tố "Page : " (ví dụ: Page : Vũ Hà). Acc chủ
              hiển thị tên Profile thuần.
            </p>
          </div>

          {/* Cấu hình số lượng & delay: Mặc định 15 Page, delay 1500ms */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11.5px] font-medium text-foreground">
                Số Page / Acc
              </Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={regCount}
                onChange={(e) => setRegCount(Number(e.target.value) || 15)}
                className="h-8 text-xs bg-muted/20 border-border/70 font-mono"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11.5px] font-medium text-foreground">
                Delay (ms)
              </Label>
              <Input
                type="number"
                min={500}
                max={60000}
                step={100}
                value={delayMs}
                onChange={(e) => setDelayMs(Number(e.target.value) || 1500)}
                className="h-8 text-xs bg-muted/20 border-border/70 font-mono"
              />
            </div>
          </div>

          {/* Số luồng chạy đồng thời */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-foreground">
              Số luồng chạy (Acc cùng lúc)
            </Label>
            <select
              value={threadsCount}
              onChange={(e) => setThreadsCount(Number(e.target.value) || 1)}
              className="h-8 w-full rounded-lg border border-border/70 bg-muted/20 px-2.5 text-xs text-foreground outline-none focus:border-primary/50 cursor-pointer"
            >
              <option value={1} className="bg-background">
                1 luồng (Lần lượt từng nick - An toàn nhất)
              </option>
              <option value={2} className="bg-background">
                2 luồng (2 nick chạy cùng lúc)
              </option>
              <option value={3} className="bg-background">
                3 luồng (3 nick chạy cùng lúc)
              </option>
              <option value={5} className="bg-background">
                5 luồng (5 nick chạy cùng lúc)
              </option>
            </select>
          </div>

          {/* Tùy chọn Proxy */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-foreground">
              Cơ chế Proxy
            </Label>
            <select
              value={proxyMode}
              onChange={(e) =>
                setProxyMode(e.target.value as "account" | "direct")
              }
              className="h-8 w-full rounded-lg border border-border/70 bg-muted/20 px-2.5 text-xs text-foreground outline-none focus:border-primary/50 cursor-pointer"
            >
              <option value="account" className="bg-background">
                Sử dụng Proxy gán theo từng tài khoản
              </option>
              <option value="direct" className="bg-background">
                Chạy trực tiếp (Không dùng Proxy)
              </option>
            </select>
          </div>

          {/* Hộp tóm tắt cấu hình thực thi */}
          <div className="p-2.5 rounded-lg bg-muted/25 border border-border/60 text-xs flex flex-col gap-1 text-muted-foreground">
            <div className="flex justify-between">
              <span>Acc chủ đã tick:</span>
              <span className="font-semibold text-foreground font-mono">
                {selectedAccountUids.length} acc
              </span>
            </div>
            <div className="flex justify-between">
              <span>Dự kiến tạo:</span>
              <span className="font-semibold text-emerald-400 font-mono">
                ~{selectedAccountUids.length * regCount} Page
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-1 flex flex-col gap-2 mt-auto">
            <Button
              type="button"
              onClick={handleToggleRun}
              className={cn(
                "h-9 w-full text-xs font-semibold cursor-pointer gap-1.5 shadow-xs transition-all",
                isRunning
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white",
              )}
            >
              {isRunning ? (
                <>
                  <LuPause className="size-3.5" />
                  <span>Tạm dừng tiến trình</span>
                </>
              ) : (
                <>
                  <LuPlay className="size-3.5 fill-current" />
                  <span>
                    Bắt đầu Reg Page ({selectedAccountUids.length} Acc)
                  </span>
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setNameType("vietnamese");
                setRegCount(15);
                setDelayMs(1500);
                setThreadsCount(1);
                showSuccessToast(
                  "Đã khôi phục cấu hình mặc định (15 Page, 1500ms)!",
                );
              }}
              className="h-7 text-xs text-muted-foreground hover:text-foreground cursor-pointer gap-1"
            >
              <LuRotateCcw className="size-3" />
              <span>Làm mới cấu hình</span>
            </Button>
          </div>
        </div>

        {/* Right Column: Unified Table (Acc chủ Profile & Fanpage reg ra hiển thị chung trong danh sách) */}
        <div className="flex flex-col rounded-xl border border-border/60 bg-background shadow-2xs overflow-hidden min-h-0">
          {/* Header Toolbar */}
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-border/60 bg-muted/10 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">
                Danh sách Tài khoản chủ & Fanpage
              </span>
              <Badge variant="outline" className="text-[10px] h-4.5 px-1.5">
                {accounts.length} Acc chủ • {createdPages.length} Page
              </Badge>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="relative">
                <LuSearch className="size-3 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm tài khoản hoặc page..."
                  className="h-7 w-48 pl-7 text-[11px] bg-muted/20 border-border/70"
                />
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={handleSelectOnlyLive}
                className="h-7 text-[11px] px-2 cursor-pointer"
              >
                <span>Chọn Live</span>
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={
                  selectedAccountUids.length === accounts.length
                    ? handleDeselectAllAccounts
                    : handleSelectAllAccounts
                }
                className="h-7 text-[11px] px-2 cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <span>
                  {selectedAccountUids.length === accounts.length
                    ? "Bỏ chọn"
                    : "Chọn hết"}
                </span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleExportPages}
                className="h-7 text-[11px] gap-1 cursor-pointer"
              >
                <LuFileSpreadsheet className="size-3 text-emerald-500" />
                <span>Xuất file</span>
              </Button>

              {createdPages.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleClearAllPages}
                  className="h-7 text-[11px] text-muted-foreground hover:text-destructive px-2"
                  title="Xóa toàn bộ lịch sử Fanpage đã tạo"
                >
                  <LuTrash2 className="size-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-[40px_1.6fr_1.3fr_110px_1.4fr_80px] items-center px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-border/60 bg-muted/5 shrink-0 select-none">
            <div className="flex items-center justify-center">
              <Checkbox
                checked={
                  accounts.length > 0 &&
                  selectedAccountUids.length === accounts.length
                }
                onCheckedChange={(checked) => {
                  if (checked) handleSelectAllAccounts();
                  else handleDeselectAllAccounts();
                }}
              />
            </div>
            <div>Tài khoản & Fanpage</div>
            <div>UID (Profile / Page UID 615)</div>
            <div>Đối tượng</div>
            <div>Tiến độ / Trạng thái</div>
            <div className="text-right pr-2">Thao tác</div>
          </div>

          {/* Table Body: Unified Rows */}
          {filteredAccounts.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-24 text-center select-none">
              <div className="flex size-12 items-center justify-center rounded-xl bg-muted/30 text-muted-foreground border border-border/60 mb-2.5">
                <LuUsers className="size-6" />
              </div>
              <p className="text-xs font-semibold text-foreground">
                Chưa có tài khoản Facebook nào
              </p>
              <p className="text-[11px] text-muted-foreground max-w-sm mt-1 leading-relaxed">
                Vui lòng quay lại tab "Nuôi Acc" để thêm tài khoản Facebook
                trước khi thực hiện Reg Page.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/30 overflow-y-auto flex-1">
              {filteredAccounts.map((acc) => {
                const isSelected = selectedAccountUids.includes(acc.uid);
                const isExpanded = expandedAccountUids.includes(acc.uid);
                const statusText = accountStatuses[acc.uid] || "Sẵn sàng";
                const accPages = createdPages.filter(
                  (p) => p.creatorUid === acc.uid,
                );
                const successCount =
                  accountSuccessCounts[acc.uid] || accPages.length;

                return (
                  <div key={acc.id} className="flex flex-col">
                    {/* DÒNG TÀI KHOẢN CHỦ (PROFILE) - KHÔNG CÓ CHỮ PAGE */}
                    <div
                      className={cn(
                        "grid grid-cols-[40px_1.6fr_1.3fr_110px_1.4fr_80px] items-center px-3 py-2.5 text-xs transition-colors border-b border-border/20",
                        isSelected
                          ? "bg-primary/5 hover:bg-primary/10"
                          : "hover:bg-muted/10",
                      )}
                    >
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleAccount(acc.uid)}
                        />
                      </div>

                      {/* Tên Profile chủ (Thuần, không có chữ Page) */}
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        {accPages.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleToggleExpandAccount(acc.uid)}
                            className="p-0.5 text-muted-foreground hover:text-foreground rounded cursor-pointer shrink-0"
                            title={
                              isExpanded
                                ? "Thu gọn danh sách page"
                                : "Mở rộng danh sách page"
                            }
                          >
                            {isExpanded ? (
                              <LuChevronDown className="size-3.5" />
                            ) : (
                              <LuChevronRight className="size-3.5" />
                            )}
                          </button>
                        ) : (
                          <div className="size-3.5 shrink-0" />
                        )}

                        <div className="size-7 rounded-full overflow-hidden bg-muted/60 shrink-0 border border-border/70 flex items-center justify-center shadow-2xs">
                          {acc.avatar ? (
                            // biome-ignore lint/performance/noImgElement: avatar
                            <img
                              src={acc.avatar}
                              alt=""
                              className="size-full object-cover"
                            />
                          ) : (
                            <LuUser className="size-3.5 text-primary" />
                          )}
                        </div>

                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-foreground truncate">
                            {acc.name || acc.uid}
                          </span>
                          <span className="text-[10px] text-muted-foreground truncate">
                            Đã reg: {successCount} Page
                          </span>
                        </div>
                      </div>

                      {/* UID Acc chủ */}
                      <div className="flex flex-col min-w-0 pr-2 font-mono text-muted-foreground text-[11px]">
                        <span className="truncate">{acc.uid}</span>
                        <span className="text-[10px] text-muted-foreground/70">
                          {acc.proxy || "Trực tiếp"}
                        </span>
                      </div>

                      {/* Phân loại: Profile chủ */}
                      <div>
                        <Badge
                          variant="outline"
                          className="bg-primary/10 text-primary border-primary/30 text-[10px] h-5 font-semibold px-1.5"
                        >
                          Profile chủ
                        </Badge>
                      </div>

                      {/* Tiến độ Reg Page của Acc chủ */}
                      <div className="min-w-0 pr-2">
                        <span
                          className={cn(
                            "text-[11px] truncate block font-medium",
                            statusText.includes("Đang tạo")
                              ? "text-amber-400 animate-pulse font-semibold"
                              : statusText.includes("Đã tạo") ||
                                  statusText.includes("Hoàn tất")
                                ? "text-emerald-400 font-semibold"
                                : statusText.includes("Lỗi") ||
                                    statusText.includes("Dừng")
                                  ? "text-rose-400 font-semibold"
                                  : "text-muted-foreground",
                          )}
                          title={statusText}
                        >
                          {statusText}
                        </span>
                      </div>

                      {/* Thao tác Acc chủ */}
                      <div className="flex items-center justify-end gap-1 pr-1">
                        <button
                          type="button"
                          onClick={() => handleCopy(acc.uid)}
                          title="Copy UID Profile chủ"
                          className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors cursor-pointer"
                        >
                          <LuCopy className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            window.open(
                              `https://facebook.com/${acc.uid}`,
                              "_blank",
                            )
                          }
                          title="Mở Profile Facebook"
                          className="p-1 text-muted-foreground hover:text-primary rounded transition-colors cursor-pointer"
                        >
                          <LuExternalLink className="size-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* CÁC DÒNG FANPAGE REG RA TỪ ACC CHỦ NÀY (CÓ CHỮ "PAGE : " Ở TRƯỚC TÊN) */}
                    {isExpanded &&
                      accPages.map((page) => (
                        <div
                          key={page.id}
                          className="grid grid-cols-[40px_1.6fr_1.3fr_110px_1.4fr_80px] items-center px-3 py-1.5 text-xs bg-muted/10 hover:bg-muted/20 transition-colors border-b border-border/10"
                        >
                          <div className="flex items-center justify-center">
                            <span className="font-mono text-muted-foreground text-[10px]">
                              ↳
                            </span>
                          </div>

                          {/* Tên Fanpage: Luôn có chữ "Page : " ở trước */}
                          <div className="flex items-center gap-2 min-w-0 pl-3 pr-2">
                            <div className="size-5 rounded-md bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
                              <LuFlag className="size-3" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-medium text-foreground truncate">
                                {page.name.startsWith("Page :")
                                  ? page.name
                                  : `Page : ${page.name}`}
                              </span>
                              <span className="text-[9.5px] text-muted-foreground">
                                {page.createdAt} • {page.category}
                              </span>
                            </div>
                          </div>

                          {/* UID Page (Profile Plus 615) */}
                          <div className="font-mono text-primary font-semibold text-[11px] truncate pr-2">
                            {page.pageId}
                          </div>

                          {/* Phân loại: Page reg ra */}
                          <div>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <LuFlag className="size-2.5" />
                              <span>Fanpage</span>
                            </span>
                          </div>

                          {/* Trạng thái Page */}
                          <div>
                            <span className="text-[10.5px] text-emerald-400 font-medium">
                              Thành công
                            </span>
                          </div>

                          {/* Thao tác Page */}
                          <div className="flex items-center justify-end gap-1 pr-1">
                            <button
                              type="button"
                              onClick={() => handleCopy(page.pageId)}
                              title="Copy ID Page 615"
                              className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors cursor-pointer"
                            >
                              <LuCopy className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                window.open(
                                  `https://facebook.com/${page.pageId}`,
                                  "_blank",
                                )
                              }
                              title="Mở Fanpage trên Facebook"
                              className="p-1 text-muted-foreground hover:text-primary rounded transition-colors cursor-pointer"
                            >
                              <LuExternalLink className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                );
              })}
            </div>
          )}

          {/* Bottom Mini Log Banner */}
          <div className="px-3.5 py-1.5 border-t border-border/40 bg-muted/20 flex items-center justify-between text-[11px] text-muted-foreground shrink-0">
            <div className="flex items-center gap-2 truncate pr-2">
              <span
                className={cn(
                  "size-2 rounded-full shrink-0",
                  isRunning ? "bg-amber-400 animate-pulse" : "bg-emerald-500",
                )}
              />
              <span className="truncate">{statusMessage}</span>
            </div>
            <span className="font-mono text-[10px] hidden sm:inline shrink-0">
              AutoLunex Page Engine
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
