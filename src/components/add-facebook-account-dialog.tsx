"use client";

import { useState } from "react";
import { FaFacebook } from "react-icons/fa";
import { LuCheck, LuKey, LuRotateCcw } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface AddFacebookAccountDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAddAccounts?: (accounts: string[], format: string) => void;
  isXsmmLoggedIn?: boolean;
}

const FORMAT_OPTIONS = [
  { id: "uid", label: "UID" },
  { id: "pass", label: "Mật khẩu" },
  { id: "2fa", label: "2FA" },
  { id: "cookie", label: "Cookie" },
  { id: "mail", label: "Mail" },
  { id: "passmail", label: "Pass Mail" },
];

export function AddFacebookAccountDialog({
  isOpen,
  onClose,
  onAddAccounts,
  isXsmmLoggedIn = false,
}: AddFacebookAccountDialogProps) {
  // 6 nút định dạng: mặc định KHÔNG chọn sẵn nút nào
  const [selectedFormat, setSelectedFormat] = useState<string[]>([]);
  const [accountText, setAccountText] = useState("");

  // Trạng thái đăng nhập XSMM và ô nhập Token
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [xsmmToken, setXsmmToken] = useState("");
  const [localLoggedInXsmm, setLocalLoggedInXsmm] = useState(false);

  const isAuthedXsmm = isXsmmLoggedIn || localLoggedInXsmm;

  // Xử lý chọn/bỏ chọn định dạng
  const toggleFormat = (id: string) => {
    setSelectedFormat((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
  };

  const resetFormat = () => {
    setSelectedFormat([]);
  };

  const handleSaveToken = () => {
    if (xsmmToken.trim()) {
      setLocalLoggedInXsmm(true);
      setShowTokenInput(false);
    }
  };

  // Đếm số tài khoản hợp lệ
  const lines = accountText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const formatString = selectedFormat
    .map((id) => FORMAT_OPTIONS.find((f) => f.id === id)?.label)
    .filter(Boolean)
    .join("|");

  const handleSubmit = () => {
    if (lines.length > 0 && onAddAccounts) {
      onAddAccounts(lines, formatString);
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <FaFacebook className="size-5 text-[#1877F2]" />
            <DialogTitle>Thêm tài khoản Facebook</DialogTitle>
          </div>
          <DialogDescription>
            Nhập danh sách tài khoản theo định dạng tự chọn bên dưới.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Phần chọn định dạng - 6 nút mặc định không chọn sẵn */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Chọn định dạng nhập ({selectedFormat.length}/6)
              </Label>
              {selectedFormat.length > 0 && (
                <button
                  type="button"
                  onClick={resetFormat}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                >
                  <LuRotateCcw className="size-3" />
                  <span>Chọn lại</span>
                </button>
              )}
            </div>

            {/* 6 nút định dạng */}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {FORMAT_OPTIONS.map((opt) => {
                const index = selectedFormat.indexOf(opt.id);
                const isSelected = index !== -1;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleFormat(opt.id)}
                    className={cn(
                      "relative flex h-9 items-center justify-center rounded-lg border text-xs font-medium transition-all cursor-pointer select-none",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                        : "border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                    )}
                  >
                    {isSelected && (
                      <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                        {index + 1}
                      </span>
                    )}
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Preview định dạng */}
            <div className="rounded-md bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Định dạng: </span>
              {formatString ? (
                <span className="font-mono text-primary">{formatString}</span>
              ) : (
                <span className="italic text-muted-foreground/70">
                  (Chưa chọn định dạng - hãy click các nút ở trên)
                </span>
              )}
            </div>
          </div>

          {/* Textarea nhập danh sách tài khoản */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Danh sách tài khoản
              </Label>
              <span className="text-[11px] text-muted-foreground">
                Đã nhập: {lines.length} tài khoản
              </span>
            </div>
            <Textarea
              rows={6}
              value={accountText}
              onChange={(e) => setAccountText(e.target.value)}
              placeholder={
                formatString
                  ? `Nhập danh sách theo định dạng: ${formatString}\nMỗi dòng 1 tài khoản...`
                  : "Nhập danh sách tài khoản (mỗi dòng 1 tài khoản)..."
              }
              className="font-mono text-xs"
            />
          </div>

          {/* Khu vực Đăng nhập XSMM */}
          <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LuKey className="size-4 text-primary" />
                <span className="text-xs font-medium text-foreground">
                  {isAuthedXsmm
                    ? "Đã đăng nhập XSMM"
                    : "Bạn cần đăng nhập XSMM trước"}
                </span>
              </div>
              {!isAuthedXsmm ? (
                <Button
                  type="button"
                  size="sm"
                  variant={showTokenInput ? "secondary" : "default"}
                  onClick={() => setShowTokenInput((v) => !v)}
                  className="h-7 text-xs px-3 cursor-pointer"
                >
                  {showTokenInput ? "Đóng" : "Đăng nhập"}
                </Button>
              ) : (
                <span className="flex items-center gap-1 text-xs text-success font-medium">
                  <LuCheck className="size-3.5" />
                  Đã xác thực
                </span>
              )}
            </div>

            {/* Dòng hiện ra để nhập Token khi bấm nút Đăng nhập */}
            {showTokenInput && !isAuthedXsmm && (
              <div className="flex flex-col gap-2 pt-2 border-t border-border/50 animate-in fade-in duration-200">
                <Label className="text-[11px] text-muted-foreground">
                  Nhập Access Token XSMM của bạn:
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={xsmmToken}
                    onChange={(e) => setXsmmToken(e.target.value)}
                    placeholder="Dán token XSMM vào đây..."
                    className="h-8 text-xs font-mono flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveToken}
                    disabled={!xsmmToken.trim()}
                    className="h-8 text-xs cursor-pointer px-4"
                  >
                    Xác nhận
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="cursor-pointer"
          >
            Hủy
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={lines.length === 0}
            className="cursor-pointer"
          >
            Thêm tài khoản
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
