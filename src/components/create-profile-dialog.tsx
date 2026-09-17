"use client";

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LuClipboardList,
  LuFileSpreadsheet,
  LuPlus,
  LuTrash2,
  LuUserPlus,
} from "react-icons/lu";
import { LoadingButton } from "@/components/loading-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  // 6 core input fields
  const [uid, setUid] = useState("");
  const [pass, setPass] = useState("");
  const [twoFactor, setTwoFactor] = useState("");
  const [cookie, setCookie] = useState("");
  const [token, setToken] = useState("");
  const [proxy, setProxy] = useState("");

  // Table data state
  const [tableRows, setTableRows] = useState<AccountRow[]>([]);
  const [bulkInput, setBulkInput] = useState("");
  const [showBulkInput, setShowBulkInput] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleReset = useCallback(() => {
    setUid("");
    setPass("");
    setTwoFactor("");
    setCookie("");
    setToken("");
    setProxy("");
    setTableRows([]);
    setBulkInput("");
    setShowBulkInput(false);
  }, []);

  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [handleReset, onClose]);

  // Add the 6 filled inputs as a new row into the table
  const handleAddRow = useCallback(() => {
    if (
      !uid.trim() &&
      !pass.trim() &&
      !cookie.trim() &&
      !token.trim() &&
      !proxy.trim()
    ) {
      return;
    }

    const newRow: AccountRow = {
      id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      uid: uid.trim(),
      pass: pass.trim(),
      twoFactor: twoFactor.trim(),
      cookie: cookie.trim(),
      token: token.trim(),
      proxy: proxy.trim(),
    };

    setTableRows((prev) => [...prev, newRow]);
    // Clear inputs after adding
    setUid("");
    setPass("");
    setTwoFactor("");
    setCookie("");
    setToken("");
    setProxy("");
  }, [cookie, pass, proxy, token, twoFactor, uid]);

  // Parse bulk text: uid|pass|2fa|cookie|token|proxy
  const handleImportBulk = useCallback(() => {
    if (!bulkInput.trim()) return;

    const lines = bulkInput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const parsedRows: AccountRow[] = lines.map((line, index) => {
      // Split by | or tab
      const parts = line.includes("\t") ? line.split("\t") : line.split("|");
      return {
        id: `bulk-${Date.now()}-${index}`,
        uid: parts[0]?.trim() || "",
        pass: parts[1]?.trim() || "",
        twoFactor: parts[2]?.trim() || "",
        cookie: parts[3]?.trim() || "",
        token: parts[4]?.trim() || "",
        proxy: parts[5]?.trim() || "",
      };
    });

    if (parsedRows.length > 0) {
      setTableRows((prev) => [...prev, ...parsedRows]);
      setBulkInput("");
      setShowBulkInput(false);
    }
  }, [bulkInput]);

  const handleDeleteRow = useCallback((id: string) => {
    setTableRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const handleClearAllRows = useCallback(() => {
    setTableRows([]);
  }, []);

  const handleCreate = useCallback(async () => {
    setIsCreating(true);
    try {
      if (tableRows.length > 0) {
        // Create profiles from table rows
        for (let i = 0; i < tableRows.length; i++) {
          const row = tableRows[i];
          const profileName = row.uid || `Account-${i + 1}`;
          await onCreateProfile({
            name: profileName,
            browserStr: "wayfern",
            version: "151.0.7922.76",
            releaseType: "stable",
            groupId: selectedGroupId,
          });
        }
      } else {
        // Create single profile from the 6 inputs if filled
        const profileName =
          uid.trim() ||
          (cookie.trim() ? "Cookie-Profile" : `Profile-${Date.now()}`);
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
  }, [handleClose, onCreateProfile, selectedGroupId, tableRows, uid, cookie]);

  const canCreate =
    tableRows.length > 0 ||
    uid.trim().length > 0 ||
    pass.trim().length > 0 ||
    cookie.trim().length > 0 ||
    token.trim().length > 0 ||
    proxy.trim().length > 0;

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
          <div className="space-y-5 py-3">
            {/* 6 Core Fields Grid */}
            <div className="rounded-xl border bg-card/60 p-4 shadow-sm backdrop-blur-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Thông tin 6 trường (UID | Pass | 2FA | Cookie | Token | Proxy)
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs"
                  onClick={handleAddRow}
                  disabled={
                    !uid.trim() &&
                    !pass.trim() &&
                    !cookie.trim() &&
                    !token.trim() &&
                    !proxy.trim()
                  }
                >
                  <LuPlus className="size-3.5" />
                  Thêm vào bảng
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:grid-cols-3">
                {/* 1. UID */}
                <div className="space-y-1.5">
                  <Label htmlFor="field-uid" className="text-xs font-medium">
                    1. UID
                  </Label>
                  <Input
                    id="field-uid"
                    value={uid}
                    onChange={(e) => setUid(e.target.value)}
                    placeholder="Nhập UID tài khoản..."
                    className="h-9 font-mono text-xs"
                  />
                </div>

                {/* 2. Pass */}
                <div className="space-y-1.5">
                  <Label htmlFor="field-pass" className="text-xs font-medium">
                    2. Pass
                  </Label>
                  <Input
                    id="field-pass"
                    type="text"
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    placeholder="Nhập mật khẩu..."
                    className="h-9 font-mono text-xs"
                  />
                </div>

                {/* 3. 2FA */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="field-2fa"
                    className="text-xs font-medium"
                  >
                    3. 2FA
                  </Label>
                  <Input
                    id="field-2fa"
                    value={twoFactor}
                    onChange={(e) => setTwoFactor(e.target.value)}
                    placeholder="Khóa bí mật 2FA..."
                    className="h-9 font-mono text-xs"
                  />
                </div>

                {/* 4. Cookie */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="field-cookie"
                    className="text-xs font-medium"
                  >
                    4. Cookie
                  </Label>
                  <Input
                    id="field-cookie"
                    value={cookie}
                    onChange={(e) => setCookie(e.target.value)}
                    placeholder="sb=...; c_user=...;"
                    className="h-9 font-mono text-xs"
                  />
                </div>

                {/* 5. Token */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="field-token"
                    className="text-xs font-medium"
                  >
                    5. Token
                  </Label>
                  <Input
                    id="field-token"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="EAAAAU..."
                    className="h-9 font-mono text-xs"
                  />
                </div>

                {/* 6. Proxy */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="field-proxy"
                    className="text-xs font-medium"
                  >
                    6. Proxy
                  </Label>
                  <Input
                    id="field-proxy"
                    value={proxy}
                    onChange={(e) => setProxy(e.target.value)}
                    placeholder="IP:Port hoặc IP:Port:User:Pass"
                    className="h-9 font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Quick Bulk Import Area */}
            <div className="rounded-xl border bg-muted/20 p-3">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setShowBulkInput((prev) => !prev)}
                >
                  <LuClipboardList className="size-3.5" />
                  {showBulkInput
                    ? "Ẩn khung nhập hàng loạt"
                    : "Dán dữ liệu hàng loạt (UID|Pass|2FA|Cookie|Token|Proxy)"}
                </Button>
                {tableRows.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-xs text-destructive hover:bg-destructive/10"
                    onClick={handleClearAllRows}
                  >
                    <LuTrash2 className="size-3.5" />
                    Xóa tất cả hàng ({tableRows.length})
                  </Button>
                )}
              </div>

              {showBulkInput && (
                <div className="mt-3 space-y-2">
                  <Textarea
                    value={bulkInput}
                    onChange={(e) => setBulkInput(e.target.value)}
                    rows={4}
                    placeholder="Dán mỗi dòng một tài khoản theo định dạng:&#10;1000123456|MatKhau123|JBSWY3DPEHPK3PXP|sb=xxx; c_user=xxx;|EAAAAU...|192.168.1.1:8080:user:pass"
                    className="font-mono text-xs"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={handleImportBulk}
                    >
                      <LuFileSpreadsheet className="size-3.5" />
                      Nhập vào bảng
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Large Table Input / Display Area */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Bảng danh sách nhập liệu ({tableRows.length})
                </span>
              </div>

              <div className="rounded-xl border bg-card/80 overflow-hidden shadow-sm">
                {tableRows.length > 0 ? (
                  <div className="max-h-[320px] overflow-y-auto">
                    <Table>
                      <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur-sm">
                        <TableRow>
                          <TableHead className="w-12 text-center text-xs">
                            #
                          </TableHead>
                          <TableHead className="text-xs">UID</TableHead>
                          <TableHead className="text-xs">Pass</TableHead>
                          <TableHead className="text-xs">2FA</TableHead>
                          <TableHead className="text-xs">Cookie</TableHead>
                          <TableHead className="text-xs">Token</TableHead>
                          <TableHead className="text-xs">Proxy</TableHead>
                          <TableHead className="w-16 text-center text-xs">
                            Xóa
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tableRows.map((row, idx) => (
                          <TableRow key={row.id} className="hover:bg-muted/40">
                            <TableCell className="text-center font-mono text-xs text-muted-foreground">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="max-w-[120px] truncate font-mono text-xs font-medium">
                              {row.uid || "-"}
                            </TableCell>
                            <TableCell className="max-w-[100px] truncate font-mono text-xs text-muted-foreground">
                              {row.pass ? "••••••••" : "-"}
                            </TableCell>
                            <TableCell className="max-w-[100px] truncate font-mono text-xs text-muted-foreground">
                              {row.twoFactor || "-"}
                            </TableCell>
                            <TableCell
                              className="max-w-[140px] truncate font-mono text-xs text-muted-foreground"
                              title={row.cookie}
                            >
                              {row.cookie || "-"}
                            </TableCell>
                            <TableCell
                              className="max-w-[110px] truncate font-mono text-xs text-muted-foreground"
                              title={row.token}
                            >
                              {row.token || "-"}
                            </TableCell>
                            <TableCell
                              className="max-w-[130px] truncate font-mono text-xs text-muted-foreground"
                              title={row.proxy}
                            >
                              {row.proxy || "-"}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteRow(row.id)}
                              >
                                <LuTrash2 className="size-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <LuFileSpreadsheet className="size-10 text-muted-foreground/40 mb-2" />
                    <p className="text-sm font-medium text-muted-foreground">
                      Chưa có tài khoản nào trong bảng
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1 max-w-sm">
                      Điền thông tin vào 6 ô bên trên rồi nhấn &quot;Thêm vào
                      bảng&quot;, hoặc sử dụng chức năng dán dữ liệu hàng loạt.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="shrink-0 border-t border-border/40 pt-4 flex items-center justify-between sm:justify-between">
          <div className="text-xs text-muted-foreground">
            {tableRows.length > 0
              ? `Đã có ${tableRows.length} tài khoản sẵn sàng tạo`
              : uid.trim()
                ? "Sẵn sàng tạo 1 hồ sơ từ các ô đã nhập"
                : "Nhập thông tin để tạo hồ sơ"}
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
