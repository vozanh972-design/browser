"use client";

import {
  Check,
  Clipboard,
  Code2,
  ExternalLink,
  Key,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
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
  GOLIKE_INJECT_JS,
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

export function GolikeLoginDialog({
  isOpen,
  onClose,
  onLoginSuccess,
}: GolikeLoginDialogProps) {
  const [inputText, setInputText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  const handleCopyInjectScript = async () => {
    // Mã Bookmarklet / Console 1-click tự động bóc tách đủ 17 trường từ app.golike.net
    const oneClickScript = `
(function() {
  let s = {
    golike_token: '',
    golike_t_header: '',
    golike_g_auth: '',
    golike_device_id: '',
    golike_username: '',
    golike_user_id: '',
    golike_signing_key: '',
    golike_web_data: localStorage.getItem('__') || 'null',
    golike_web_cookies: document.cookie || '',
    golike_header: {},
    golike_tiktok_map: {},
    golike_version_app: '3.0',
    golike_web_version: '3.0',
    golike_web_version_text: '26.09.17.1',
    golike_protocol: 'v2',
    golike_gauth_version: '1.0',
    golike_scheme: 'https'
  };

  try {
    let appRoot = document.querySelector('#app');
    let state = appRoot && appRoot.__vue__ && appRoot.__vue__.$store ? appRoot.__vue__.$store.state : null;
    if (state) {
      if (state.signing_key) s.golike_signing_key = String(state.signing_key);
      if (state.user_id) s.golike_user_id = String(state.user_id);
      if (state.device_id || state.deviceId) s.golike_device_id = String(state.device_id || state.deviceId);
      if (state.username || state.user_name) s.golike_username = String(state.username || state.user_name);
      if (state.app_version || state.version) s.golike_version_app = String(state.app_version || state.version);
    }
  } catch(e) {}

  for (let i = 0; i < localStorage.length; i++) {
    let k = localStorage.key(i);
    let v = localStorage.getItem(k);
    if (!s.golike_signing_key && k === 'signing_key') s.golike_signing_key = v;
    if (!s.golike_user_id && k === 'user_id') s.golike_user_id = v;
    if (!s.golike_device_id && (k === 'device_id' || k === 'deviceId')) s.golike_device_id = v;
    if (!s.golike_username && k === 'username') s.golike_username = v;
    if (!s.golike_token && (k === 'token' || k === 'auth_token')) s.golike_token = v;
  }

  let match = document.body && document.body.innerText ? document.body.innerText.match(/(\\d+\\.\\d+\\.\\d+\\.\\d+)/) : null;
  if (match) s.golike_web_version_text = match[1];

  try {
    let vuexAuth = JSON.parse(localStorage.getItem('__') || '{}');
    if (vuexAuth && vuexAuth.auth && vuexAuth.auth.token) s.golike_token = vuexAuth.auth.token;
  } catch(e) {}

  if (s.golike_token && !s.golike_token.startsWith('Bearer ')) s.golike_token = 'Bearer ' + s.golike_token;

  let jsonStr = JSON.stringify(s, null, 2);
  navigator.clipboard.writeText(jsonStr).then(() => {
    alert('✅ ĐÃ COPY ĐỦ 17 TRƯỜNG GOLIKE VÀO CLIPBOARD! Hãy quay lại AutoLunex và bấm Dán.');
  }).catch(() => {
    prompt('Copy Session GoLike:', jsonStr);
  });
})();
`.trim();

    try {
      await navigator.clipboard.writeText(oneClickScript);
      setCopiedScript(true);
      showSuccessToast("Đã copy mã script tiêm Console F12 GoLike!");
      setTimeout(() => setCopiedScript(false), 2500);
    } catch {
      // ignore
    }
  };

  const handleOpenGolikeWeb = async () => {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl("https://app.golike.net");
    } catch {
      window.open("https://app.golike.net", "_blank");
    }
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

  const handleLogin = async () => {
    const raw = inputText.trim();
    if (!raw) {
      setError("Vui lòng nhập Token hoặc dán JSON Session GoLike.");
      return;
    }

    setLoading(true);
    setError("");

    let sessionToSave: Partial<GolikeSessionData> = {};

    // 1. Kiểm tra xem người dùng dán JSON 17 trường hay dán Token đơn thuần
    if (raw.startsWith("{") && raw.endsWith("}")) {
      try {
        const parsed = JSON.parse(raw);
        sessionToSave = {
          golike_token: parsed.golike_token || parsed.token || parsed.authorization || "",
          golike_t_header: parsed.golike_t_header || parsed.t || "",
          golike_g_auth: parsed.golike_g_auth || parsed["g-auth"] || "",
          golike_device_id: parsed.golike_device_id || parsed.deviceId || parsed.device_id || "",
          golike_username: parsed.golike_username || parsed.username || "",
          golike_user_id: String(parsed.golike_user_id || parsed.user_id || ""),
          golike_signing_key: parsed.golike_signing_key || parsed.signing_key || "",
          golike_web_data: parsed.golike_web_data || "null",
          golike_web_cookies: parsed.golike_web_cookies || parsed.cookies || "",
          golike_header: parsed.golike_header || {},
          golike_tiktok_map: parsed.golike_tiktok_map || {},
          golike_version_app: parsed.golike_version_app || "3.0",
          golike_web_version: parsed.golike_web_version || "3.0",
          golike_web_version_text: parsed.golike_web_version_text || "26.09.17.1",
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
      const cleanToken = raw.replace(/^Bearer\s+/i, "").trim();
      sessionToSave = {
        golike_token: `Bearer ${cleanToken}`,
      };
    }

    if (!sessionToSave.golike_token) {
      setLoading(false);
      setError("Không tìm thấy trường golike_token / Authorization hợp lệ.");
      return;
    }

    // 2. Lưu toàn bộ 17 trường vào bộ nhớ bền vững (Storage)
    const fullSession = saveGolikeSession(sessionToSave);

    // 3. Bước cực kỳ quan trọng: Gọi Sync Protocol GoLike
    try {
      await syncGolikeProtocol(fullSession);
    } catch {
      // ignore
    }

    // 4. Lấy thông tin người dùng và số coin
    const res = await getGolikeUser(fullSession);

    if (!res.success || !res.user) {
      setLoading(false);
      setError(
        res.error ||
          "Mã Token GoLike không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại.",
      );
      return;
    }

    setLoading(false);
    const balance = `${res.user.coin.toLocaleString("vi-VN")} coin`;

    try {
      localStorage.setItem("golike_username", res.user.username);
      localStorage.setItem("golike_balance", balance);
    } catch {
      // ignore
    }

    onLoginSuccess({
      username: res.user.username,
      balance,
      token: fullSession.golike_token,
    });

    setInputText("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden rounded-2xl border border-border/80 shadow-2xl">
        <DialogHeader className="p-5 pb-3 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <span>Đăng nhập tài khoản GoLike</span>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                  Chuẩn 17 Trường
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Lưu đủ 17 trường Session chuẩn GoMax, đồng bộ Protocol không lo bị chặn phiên bản.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 flex flex-col gap-4 text-xs">
          {/* Quick actions: Mở web & Copy mã tiêm JS */}
          <div className="grid grid-cols-2 gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenGolikeWeb}
              className="h-8 text-xs gap-1.5 cursor-pointer bg-muted/30 hover:bg-muted/60 border-border/70"
            >
              <ExternalLink className="size-3.5 text-cyan-400" />
              <span>Mở Web GoLike</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyInjectScript}
              className="h-8 text-xs gap-1.5 cursor-pointer bg-muted/30 hover:bg-muted/60 border-border/70"
            >
              {copiedScript ? (
                <Check className="size-3.5 text-emerald-400" />
              ) : (
                <Code2 className="size-3.5 text-amber-400" />
              )}
              <span>{copiedScript ? "Đã copy script!" : "Copy mã tiêm F12"}</span>
            </Button>
          </div>

          {/* Hướng dẫn ngắn */}
          <div className="p-3 rounded-xl bg-muted/20 border border-border/60 text-[11px] text-muted-foreground flex flex-col gap-1.5 leading-relaxed">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="size-3 text-cyan-400" />
              <span>Cách lấy Session GoLike (Không bị chặn Cloudflare):</span>
            </div>
            <p>
              1. Bấm <b>"Mở Web GoLike"</b> để đăng nhập tài khoản trên trình duyệt.
            </p>
            <p>
              2. Bấm <b>"Copy mã tiêm F12"</b> $\rightarrow$ F12 Console dán vào để tự động copy trọn bộ 17 trường.
            </p>
            <p>
              3. Hoặc dán trực tiếp mã <b>Authorization Token</b> (Bearer...) vào ô bên dưới.
            </p>
          </div>

          {/* Ô nhập Token hoặc JSON Session */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="golike-session-input"
                className="text-xs font-semibold text-foreground flex items-center gap-1.5"
              >
                <Key className="size-3.5 text-cyan-400" />
                <span>Dán Token hoặc JSON 17 Trường</span>
                <span className="text-destructive">*</span>
              </Label>
              <button
                type="button"
                onClick={handlePasteClipboard}
                className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 cursor-pointer font-medium"
              >
                <Clipboard className="size-3" />
                <span>Dán từ bộ nhớ tạm</span>
              </button>
            </div>

            <Textarea
              id="golike-session-input"
              rows={4}
              placeholder="Dán mã Authorization Token (Bearer ...) hoặc chuỗi JSON 17 trường tại đây..."
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                if (error) setError("");
              }}
              className="text-xs font-mono resize-none"
            />

            {error && (
              <span className="text-[11px] text-destructive font-medium mt-0.5">
                {error}
              </span>
            )}
          </div>
        </div>

        <DialogFooter className="p-4 bg-muted/20 border-t border-border/40 gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs"
          >
            Hủy
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleLogin}
            disabled={loading}
            className="text-xs font-semibold cursor-pointer bg-cyan-600 hover:bg-cyan-700 text-white gap-1.5"
          >
            {loading ? "Đang đồng bộ..." : "Đăng nhập & Đồng bộ Protocol"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
