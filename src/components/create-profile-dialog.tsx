"use client";

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuTrash2, LuUserPlus } from "react-icons/lu";
import { LoadingButton } from "@/components/loading-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { RippleButton } from "./ui/ripple";

type BrowserTypeString = "wayfern";

interface AccountRow {
  id: string;
  uid: string;
  pass: string;
  twoFactor: string;
  cookie: string;
  token: string;
  proxy: string;
}

interface CreateProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProfile: (profileData: {
    name: string;
    browserStr: BrowserTypeString;
    version: string;
    releaseType: string;
    proxyId?: string;
    vpnId?: string;
    groupId?: string;
  }) => Promise<void>;
  selectedGroupId?: string;
  crossOsUnlocked?: boolean;
}

export function CreateProfileDialog({
  isOpen,
  onClose,
  onCreateProfile,
  selectedGroupId,
}: CreateProfileDialogProps) {
  const { t } = useTranslation();

  // 6 checkbox selectors
  const [selectedColumns, setSelectedColumns] = useState({
    uid: true,
    pass: true,
    twoFactor: true,
    cookie: true,
    token: true,
    proxy: true,
  });

  // Note-style free text input: 1 line = 1 account
  const [noteContent, setNoteContent] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const toggleColumn = (col: keyof typeof selectedColumns) => {
    setSelectedColumns((prev) => ({
      ...prev,
      [col]: !prev[col],
    }));
  };

  const handleReset = useCallback(() => {
    setNoteContent("");
  }, []);

  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [handleReset, onClose]);

  // Active columns in order
  const activeColList = (
    [
      { key: "uid", label: "UID" },
      { key: "pass", label: "Pass" },
      { key: "twoFactor", label: "2FA" },
      { key: "cookie", label: "Cookie" },
      { key: "token", label: "Token" },
      { key: "proxy", label: "Proxy" },
    ] as const
  ).filter((col) => selectedColumns[col.key]);

  // Parse lines from note content
  const parsedAccounts: AccountRow[] = noteContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const parts = line.includes("\t") ? line.split("\t") : line.split("|");
      const row: AccountRow = {
        id: `acc-${Date.now()}-${index}`,
        uid: "",
        pass: "",
        twoFactor: "",
        cookie: "",
        token: "",
        proxy: "",
      };

      if (activeColList.length > 0 && parts.length <= activeColList.length) {
        activeColList.forEach((col, i) => {
          row[col.key] = parts[i]?.trim() || "";
        });
      } else {
        row.uid = parts[0]?.trim() || "";
        row.pass = parts[1]?.trim() || "";
        row.twoFactor = parts[2]?.trim() || "";
        row.cookie = parts[3]?.trim() || "";
        row.token = parts[4]?.trim() || "";
        row.proxy = parts[5]?.trim() || "";
      }

      return row;
    });

  const validAccounts = parsedAccounts.filter(
    (acc) =>
      acc.uid.trim() ||
      acc.pass.trim() ||
      acc.twoFactor.trim() ||
      acc.cookie.trim() ||
      acc.token.trim() ||
      acc.proxy.trim(),
  );

  const handleCreate = useCallback(async () => {
    if (validAccounts.length === 0) return;

    setIsCreating(true);
    try {
      for (let i = 0; i < validAccounts.length; i++) {
        const acc = validAccounts[i];
        const profileName =
          acc.uid.trim() ||
          (acc.cookie.trim()
            ? "Cookie-Profile"
            : `Profile-${Date.now()}-${i + 1}`);
        await onCreateProfile({
          name: profileName,
          browserStr: "wayfern",
          version: "151.0.7922.76",
          releaseType: "stable",
          groupId: selectedGroupId,
        });
      }
      handleClose();
    } catch (err) {
      console.error("Failed to create profiles:", err);
    } finally {
      setIsCreating(false);
    }
  }, [handleClose, onCreateProfile, selectedGroupId, validAccounts]);

  const canCreate = validAccounts.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-[min(56rem,calc(100%-3rem))] flex-col p-6">
        <DialogHeader className="shrink-0 border-b border-border/40 pb-3">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <LuUserPlus className="size-5 text-primary" />
            {t("createProfile.title", "Tạo hồ sơ / Thêm tài khoản mới")}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto pr-1">
          <div className="space-y-4 py-3">
            {/* 6 Selector Checkboxes */}
            <div className="rounded-xl border bg-card/60 p-4 shadow-sm backdrop-blur-sm">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Thứ tự định dạng dòng (1 dòng = 1 tài khoản)
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Bật/tắt các trường cần nhập (ngăn cách bởi dấu | hoặc phím
                  Tab)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
                {/* 1. UID */}
                <label
                  htmlFor="col-uid"
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg border bg-background/50 p-2.5 transition-colors hover:bg-muted/50"
                >
                  <Checkbox
                    id="col-uid"
                    checked={selectedColumns.uid}
                    onCheckedChange={() => toggleColumn("uid")}
                  />
                  <span className="text-xs font-medium">1. UID</span>
                </label>

                {/* 2. Pass */}
                <label
                  htmlFor="col-pass"
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg border bg-background/50 p-2.5 transition-colors hover:bg-muted/50"
                >
                  <Checkbox
                    id="col-pass"
                    checked={selectedColumns.pass}
                    onCheckedChange={() => toggleColumn("pass")}
                  />
                  <span className="text-xs font-medium">2. Pass</span>
                </label>

                {/* 3. 2FA */}
                <label
                  htmlFor="col-2fa"
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg border bg-background/50 p-2.5 transition-colors hover:bg-muted/50"
                >
                  <Checkbox
                    id="col-2fa"
                    checked={selectedColumns.twoFactor}
                    onCheckedChange={() => toggleColumn("twoFactor")}
                  />
                  <span className="text-xs font-medium">3. 2FA</span>
                </label>

                {/* 4. Cookie */}
                <label
                  htmlFor="col-cookie"
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg border bg-background/50 p-2.5 transition-colors hover:bg-muted/50"
                >
                  <Checkbox
                    id="col-cookie"
                    checked={selectedColumns.cookie}
                    onCheckedChange={() => toggleColumn("cookie")}
                  />
                  <span className="text-xs font-medium">4. Cookie</span>
                </label>

                {/* 5. Token */}
                <label
                  htmlFor="col-token"
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg border bg-background/50 p-2.5 transition-colors hover:bg-muted/50"
                >
                  <Checkbox
                    id="col-token"
                    checked={selectedColumns.token}
                    onCheckedChange={() => toggleColumn("token")}
                  />
                  <span className="text-xs font-medium">5. Token</span>
                </label>

                {/* 6. Proxy */}
                <label
                  htmlFor="col-proxy"
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg border bg-background/50 p-2.5 transition-colors hover:bg-muted/50"
                >
                  <Checkbox
                    id="col-proxy"
                    checked={selectedColumns.proxy}
                    onCheckedChange={() => toggleColumn("proxy")}
                  />
                  <span className="text-xs font-medium">6. Proxy</span>
                </label>
              </div>
            </div>

            {/* Note Editor Area (Full Free-form Notepad) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Khung nhập liệu tùy ý (Mỗi dòng 1 tài khoản)
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted-foreground">
                    Định dạng:{" "}
                    <span className="text-primary font-medium">
                      {activeColList.map((c) => c.label).join(" | ")}
                    </span>
                  </span>
                  {noteContent.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                      onClick={() => setNoteContent("")}
                    >
                      <LuTrash2 className="size-3.5 mr-1" />
                      Xóa tất cả
                    </Button>
                  )}
                </div>
              </div>

              <div className="relative rounded-xl border bg-card/80 overflow-hidden shadow-sm focus-within:ring-1 focus-within:ring-primary/40">
                <Textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  rows={14}
                  placeholder={`Nhập hoặc dán danh sách tài khoản tại đây, mỗi dòng là một tài khoản:
1000123456|MatKhau123|JBSWY3DPEHPK3PXP|sb=xxx; c_user=xxx;|EAAAAU...|192.168.1.1:8080:user:pass
1000789012|MatKhau456|JBSWY3DPEHPK3PXP|sb=yyy; c_user=yyy;|EAAAAU...|192.168.1.2:8080`}
                  className="min-h-[280px] w-full resize-y border-0 bg-transparent p-4 font-mono text-xs leading-relaxed focus-visible:ring-0"
                />
              </div>

              {/* Live Preview / Counter Summary */}
              {validAccounts.length > 0 && (
                <div className="rounded-lg border border-border/50 bg-muted/25 px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
                  <span>
                    Hệ thống đã nhận diện được{" "}
                    <strong className="text-foreground">
                      {validAccounts.length}
                    </strong>{" "}
                    tài khoản hợp lệ từ văn bản trên
                  </span>
                  <span className="font-mono text-[11px]">
                    Tài khoản đầu: {validAccounts[0].uid || "Không có UID"}
                  </span>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="shrink-0 border-t border-border/40 pt-4 flex items-center justify-between sm:justify-between">
          <div className="text-xs text-muted-foreground">
            {validAccounts.length > 0
              ? `Sẵn sàng tạo ${validAccounts.length} hồ sơ`
              : "Nhập ít nhất 1 dòng tài khoản vào khung trên để tạo"}
          </div>
          <div className="flex items-center gap-2">
            <RippleButton variant="outline" onClick={handleClose}>
              {t("common.buttons.close", "Đóng")}
            </RippleButton>
            <LoadingButton
              onClick={handleCreate}
              isLoading={isCreating}
              disabled={!canCreate}
            >
              {t("common.buttons.create", "Tạo")}
            </LoadingButton>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
