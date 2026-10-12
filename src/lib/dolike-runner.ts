import { type FacebookAccount } from "@/app/page";
import {
  getDolikeJob,
  linkDolikeAccountFull,
  reportDolikeJob,
  skipDolikeJob,
  type DolikeJob,
} from "./dolike-api";
import {
  checkCookieIg,
  doComment,
  doFollow,
  doLike,
  extractShortcode,
  normalizeCookie,
  resolveMediaId,
  resolveTargetUserId,
  shortcodeToMediaId,
  type IgActionResult,
} from "./instagram-api";
export interface AccountRunState {
  accountId: string;
  uid: string;
  name: string;
  platform: "facebook" | "instagram";
  isRunning: boolean;
  status: string;
  successCount: number;
  errorCount: number;
  earnedPoints: number;
  lastError?: string;
}

/** Danh sách nội dung comment mẫu chuẩn GoMax (Lx/gu1;) */
const GOMAX_DOLIKE_DEFAULT_COMMENTS = [
  "Thích quá ạ",
  "Dễ thương quá nè ❤️",
  "❤️",
  "Tuyệt vời quá!",
  "Xinh quá nè",
  "Đẹp quá",
];

type StateListener = (states: Map<string, AccountRunState>) => void;

class DolikeRunnerManager {
  private activeJobs = new Map<string, AbortController>();
  private states = new Map<string, AccountRunState>();
  private listeners = new Set<StateListener>();
  private onBalanceUpdatedCallback?: (balance: string) => void;

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(new Map(this.states));
    return () => {
      this.listeners.delete(listener);
    };
  }

  public setOnBalanceUpdated(callback: (balance: string) => void): void {
    this.onBalanceUpdatedCallback = callback;
  }

  private notify(): void {
    const copy = new Map(this.states);
    for (const listener of this.listeners) {
      try {
        listener(copy);
      } catch {
        // ignore
      }
    }
  }

  private updateState(accountId: string, patch: Partial<AccountRunState>): void {
    const cur = this.states.get(accountId);
    if (!cur) return;
    this.states.set(accountId, { ...cur, ...patch });
    this.notify();
  }

  public isRunning(accountId: string): boolean {
    return this.activeJobs.has(accountId);
  }

  public stopAccount(accountId: string): void {
    const controller = this.activeJobs.get(accountId);
    if (controller) {
      controller.abort();
      this.activeJobs.delete(accountId);
      this.updateState(accountId, {
        isRunning: false,
        status: "Đã dừng",
      });
    }
  }

  public stopAll(): void {
    for (const [id, controller] of this.activeJobs.entries()) {
      controller.abort();
      this.updateState(id, {
        isRunning: false,
        status: "Đã dừng",
      });
    }
    this.activeJobs.clear();
  }

  /**
   * Bắt đầu chạy nhiệm vụ DoLike Instagram cho tài khoản (Chuẩn GoMax Lx/gu1;)
   */
  public async startAccount(
    acc: FacebookAccount,
    options: {
      cookie?: string;
      bearerToken?: string;
    },
  ): Promise<void> {
    if (this.isRunning(acc.id)) {
      this.stopAccount(acc.id);
      return;
    }

    const controller = new AbortController();
    this.activeJobs.set(acc.id, controller);

    const initialState: AccountRunState = {
      accountId: acc.id,
      uid: acc.uid || "",
      name: acc.name || "",
      platform: "instagram",
      isRunning: true,
      status: "Đang khởi động...",
      successCount: 0,
      errorCount: 0,
      earnedPoints: 0,
    };
    this.states.set(acc.id, initialState);
    this.notify();

    try {
      await this.runAccountLoop(acc, options, controller.signal);
    } catch (err: unknown) {
      if (!controller.signal.aborted) {
        const msg = err instanceof Error ? err.message : "Lỗi ngoài ý muốn";
        this.updateState(acc.id, {
          isRunning: false,
          status: `Lỗi: ${msg}`,
          lastError: msg,
        });
      }
    } finally {
      this.activeJobs.delete(acc.id);
      const cur = this.states.get(acc.id);
      if (cur?.isRunning) {
        this.updateState(acc.id, { isRunning: false });
      }
    }
  }

  public async startAccounts(
    accounts: FacebookAccount[],
    options: {
      cookie?: string;
      bearerToken?: string;
    },
  ): Promise<void> {
    for (const acc of accounts) {
      void this.startAccount(acc, options);
      // Giãn cách khởi động 3-5s theo chuẩn GoMax
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  private async sleepWithAbort(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      const onAbort = () => {
        clearTimeout(timer);
        reject(new Error("aborted"));
      };
      if (signal.aborted) {
        clearTimeout(timer);
        reject(new Error("aborted"));
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }

  private getRandomComment(): string {
    const idx = Math.floor(Math.random() * GOMAX_DOLIKE_DEFAULT_COMMENTS.length);
    return GOMAX_DOLIKE_DEFAULT_COMMENTS[idx];
  }

  /**
   * Vòng lặp tự động hóa DoLike Instagram bóc tách 100% từ GoMax Lx/gu1;
   */
  private async runAccountLoop(
    acc: FacebookAccount,
    options: {
      cookie?: string;
      bearerToken?: string;
    },
    signal: AbortSignal,
  ): Promise<void> {
    const rawCookie = acc.cookie || acc.rawText || "";
    const igCookie = normalizeCookie(rawCookie);

    if (!igCookie) {
      this.updateState(acc.id, {
        isRunning: false,
        status: "Thiếu Cookie Instagram",
        lastError: "Tài khoản không có Cookie hợp lệ",
      });
      return;
    }

    // 1. Kiểm tra trạng thái Cookie Instagram
    this.updateState(acc.id, { status: "Kiểm tra Cookie Instagram..." });
    const checkRes = await checkCookieIg(igCookie);
    if (!checkRes.isLive) {
      const err = checkRes.isCheckpoint
        ? "Tài khoản bị checkpoint"
        : "Cookie hết hạn/checkpoint";
      this.updateState(acc.id, {
        isRunning: false,
        status: `[IG Checkpoint] ${err}`,
        lastError: err,
      });
      return;
    }

    // Tên tài khoản chuẩn hóa theo GoMax (bỏ @, trim)
    const rawName = checkRes.username || acc.name || acc.uid || "";
    const cleanUsername = rawName.replace(/^@+/, "").trim();

    if (!cleanUsername) {
      this.updateState(acc.id, {
        isRunning: false,
        status: "Thiếu username Instagram",
        lastError: "Không tìm thấy username Instagram hợp lệ",
      });
      return;
    }

    // 2. Xác nhận / Liên kết tài khoản Instagram lên DoLike (Chuẩn GoMax Lx/gu1; & Lx/iq;->e)
    this.updateState(acc.id, { status: `Đang liên kết @${cleanUsername}...` });
    const linkRes = await linkDolikeAccountFull({
      accountUrl: cleanUsername,
      platform: "instagram",
      cookie: options.cookie,
      bearerToken: options.bearerToken,
    });

    if (!linkRes.success) {
      const err = linkRes.error || "Không thể liên kết tài khoản vào DoLike";
      this.updateState(acc.id, {
        isRunning: false,
        status: `Lỗi DoLike: ${err}`,
        lastError: err,
      });
      return;
    }

    const dolikeAccountId = linkRes.id || acc.uid || cleanUsername;
    const dolikeAccountUid = linkRes.username || cleanUsername;

    this.updateState(acc.id, {
      status: `Đã liên kết (ID: ${dolikeAccountId}). Sẵn sàng nhận job!`,
    });

    await this.sleepWithAbort(2000, signal);

    let consecutiveNoJob = 0;
    let consecutiveErrors = 0;

    // 3. Vòng lặp nhận và làm job DoLike Instagram
    while (!signal.aborted) {
      try {
        // Trạng thái: Chờ nhận job -> đang nhận job... (Chuẩn GoMax)
        this.updateState(acc.id, { status: "Chờ nhận job..." });
        await this.sleepWithAbort(1500, signal);

        this.updateState(acc.id, { status: "Đang nhận job..." });
        const jobRes = await getDolikeJob({
          accountId: dolikeAccountId,
          accountUid: dolikeAccountUid,
          platform: "instagram",
          cookie: options.cookie,
          bearerToken: options.bearerToken,
        });

        // Xử lý hết job / Cooldown
        if (!jobRes.success || !jobRes.job) {
          consecutiveNoJob++;
          const retrySecs = jobRes.retryAfter && jobRes.retryAfter > 0
            ? jobRes.retryAfter
            : 10 + Math.floor(Math.random() * 6);

          if (jobRes.retryAfter && jobRes.retryAfter > 0) {
            this.updateState(acc.id, {
              status: `Cooldown DoLike: chờ ${retrySecs}s theo server...`,
            });
          } else {
            this.updateState(acc.id, {
              status: `Chưa có job mới (lần ${consecutiveNoJob}, chờ ${retrySecs}s)...`,
            });
          }

          if (consecutiveNoJob >= 40) {
            this.updateState(acc.id, {
              isRunning: false,
              status: "Hết job liên tiếp 40 lần. Đã tạm dừng.",
            });
            break;
          }

          await this.sleepWithAbort(retrySecs * 1000, signal);
          continue;
        }

        // Đã nhận được job
        consecutiveNoJob = 0;
        const job: DolikeJob = jobRes.job;
        const runId = String(job.run_id || job.id || "");
        const jobType = String(job.type || job.job_type || "like").toLowerCase();
        const link = String(job.link || job.url || job.post_url || job.target_url || "");
        const postId = String(job.post_id || job.target_id || job.media_id || "");

        this.updateState(acc.id, {
          status: `Job ${jobType.toUpperCase()} (run_id: ${runId})`,
        });

        // 4. Chuẩn bị nội dung comment nếu là job comment (Chuẩn GoMax Lx/gu1;)
        let commentText = String(
          job.comment_text || job.message || job.content || job.noi_dung || "",
        ).trim();
        if (jobType === "comment" && !commentText) {
          commentText = this.getRandomComment();
        }

        // 5. Thực hiện tương tác Instagram
        this.updateState(acc.id, { status: `Đang làm job ${jobType}...` });
        let actRes: IgActionResult = {
          isSuccess: false,
          httpCode: 0,
          rawBody: "",
          errorMessage: "Chưa hỗ trợ loại job",
        };

        if (jobType.includes("like")) {
          let mediaId = postId;
          if (!mediaId && link) {
            mediaId = resolveMediaId(link) || "";
            if (!mediaId) {
              const sc = extractShortcode(link);
              if (sc) mediaId = shortcodeToMediaId(sc) || "";
            }
          }
          if (mediaId) {
            actRes = await doLike({ mediaId, cookie: igCookie });
          } else {
            actRes = {
              isSuccess: false,
              httpCode: 0,
              rawBody: "",
              errorMessage: "Không tìm thấy Media ID từ link",
            };
          }
        } else if (jobType.includes("follow") || jobType.includes("sub")) {
          let targetUserId = postId;
          if (!targetUserId && link) {
            targetUserId = (await resolveTargetUserId(link, igCookie)) || "";
          }
          if (targetUserId) {
            actRes = await doFollow({ targetUserId, cookie: igCookie });
          } else {
            actRes = {
              isSuccess: false,
              httpCode: 0,
              rawBody: "",
              errorMessage: "Không tìm thấy User ID từ link",
            };
          }
        } else if (jobType.includes("comment")) {
          let mediaId = postId;
          if (!mediaId && link) {
            mediaId = resolveMediaId(link) || "";
            if (!mediaId) {
              const sc = extractShortcode(link);
              if (sc) mediaId = shortcodeToMediaId(sc) || "";
            }
          }
          if (mediaId) {
            actRes = await doComment({
              mediaId,
              commentText,
              cookie: igCookie,
            });
          } else {
            actRes = {
              isSuccess: false,
              httpCode: 0,
              rawBody: "",
              errorMessage: "Không tìm thấy Media ID để bình luận",
            };
          }
        }

        // 6. Xử lý kết quả làm job
        if (actRes.isSuccess) {
          consecutiveErrors = 0;
          // Chờ gửi báo cáo -> đang gửi báo cáo... (Chuẩn GoMax)
          this.updateState(acc.id, { status: "Chờ gửi báo cáo..." });
          await this.sleepWithAbort(2000, signal);

          this.updateState(acc.id, { status: "Đang gửi báo cáo..." });
          const repRes = await reportDolikeJob({
            runId,
            cookie: options.cookie,
            bearerToken: options.bearerToken,
          });

          if (repRes.success) {
            const coins = repRes.coins || Number(job.coin || job.coins || job.xu || 50);
            const curState = this.states.get(acc.id);
            const newSuccess = (curState?.successCount || 0) + 1;
            const newPoints = (curState?.earnedPoints || 0) + coins;

            this.updateState(acc.id, {
              successCount: newSuccess,
              earnedPoints: newPoints,
              status: `Hoàn thành job ${jobType} (+${coins} Xu)`,
            });

            if (this.onBalanceUpdatedCallback) {
              this.onBalanceUpdatedCallback(`${newPoints.toLocaleString("vi-VN")} đ`);
            }
          } else {
            // Báo cáo thất bại -> gửi bỏ qua
            await skipDolikeJob({
              runId,
              reportType: "skip_unwanted",
              cookie: options.cookie,
              bearerToken: options.bearerToken,
            });
            this.updateState(acc.id, {
              status: `Báo cáo thất bại: ${repRes.error || "Lỗi DoLike"} (Đã skip)`,
            });
          }
        } else {
          // Làm job Instagram thất bại
          consecutiveErrors++;
          const igErr = actRes.errorMessage || "Không tương tác được";

          // Gửi bỏ qua theo chuẩn GoMax Lx/gu1;
          await skipDolikeJob({
            runId,
            reportType: "skip_unwanted",
            cookie: options.cookie,
            bearerToken: options.bearerToken,
          });

          const curState = this.states.get(acc.id);
          this.updateState(acc.id, {
            errorCount: (curState?.errorCount || 0) + 1,
            status: `Lỗi IG: ${igErr} (Đã gửi bỏ qua DoLike)`,
            lastError: igErr,
          });

          // Nếu nick bị checkpoint / hết hạn cookie -> dừng theo GoMax
          if (
            igErr.toLowerCase().includes("checkpoint") ||
            igErr.toLowerCase().includes("login") ||
            igErr.includes("-9")
          ) {
            this.updateState(acc.id, {
              isRunning: false,
              status: "Cookie tài khoản hết hạn hoặc bị Checkpoint (-9). Dừng.",
              lastError: "Cookie hết hạn hoặc Checkpoint",
            });
            break;
          }

          if (consecutiveErrors >= 10) {
            this.updateState(acc.id, {
              isRunning: false,
              status: "Lỗi liên tiếp 10 lần. Tạm dừng tài khoản.",
            });
            break;
          }
        }

        // 7. Delay an toàn giữa 2 job (chuẩn GoMax: 8-15 giây)
        const delay = 8000 + Math.floor(Math.random() * 7000);
        this.updateState(acc.id, {
          status: `Nghỉ ${Math.round(delay / 1000)}s trước job tiếp theo...`,
        });
        await this.sleepWithAbort(delay, signal);
      } catch (err: unknown) {
        if (signal.aborted) break;
        const msg = err instanceof Error ? err.message : "Lỗi vòng lặp";
        this.updateState(acc.id, {
          status: `Tạm nghỉ do lỗi: ${msg}`,
          lastError: msg,
        });
        await this.sleepWithAbort(5000, signal);
      }
    }
  }
}

export const dolikeRunner = new DolikeRunnerManager();
