"use client";

import { useState } from "react";
import {
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
  LuUsers,
} from "react-icons/lu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { showSuccessToast } from "@/lib/toast-utils";
import { cn } from "@/lib/utils";

interface RegPageViewProps {
  onNavigateToNuoiAcc: () => void;
  availableAccountsCount?: number;
}

interface CreatedPageItem {
  id: string;
  pageId: string;
  name: string;
  category: string;
  creatorUid: string;
  creatorName?: string;
  createdAt: string;
  status: "success" | "pending" | "failed";
}

const SAMPLE_CATEGORIES = [
  "Blog cá nhân",
  "Cửa hàng quần áo",
  "Đồ ăn & Đồ uống",
  "Mua sắm & Bán lẻ",
  "Doanh nghiệp & Khởi nghiệp",
  "Sức khỏe & Sắc đẹp",
  "Giải trí & Nghệ thuật",
  "Bất động sản",
];

export function RegPageView({
  onNavigateToNuoiAcc,
  availableAccountsCount = 0,
}: RegPageViewProps) {
  const [pageNamesText, setPageNamesText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Blog cá nhân");
  const [bioText, setBioText] = useState("");
  const [pagesPerAccount, setPagesPerAccount] = useState(1);
  const [delaySeconds, setDelaySeconds] = useState(15);
  const [proxyMode, setProxyMode] = useState<"account" | "direct" | "rotating">(
    "account",
  );
  const [isRunning, setIsRunning] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Placeholder created pages list (empty by default)
  const [createdPages, setCreatedPages] = useState<CreatedPageItem[]>([]);
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);

  const pageNames = pageNamesText
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const handleRandomizeNames = () => {
    const samples = [
      "Gia Dụng Thông Minh Store",
      "Thời Trang Nữ Trendy",
      "Tiệm Trà & Cafe Chill",
      "Mỹ Phẩm Xách Tay Chính Hãng",
      "Góc Nhỏ Decor & Handmade",
    ];
    setPageNamesText(samples.join("\n"));
    showSuccessToast("Đã điền danh sách tên Page mẫu ngẫu nhiên!");
  };

  const handleToggleRun = () => {
    if (!isRunning) {
      if (pageNames.length === 0) {
        showSuccessToast("Vui lòng nhập ít nhất 1 tên Page để bắt đầu!");
        return;
      }
      setIsRunning(true);
      showSuccessToast("Đã kích hoạt tiến trình Reg Page!");
    } else {
      setIsRunning(false);
      showSuccessToast("Đã tạm dừng tiến trình Reg Page!");
    }
  };

  const handleCopy = (text: string) => {
    void navigator.clipboard.writeText(text);
    showSuccessToast("Đã sao chép vào bộ nhớ tạm!");
  };

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
            <LuUsers className="size-3.5" />
            <span>Nuôi Acc</span>
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-background text-foreground shadow-2xs border border-border/80 cursor-pointer"
          >
            <LuFlag className="size-3.5 text-indigo-400" />
            <span>Reg Page</span>
            <span className="ml-1 size-1.5 rounded-full bg-indigo-500" />
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
            <span className="text-muted-foreground">Tên Page:</span>
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

          {/* Danh sách tên Page */}
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
              placeholder="Nhập danh sách tên Page tại đây...&#10;Shop Thời Trang Xinh&#10;Gia Dụng Tiện Ích&#10;Góc Bếp Mẹ Nấu"
              rows={4}
              className="resize-none font-sans text-xs bg-muted/20 border-border/70 focus-visible:ring-primary/30"
            />
          </div>

          {/* Thể loại (Category) */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-foreground">
              Thể loại / Danh mục
            </Label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-8 w-full rounded-lg border border-border/70 bg-muted/20 px-2.5 text-xs text-foreground outline-none focus:border-primary/50 cursor-pointer"
            >
              {SAMPLE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat} className="bg-background">
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Tiểu sử (Bio) */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-foreground">
              Tiểu sử / Giới thiệu (Tùy chọn)
            </Label>
            <Input
              value={bioText}
              onChange={(e) => setBioText(e.target.value)}
              placeholder="Chào mừng bạn đến với trang chính thức..."
              className="h-8 text-xs bg-muted/20 border-border/70"
            />
          </div>

          {/* Cấu hình số lượng & delay */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11.5px] font-medium text-foreground">
                Số Page / Acc
              </Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={pagesPerAccount}
                onChange={(e) => setPagesPerAccount(Number(e.target.value) || 1)}
                className="h-8 text-xs bg-muted/20 border-border/70 font-mono"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11.5px] font-medium text-foreground">
                Delay (giây)
              </Label>
              <Input
                type="number"
                min={5}
                max={300}
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(Number(e.target.value) || 15)}
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
                setProxyMode(e.target.value as "account" | "direct" | "rotating")
              }
              className="h-8 w-full rounded-lg border border-border/70 bg-muted/20 px-2.5 text-xs text-foreground outline-none focus:border-primary/50 cursor-pointer"
            >
              <option value="account" className="bg-background">
                Sử dụng Proxy gán theo từng tài khoản
              </option>
              <option value="direct" className="bg-background">
                Chạy trực tiếp (Không dùng Proxy)
              </option>
              <option value="rotating" className="bg-background">
                Proxy xoay động (TMProxy / Tinsoft)
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
                setBioText("");
                showSuccessToast("Đã làm mới cấu hình Reg Page!");
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
                onClick={() =>
                  showSuccessToast("Chức năng xuất danh sách đang được chuẩn bị!")
                }
                className="h-7 text-[11px] gap-1 cursor-pointer"
              >
                <LuFileSpreadsheet className="size-3 text-emerald-500" />
                <span>Xuất file</span>
              </Button>
            </div>
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-[40px_1fr_1.4fr_1.2fr_1fr_90px] items-center px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-border/60 bg-muted/5 shrink-0 select-none">
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
            <div>ID Page & Profile chủ</div>
            <div>Thể loại</div>
            <div>Trạng thái</div>
            <div className="text-right pr-2">Thao tác</div>
          </div>

          {/* Table Rows or Empty State */}
          {createdPages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-24 text-center select-none">
              <div className="flex size-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-2.5">
                <LuFlag className="size-6" />
              </div>
              <p className="text-xs font-semibold text-foreground">
                Chưa có Fanpage nào được tạo
              </p>
              <p className="text-[11px] text-muted-foreground max-w-sm mt-1 leading-relaxed">
                Nhập danh sách tên Page ở khung bên trái và bấm{" "}
                <span className="font-semibold text-emerald-500">
                  "Bắt đầu Reg Page"
                </span>{" "}
                để hệ thống tự động khởi tạo Fanpage.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/30 overflow-y-auto flex-1">
              {createdPages.map((page) => (
                <div
                  key={page.id}
                  className="grid grid-cols-[40px_1fr_1.4fr_1.2fr_1fr_90px] items-center px-3 py-2 text-xs text-foreground hover:bg-muted/20 transition-colors"
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
                  <div className="font-semibold text-foreground truncate pr-2">
                    {page.name}
                  </div>
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="font-mono text-muted-foreground text-[11px] truncate">
                      {page.pageId}
                    </span>
                    <span className="text-[10px] text-muted-foreground/70 truncate">
                      Tạo bởi: {page.creatorName || page.creatorUid}
                    </span>
                  </div>
                  <div className="text-muted-foreground truncate text-[11.5px] pr-2">
                    {page.category}
                  </div>
                  <div>
                    {page.status === "success" ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        Thành công
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
            <div className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span>
                {isRunning
                  ? "Tiến trình Reg Page đang hoạt động..."
                  : "Hệ thống sẵn sàng"}
              </span>
            </div>
            <span className="font-mono text-[10px]">AutoLunex Page Engine</span>
          </div>
        </div>
      </div>
    </div>
  );
}
