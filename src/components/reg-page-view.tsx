"use client";

import { useEffect, useRef, useState } from "react";
import {
  LuCheck,
  LuCopy,
  LuExternalLink,
  LuFileSpreadsheet,
  LuFlag,
  LuPause,
  LuPlay,
  LuRotateCcw,
  LuSearch,
  LuSettings,
  LuSparkles,
  LuTrash2,
  LuUsers,
} from "react-icons/lu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  // Config States
  const [pageNamesText, setPageNamesText] = useState("");
  const [nameType, setNameType] = useState<"vietnamese" | "western">(
    "vietnamese",
  );
  const [regCount, setRegCount] = useState(15);
  const [delayMs, setDelayMs] = useState(1500);
  const [proxyMode, setProxyMode] = useState<"account" | "direct">("account");
  const [selectedAccountUid, setSelectedAccountUid] = useState<string>("all");

  // Running & Progress States
  const [isRunning, setIsRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Hệ thống sẵn sàng");
  const [progressText, setProgressText] = useState<string>("");
  const stopRequestedRef = useRef(false);

  // Search & Selection
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);

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

  // Save created pages to localStorage whenever updated
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PAGES, JSON.stringify(createdPages));
    } catch {
      // ignore
    }
  }, [createdPages]);

  const pageNames = pageNamesText
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  // Sinh danh sách tên mẫu theo Loại tên (Tên Việt hoặc Tên Tây)
  const handleRandomizeNames = () => {
    const samples: string[] = [];
    for (let i = 0; i < 5; i++) {
      samples.push(generateRandomName(nameType));
    }
    setPageNamesText(samples.join("\n"));
    showSuccessToast(
      `Đã điền 5 ${nameType === "vietnamese" ? "Tên Việt" : "Tên Tây"} mẫu ngẫu nhiên!`,
    );
  };

  const handleCopy = (text: string) => {
    void navigator.clipboard.writeText(text);
    showSuccessToast("Đã sao chép vào bộ nhớ tạm!");
  };

  const handleDeleteSelected = () => {
    if (selectedPageIds.length === 0) return;
    setCreatedPages((prev) =>
      prev.filter((p) => !selectedPageIds.includes(p.id)),
    );
    setSelectedPageIds([]);
    showSuccessToast("Đã xóa các trang đã chọn khỏi danh sách!");
  };

  const handleClearAll = () => {
    if (createdPages.length === 0) return;
    if (confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử Fanpage đã tạo?")) {
      setCreatedPages([]);
      setSelectedPageIds([]);
      showSuccessToast("Đã xóa toàn bộ lịch sử Fanpage đã tạo!");
    }
  };

  const handleExportFile = () => {
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

  // Logic Reg Page Runner
  const handleToggleRun = async () => {
    if (isRunning) {
      stopRequestedRef.current = true;
      setIsRunning(false);
      setStatusMessage("Đã tạm dừng bởi người dùng");
      setProgressText("");
      showSuccessToast("Đã tạm dừng tiến trình Reg Page!");
      return;
    }

    // Xác định danh sách tài khoản thực hiện
    const liveAccounts = accounts.filter(
      (a) =>
        (a.platform ?? "facebook") === "facebook" &&
        a.status !== "checkpoint",
    );

    let targetAccounts: FacebookAccount[] = [];
    if (selectedAccountUid === "all") {
      targetAccounts = liveAccounts.length > 0 ? liveAccounts : accounts;
    } else {
      const found = accounts.find((a) => a.uid === selectedAccountUid);
      if (found) targetAccounts = [found];
    }

    if (targetAccounts.length === 0) {
      showSuccessToast(
        "Không tìm thấy tài khoản Facebook nào khả dụng. Vui lòng thêm hoặc kiểm tra lại tài khoản!",
      );
      return;
    }

    setIsRunning(true);
    stopRequestedRef.current = false;
    showSuccessToast("Bắt đầu khởi chạy tiến trình Reg Page...");

    const remainingNames = [...pageNames];
    let totalSuccess = 0;

    try {
      for (let accIdx = 0; accIdx < targetAccounts.length; accIdx++) {
        if (stopRequestedRef.current) break;
        const acc = targetAccounts[accIdx];

        setStatusMessage(
          `Đang xử lý tài khoản: ${acc.name || acc.uid} (${accIdx + 1}/${targetAccounts.length})`,
        );

        // Khôi phục / kiểm tra Token EAAA
        let token = acc.token?.trim() || "";
        const proxy =
          proxyMode === "account" ? acc.proxy?.trim() || undefined : undefined;

        if (!token && acc.cookie) {
          setStatusMessage(`Đang lấy token EAAA từ Cookie cho ${acc.uid}...`);
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
          setStatusMessage(
            `Tài khoản ${acc.name || acc.uid} thiếu Token EAAA, chuyển tài khoản tiếp theo...`,
          );
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }

        // Tạo theo số lượng regCount
        for (let step = 1; step <= regCount; step++) {
          if (stopRequestedRef.current) break;

          // Lấy tên Page
          let currentPageName = "";
          if (remainingNames.length > 0) {
            currentPageName = remainingNames.shift() || "";
          } else {
            currentPageName = generateRandomName(nameType);
          }

          // Tự động chọn ngẫu nhiên danh mục
          const randomCat = getRandomCategory();

          setStatusMessage(
            `[${step}/${regCount}] Đang tạo trang "${currentPageName}" cho ${acc.name || acc.uid}...`,
          );
          setProgressText(
            `Tài khoản ${accIdx + 1}/${targetAccounts.length} • Lần ${step}/${regCount}`,
          );

          const res = await createFacebookPageApi({
            pageName: currentPageName,
            token,
            categoryId: randomCat.id,
            proxy,
          });

          if (res.isSuccess && (res.pageId || res.profilePlusId)) {
            totalSuccess++;
            const finalId = res.profilePlusId || res.pageId || "";

            const newPage: CreatedPageItem = {
              id: `page_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              pageId: finalId,
              name: currentPageName,
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
            showSuccessToast(
              `Đã tạo thành công Page: ${currentPageName} (${finalId})`,
            );
            setStatusMessage(
              `Đã tạo thành công: ${currentPageName} [${finalId}]`,
            );
          } else {
            const errMsg = res.errorMessage || "Không thể tạo trang";
            setStatusMessage(`Tạo thất bại: ${errMsg}`);

            // Nếu bị giới hạn hoặc checkpoint, dừng tài khoản này để bảo toàn nick
            if (
              errMsg.includes("giới hạn") ||
              errMsg.includes("quá nhiều") ||
              errMsg.includes("Checkpoint") ||
              errMsg.includes("limit")
            ) {
              showSuccessToast(
                `Tài khoản ${acc.uid} bị giới hạn tạo trang, chuyển nick tiếp theo!`,
              );
              break;
            }
          }

          // Delay giữa các lần tạo
          if (step < regCount && !stopRequestedRef.current) {
            const delayTime = Math.max(delayMs, 500);
            for (let rem = Math.ceil(delayTime / 1000); rem > 0; rem--) {
              if (stopRequestedRef.current) break;
              setStatusMessage(`Chờ ${rem}s để tiếp tục lần tiếp theo...`);
              await new Promise((r) => setTimeout(r, 1000));
            }
          }
        }
      }

      setStatusMessage(
        totalSuccess > 0
          ? `Hoàn tất! Đã tạo thành công ${totalSuccess} Fanpage.`
          : "Tiến trình kết thúc.",
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Lỗi xảy ra trong tiến trình";
      setStatusMessage(`Lỗi: ${msg}`);
    } finally {
      setIsRunning(false);
      setProgressText("");
    }
  };

  // Filtered pages for table
  const filteredCreatedPages = createdPages.filter((page) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      page.name.toLowerCase().includes(q) ||
      page.pageId.toLowerCase().includes(q) ||
      page.creatorUid.toLowerCase().includes(q) ||
      page.creatorName?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex w-full flex-1 flex-col gap-3 min-h-0 select-none">
      {/* Top Bar: Sub Navigation Switcher & Quick Stats */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-border/40">
        {/* Switcher: Nuôi Acc <-> Reg Page */}
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
            <span className="text-muted-foreground">Acc khả dụng:</span>
            <span className="font-semibold text-primary font-mono">
              {availableAccountsCount}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/20 border border-border/60 text-xs">
            <span className="text-muted-foreground">Tên tự nhập:</span>
            <span className="font-semibold text-foreground font-mono">
              {pageNames.length}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
            <span>Đã tạo:</span>
            <span className="font-bold font-mono">{createdPages.length}</span>
          </div>
        </div>
      </div>

      {/* Main Content Area: Split 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-[330px_1fr] gap-3 flex-1 min-h-0">
        {/* Left Column: Cấu hình Reg Page */}
        <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background p-3.5 shadow-2xs overflow-y-auto">
          <div className="flex items-center justify-between border-b border-border/40 pb-2">
            <div className="flex items-center gap-2">
              <LuSettings className="size-4 text-indigo-400" />
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                Cấu hình Reg Page
              </span>
            </div>
            <button
              type="button"
              onClick={handleRandomizeNames}
              className="flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer"
            >
              <LuSparkles className="size-3" />
              <span>Tên mẫu</span>
            </button>
          </div>

          {/* Chọn tài khoản thực hiện */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-foreground">
              Tài khoản chạy
            </Label>
            <select
              value={selectedAccountUid}
              onChange={(e) => setSelectedAccountUid(e.target.value)}
              className="h-8 w-full rounded-lg border border-border/70 bg-muted/20 px-2.5 text-xs text-foreground outline-none focus:border-primary/50 cursor-pointer"
            >
              <option value="all" className="bg-background">
                Tất cả tài khoản Live ({accounts.length})
              </option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.uid} className="bg-background">
                  {acc.name ? `${acc.name} (${acc.uid})` : acc.uid}
                </option>
              ))}
            </select>
          </div>

          {/* Danh sách tên Page (Tùy chọn) */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <Label className="text-xs font-medium text-foreground">
                Danh sách tên Page (mỗi dòng 1 tên)
              </Label>
              <span className="text-[10.5px] font-mono text-muted-foreground">
                {pageNames.length} tên
              </span>
            </div>
            <Textarea
              value={pageNamesText}
              onChange={(e) => setPageNamesText(e.target.value)}
              placeholder="Để trống để hệ thống tự sinh tên ngẫu nhiên theo Loại tên bên dưới..."
              rows={4}
              className="resize-none font-sans text-xs bg-muted/20 border-border/70 focus-visible:ring-primary/30"
            />
          </div>

          {/* Cấu hình Loại tên (Tên Việt hoặc Tên Tây) */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-foreground">
              Loại tên
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
            <p className="text-[10.5px] text-muted-foreground">
              Thể loại / Danh mục sẽ do logic reg tự động chọn ngẫu nhiên.
            </p>
          </div>

          {/* Cấu hình số lượng & delay: Mặc định số lượng 15, delay 1500 */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11.5px] font-medium text-foreground">
                Số Page cần reg
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

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col gap-2 mt-auto">
            <Button
              type="button"
              onClick={handleToggleRun}
              className={cn(
                "h-8.5 w-full text-xs font-semibold cursor-pointer gap-1.5 shadow-xs transition-all",
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
                  <span>Bắt đầu Reg Page</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPageNamesText("");
                setNameType("vietnamese");
                setRegCount(15);
                setDelayMs(1500);
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

        {/* Right Column: Bảng Fanpage đã tạo & Logs */}
        <div className="flex flex-col rounded-xl border border-border/60 bg-background shadow-2xs overflow-hidden min-h-0">
          {/* Header toolbar */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border/60 bg-muted/10 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">
                Danh sách Fanpage đã tạo
              </span>
              <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                {createdPages.length} trang
              </Badge>
              {selectedPageIds.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDeleteSelected}
                  className="h-6 text-[11px] text-destructive hover:bg-destructive/10 px-2 gap-1 cursor-pointer"
                >
                  <LuTrash2 className="size-3" />
                  <span>Xóa ({selectedPageIds.length})</span>
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <LuSearch className="size-3 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm page..."
                  className="h-7 w-44 pl-7 text-[11px] bg-muted/20 border-border/70"
                />
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={handleExportFile}
                className="h-7 text-[11px] gap-1 cursor-pointer"
              >
                <LuFileSpreadsheet className="size-3 text-emerald-500" />
                <span>Xuất file</span>
              </Button>

              {createdPages.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleClearAll}
                  className="h-7 text-[11px] text-muted-foreground hover:text-destructive px-2"
                  title="Xóa toàn bộ"
                >
                  <LuTrash2 className="size-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-[40px_1.2fr_1.3fr_1fr_100px_80px] items-center px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-border/60 bg-muted/5 shrink-0 select-none">
            <div className="flex items-center justify-center">
              <Checkbox
                checked={
                  createdPages.length > 0 &&
                  selectedPageIds.length === createdPages.length
                }
                onCheckedChange={() => {
                  if (selectedPageIds.length === createdPages.length) {
                    setSelectedPageIds([]);
                  } else {
                    setSelectedPageIds(createdPages.map((p) => p.id));
                  }
                }}
              />
            </div>
            <div>Tên Fanpage</div>
            <div>ID Page (Profile Plus UID)</div>
            <div>Thể loại & Loại tên</div>
            <div>Trạng thái</div>
            <div className="text-right pr-2">Thao tác</div>
          </div>

          {/* Table Rows or Empty State */}
          {filteredCreatedPages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-24 text-center select-none">
              <div className="flex size-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-2.5">
                <LuFlag className="size-6" />
              </div>
              <p className="text-xs font-semibold text-foreground">
                Chưa có Fanpage nào được tạo
              </p>
              <p className="text-[11px] text-muted-foreground max-w-sm mt-1 leading-relaxed">
                Chọn Loại tên (Tên Việt/Tây) ở bên trái và bấm{" "}
                <span className="font-semibold text-emerald-500">
                  "Bắt đầu Reg Page"
                </span>{" "}
                để hệ thống tự động khởi tạo Fanpage Profile Plus.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/30 overflow-y-auto flex-1">
              {filteredCreatedPages.map((page) => (
                <div
                  key={page.id}
                  className="grid grid-cols-[40px_1.2fr_1.3fr_1fr_100px_80px] items-center px-3 py-2 text-xs text-foreground hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center justify-center">
                    <Checkbox
                      checked={selectedPageIds.includes(page.id)}
                      onCheckedChange={() => {
                        setSelectedPageIds((prev) =>
                          prev.includes(page.id)
                            ? prev.filter((i) => i !== page.id)
                            : [...prev, page.id],
                        );
                      }}
                    />
                  </div>
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="font-semibold text-foreground truncate">
                      {page.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {page.createdAt}
                    </span>
                  </div>
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="font-mono text-primary font-semibold text-[11px] truncate">
                      {page.pageId}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate">
                      Tạo bởi: {page.creatorName || page.creatorUid}
                    </span>
                  </div>
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="text-muted-foreground text-[11px] truncate">
                      {page.category}
                    </span>
                    <span className="text-[10px] text-muted-foreground/70">
                      {page.nameType === "vietnamese" ? "Tên Việt" : "Tên Tây"}
                    </span>
                  </div>
                  <div>
                    {page.status === "success" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        <LuCheck className="size-3" />
                        <span>Thành công</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        Đang tạo
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-1 pr-1">
                    <button
                      type="button"
                      onClick={() => handleCopy(page.pageId)}
                      title="Copy ID Page"
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
                      title="Mở link Page"
                      className="p-1 text-muted-foreground hover:text-primary rounded transition-colors cursor-pointer"
                    >
                      <LuExternalLink className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
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
            {progressText && (
              <span className="font-mono text-[10.5px] text-muted-foreground shrink-0">
                {progressText}
              </span>
            )}
            <span className="font-mono text-[10px] hidden sm:inline shrink-0">
              AutoLunex Page Engine
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
