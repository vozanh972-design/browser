"use client";

import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Clipboard,
  ExternalLink,
  Globe,
  Key,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getGolikeUser } from "@/lib/golike-api";
import {
  type GolikeSessionData,
  saveGolikeSession,
  syncGolikeProtocol,
} from "@/lib/golike-session";
import { showSuccessToast } from "@/lib/toast-utils";

interface GolikeLoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: {
    username: string;
    balance: string;
    token: string;
  }) => void;
}

const BRIDGE_URL = "http://127.0.0.1:18899";

export function GolikeLoginDialog({
  isOpen,
  onClose,
  onLoginSuccess,
}: GolikeLoginDialogProps) {
  const [inputText, setInputText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isWaitingBrowser, setIsWaitingBrowser] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Dọn dẹp timer khi đóng dialog
  useEffect(() => {
    if (!isOpen) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      setIsWaitingBrowser(false);
      setLoading(false);
      setStatusMessage("");
      setError("");
    }
  }, [isOpen]);

  const startPollingSession = () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${BRIDGE_URL}/session`, { cache: "no-store" });
        if (!res.ok) return;

        const data = await res.json();
        if (data?.hasSession && data?.session?.golike_token) {
          // Đã bắt được session từ browser!
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }

          setStatusMessage("Đã bắt đủ 17 trường! Đang đồng bộ Protocol GoLike...");
          await handleCompleteLogin(data.session);
        }
      } catch {
        // bridge chưa sẵn sàng hoặc đang chờ
      }
    }, 1200);
  };

  const handleOpenAutoBrowser = async () => {
    setError("");
    setLoading(true);
    setIsWaitingBrowser(true);
    setStatusMessage("Đang khởi động trình duyệt đăng nhập GoLike (Chuẩn GoMax)...");

    try {
      // 1. Thử gọi Local Bridge API mở browser tự động
      let bridgeTriggered = false;
      try {
        const pingRes = await fetch(`${BRIDGE_URL}/ping`, { cache: "no-store" });
        if (pingRes.ok) {
          const openRes = await fetch(`${BRIDGE_URL}/open-login`, {
            method: "POST",
          });
          if (openRes.ok) {
            bridgeTriggered = true;
          }
        }
      } catch {
        bridgeTriggered = false;
      }

      // 2. Nếu bridge server chưa mở sẵn, dùng plugin-opener để khởi chạy launcher bat
      if (!bridgeTriggered) {
        try {
          const { openUrl } = await import("@tauri-apps/plugin-opener");
          await openUrl("D:\\AutoLunex\\start-golike-login.bat").catch(async () => {
            await openUrl("D:\\browser\\scripts\\start-golike-login.bat");
          });
          bridgeTriggered = true;
        } catch {
          // Fallback mở web thông thường
          window.open("https://app.golike.net/login", "_blank");
        }
      }

      setStatusMessage(
        "Cửa sổ GoLike đã mở. Vui lòng đăng nhập tài khoản trên cửa sổ vừa mở (Hệ thống sẽ tự động bắt phiên 17 trường và đóng cửa sổ khi thành công)...",
      );

      // 3. Bắt đầu polling lắng nghe session
      startPollingSession();
    } catch (err: unknown) {
      setLoading(false);
      setIsWaitingBrowser(false);
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Không thể tự mở trình duyệt: ${msg}`);
    }
  };

  const handleCompleteLogin = async (sessionData: Partial<GolikeSessionData>) => {
    try {
      // 1. Lưu đủ 17 trường vào bộ nhớ
      const fullSession = saveGolikeSession(sessionData);

      // 2. Đồng bộ Protocol với Golike Gateway
      try {
        await syncGolikeProtocol(fullSession);
      } catch {
        // ignore
      }

      // 3. Lấy thông tin user và coin
      const res = await getGolikeUser(fullSession);

      if (!res.success || !res.user) {
        setLoading(false);
        setIsWaitingBrowser(false);
        setError(
          res.error ||
            "Phiên làm việc GoLike không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.",
        );
        return;
      }

      const balance = `${res.user.coin.toLocaleString("vi-VN")} coin`;

      try {
        localStorage.setItem("golike_username", res.user.username);
        localStorage.setItem("golike_balance", balance);
      } catch {
        // ignore
      }

      setLoading(false);
      setIsWaitingBrowser(false);

      showSuccessToast(
        `Đăng nhập GoLike chuẩn GoMax thành công! Chào mừng ${res.user.username}`,
      );

      onLoginSuccess({
        username: res.user.username,
        balance,
        token: fullSession.golike_token,
      });

      setInputText("");
      onClose();
    } catch (err: unknown) {
      setLoading(false);
      setIsWaitingBrowser(false);
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Lỗi hoàn tất đăng nhập: ${msg}`);
    }
  };

  const handleManualLogin = async () => {
    const raw = inputText.trim();
    if (!raw) {
      setError("Vui lòng nhập Token hoặc chuỗi JSON 17 trường.");
      return;
    }

    // Chặn người dùng dán nhầm toàn bộ mã script JS vào ô token
    if (
      raw.includes("function") ||
      raw.includes("=>") ||
      raw.includes("hasInjected") ||
      raw.includes("localStorage.getItem")
    ) {
      setError(
        "Bạn vừa dán đoạn mã JavaScript! Vui lòng không dán script vào ô này. Hãy bấm nút 'Mở Trình Duyệt Đăng Nhập GoLike' ở trên để hệ thống tự động đăng nhập 100%.",
      );
      return;
    }

    setLoading(true);
    setError("");

    let sessionToSave: Partial<GolikeSessionData> = {};

    if (raw.startsWith("{") && raw.endsWith("}")) {
      try {
        const parsed = JSON.parse(raw);
        sessionToSave = {
          golike_token:
            parsed.golike_token || parsed.token || parsed.authorization || "",
          golike_t_header: parsed.golike_t_header || parsed.t || "",
          golike_g_auth: parsed.golike_g_auth || parsed["g-auth"] || "",
          golike_device_id:
            parsed.golike_device_id ||
            parsed.deviceId ||
            parsed.device_id ||
            "",
          golike_username: parsed.golike_username || parsed.username || "",
          golike_user_id: String(
            parsed.golike_user_id || parsed.user_id || "",
          ),
          golike_signing_key:
            parsed.golike_signing_key || parsed.signing_key || "",
          golike_web_data: parsed.golike_web_data || "null",
          golike_web_cookies:
            parsed.golike_web_cookies || parsed.cookies || "",
          golike_header: parsed.golike_header || {},
          golike_tiktok_map: parsed.golike_tiktok_map || {},
          golike_version_app: parsed.golike_version_app || "3.0",
          golike_web_version: parsed.golike_web_version || "3.0",
          golike_web_version_text:
            parsed.golike_web_version_text || "26.09.17.1",
          golike_protocol: parsed.golike_protocol || "v2",
          golike_gauth_version: parsed.golike_gauth_version || "1.0",
          golike_scheme: parsed.golike_scheme || "https",
        };
      } catch {
        setLoading(false);
        setError("Chuỗi JSON không hợp lệ. Vui lòng kiểm tra lại định dạng.");
        return;
      }
    } else {
      // Dán chuỗi Token thông thường
      const cleanToken = raw
        .replace(/^Bearer\s+/i, "")
        .replace(/[^\x20-\x7E\xA0-\xFF]/g, "")
        .trim();

      if (!cleanToken) {
        setLoading(false);
        setError("Mã Token không hợp lệ. Vui lòng kiểm tra lại.");
        return;
      }

      sessionToSave = {
        golike_token: `Bearer ${cleanToken}`,
      };
    }

    await handleCompleteLogin(sessionToSave);
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputText(text.trim());
        if (error) setError("");
      }
    } catch {
      // ignore
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden rounded-2xl border border-border/80 shadow-2xl bg-card">
        {/* Header */}
        <DialogHeader className="p-5 pb-3 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <span>Đăng nhập tài khoản GoLike</span>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                  Chuẩn GoMax 17 Trường
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Cơ chế tự mở web đăng nhập & tự động bắt toàn bộ 17 trường Session chuẩn GoMax.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 flex flex-col gap-4 text-xs">
          {/* Card nổi bật: Tự động mở web đăng nhập */}
          <div className="p-4 rounded-xl border border-cyan-500/30 bg-linear-to-b from-cyan-500/10 to-transparent flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 shrink-0 mt-0.5">
                <Globe className="size-5" />
              </div>
              <div className="flex flex-col gap-1">
                <h4 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                  <span>Tự động mở trình duyệt GoLike</span>
                  <Sparkles className="size-3.5 text-cyan-400" />
                </h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Trình duyệt sẽ tự động mở trang đăng nhập GoLike (chế độ Mobile iOS chuẩn GoMax giúp dễ dàng vượt Captcha Cloudflare). Bạn chỉ cần đăng nhập, hệ thống sẽ <b>tự động thu thập đủ 17 trường</b> và đóng cửa sổ khi hoàn tất.
                </p>
              </div>
            </div>

            {isWaitingBrowser ? (
              <div className="p-3 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center gap-3">
                <Loader2 className="size-4 text-cyan-400 animate-spin shrink-0" />
                <span className="text-[11px] text-cyan-200 font-medium">
                  {statusMessage}
                </span>
              </div>
            ) : (
              <Button
                type="button"
                onClick={handleOpenAutoBrowser}
                disabled={loading}
                className="w-full h-9 text-xs font-semibold cursor-pointer bg-cyan-600 hover:bg-cyan-700 text-white gap-2 shadow-sm"
              >
                <ExternalLink className="size-3.5" />
                <span>Mở Trình Duyệt Đăng Nhập GoLike (Tự Động 100%)</span>
              </Button>
            )}
          </div>

          {/* Nút bật/tắt nhập thủ công */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowManualInput(!showManualInput)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer font-medium transition-colors"
            >
              {showManualInput ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
              <span>Hoặc dán Token / JSON 17 trường thủ công (Dự phòng)</span>
            </button>
          </div>

          {/* Form nhập thủ công (Collapsible) */}
          {showManualInput && (
            <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-muted/20 border border-border/60">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="golike-manual-input"
                  className="text-xs font-semibold text-foreground flex items-center gap-1.5"
                >
                  <Key className="size-3.5 text-cyan-400" />
                  <span>Dán Token hoặc JSON 17 Trường</span>
                </Label>
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 cursor-pointer font-medium"
                >
                  <Clipboard className="size-3" />
                  <span>Dán</span>
                </button>
              </div>

              <Textarea
                id="golike-manual-input"
                rows={3}
                placeholder="Dán mã Authorization Token (Bearer ...) hoặc JSON 17 trường tại đây..."
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  if (error) setError("");
                }}
                className="text-xs font-mono resize-none bg-background/60"
              />

              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={handleManualLogin}
                  disabled={loading || !inputText.trim()}
                  className="h-7 text-[11px] px-3 cursor-pointer"
                >
                  {loading ? "Đang xác thực..." : "Xác nhận & Đồng bộ"}
                </Button>
              </div>
            </div>
          )}

          {/* Thông báo lỗi nếu có */}
          {error && (
            <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-[11px] text-destructive flex items-start gap-2">
              <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
              <span className="leading-tight font-medium">{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 bg-muted/20 border-t border-border/40">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs cursor-pointer"
          >
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
