import { type FacebookAccount } from "@/app/page";
import {
  executeFacebookComment,
  executeFacebookFollow,
  executeFacebookLikePage,
  executeFacebookReaction,
  executeFacebookShare,
  type FbTaskResult,
} from "./facebook-task-engine";
import {
  checkCookieIg,
  doComment,
  doFollow,
  doLike,
  extractPageTokens,
  extractTokensFromCookie,
  type IgActionResult,
} from "./instagram-api";
import {
  addXsmmAccount,
  completeXsmmTask,
  getXsmmAccounts,
  getXsmmTasks,
  type XsmmAccountItem,
} from "./xsmm-api";

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

type StateListener = (states: Map<string, AccountRunState>) => void;

class XsmmRunnerManager {
  private activeJobs = new Map<string, AbortController>();
  private states = new Map<string, AccountRunState>();
  private listeners = new Set<StateListener>();
  private onPointsEarnedCallback?: (points: number) => void;

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(new Map(this.states));
    return () => {
      this.listeners.delete(listener);
    };
  }

  public setOnPointsEarned(cb: (points: number) => void) {
    this.onPointsEarnedCallback = cb;
  }

  private notify() {
    const copy = new Map(this.states);
    for (const l of this.listeners) {
      l(copy);
    }
  }

  public getState(accountId: string): AccountRunState | undefined {
    return this.states.get(accountId);
  }

  public isRunning(accountId: string): boolean {
    return this.activeJobs.has(accountId);
  }

  public isAnyRunning(): boolean {
    return this.activeJobs.size > 0;
  }

  private updateAccountState(
    accountId: string,
    patch: Partial<AccountRunState>,
  ) {
    const existing = this.states.get(accountId);
    if (existing) {
      this.states.set(accountId, { ...existing, ...patch });
      this.notify();
    }
  }

  /**
   * Khởi chạy 1 tài khoản (Instagram hoặc Facebook)
   */
  public startAccount(
    account: FacebookAccount,
    xsmmToken: string,
    startDelayMs = 0,
  ) {
    const cleanId = account.id;
    if (this.activeJobs.has(cleanId)) return;

    const controller = new AbortController();
    this.activeJobs.set(cleanId, controller);

    const platform = account.platform || "facebook";
    const displayName = account.name || account.uid;

    this.states.set(cleanId, {
      accountId: cleanId,
      uid: account.uid,
      name: displayName,
      platform,
      isRunning: true,
      status:
        startDelayMs > 0
          ? `Chờ chạy (${Math.round(startDelayMs / 1000)}s)...`
          : "Bắt đầu...",
      successCount: 0,
      errorCount: 0,
      earnedPoints: 0,
    });
    this.notify();

    void (async () => {
      if (startDelayMs > 0) {
        const sec = Math.round(startDelayMs / 1000);
        for (let s = sec; s >= 1; s--) {
          if (controller.signal.aborted) break;
          this.updateAccountState(cleanId, {
            status: `Chờ chạy (${s}s)...`,
          });
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      if (controller.signal.aborted) {
        this.activeJobs.delete(cleanId);
        this.updateAccountState(cleanId, {
          isRunning: false,
          status: "Đã dừng",
        });
        return;
      }

      try {
        if (platform === "instagram") {
          await this.runInstagramTask(account, xsmmToken, controller.signal);
        } else {
          await this.runFacebookTask(account, xsmmToken, controller.signal);
        }
      } catch (err: unknown) {
        if (!controller.signal.aborted) {
          const errMsg = err instanceof Error ? err.message : String(err);
          this.updateAccountState(cleanId, {
            status: `Lỗi: ${errMsg}`,
            lastError: errMsg,
          });
        }
      } finally {
        this.activeJobs.delete(cleanId);
        this.updateAccountState(cleanId, {
          isRunning: false,
          status: controller.signal.aborted
            ? "Đã dừng chạy"
            : "Hoàn thành phiên",
        });
      }
    })();
  }

  /**
   * Khởi chạy danh sách nhiều tài khoản
   */
  public startAccounts(accounts: FacebookAccount[], xsmmToken: string) {
    if (!xsmmToken.trim() || accounts.length === 0) return;

    // Kiểm tra proxy: nếu có proxy riêng từng nick thì chạy song song, nếu chung proxy thì giãn cách
    accounts.forEach((acc, idx) => {
      const delayMs = idx * 2500;
      this.startAccount(acc, xsmmToken, delayMs);
    });
  }

  public stopAccount(accountId: string) {
    const controller = this.activeJobs.get(accountId);
    if (controller) {
      controller.abort();
      this.activeJobs.delete(accountId);
    }
    this.updateAccountState(accountId, {
      isRunning: false,
      status: "Đã dừng",
    });
  }

  public stopAll() {
    for (const [id, controller] of this.activeJobs.entries()) {
      controller.abort();
      this.updateAccountState(id, {
        isRunning: false,
        status: "Đã dừng tất cả",
      });
    }
    this.activeJobs.clear();
  }

  // =========================================================================
  // LOGIC CHẠY NHIỆM VỤ INSTAGRAM (Port từ XsmmInstagramTaskRunner.kt)
  // =========================================================================
  private async runInstagramTask(
    account: FacebookAccount,
    xsmmToken: string,
    signal: AbortSignal,
  ) {
    const accountId = account.id;
    let cookie = account.cookie?.trim() || "";
    if (!cookie) {
      if (
        account.rawText?.includes("ds_user_id=") ||
        account.rawText?.includes("sessionid=")
      ) {
        cookie = account.rawText.split("|")[0].trim();
      } else if (
        account.uid?.includes("ds_user_id=") ||
        account.uid?.includes("sessionid=")
      ) {
        cookie = account.uid.split("|")[0].trim();
      }
    }
    const proxy =
      account.proxy && account.proxy !== "Chưa chọn"
        ? account.proxy
        : undefined;

    if (!cookie) {
      this.updateAccountState(accountId, {
        status: "Thiếu Cookie Instagram",
        lastError: "Tài khoản chưa có Cookie",
      });
      return;
    }

    // 1. Kiểm tra cookie & trích xuất thông tin
    this.updateAccountState(accountId, {
      status: "Kiểm tra cookie & tokens...",
    });
    const cookieInfo = await checkCookieIg(cookie, proxy);
    if (!cookieInfo.isLive) {
      this.updateAccountState(accountId, {
        status: "Cookie DIE / Checkpoint",
        lastError: "Tài khoản bị Kháng nghị / Checkpoint / DIE",
      });
      return;
    }

    const realUser = cookieInfo.username || account.name || account.uid;
    const realUid =
      cookieInfo.userId ||
      extractTokensFromCookie(cookie).ds_user_id ||
      account.uid;

    const tokens = await extractPageTokens(
      cookie,
      "https://www.instagram.com/",
      proxy,
    );

    // 2. Liên kết tài khoản lên XSMM (nếu chưa có)
    this.updateAccountState(accountId, {
      status: "Đồng bộ liên kết XSMM...",
    });
    try {
      const existingRes = await getXsmmAccounts(xsmmToken, {
        account_type: "instagram",
      });
      const exists = existingRes.accounts?.some(
        (a: XsmmAccountItem) =>
          a.account_id === realUid ||
          a.name.toLowerCase() === realUser.toLowerCase(),
      );
      if (!exists) {
        await addXsmmAccount(xsmmToken, {
          type: "instagram",
          link_account: `https://www.instagram.com/${realUser}/`,
        });
      }
    } catch {
      // ignore
    }

    const taskTypes = [
      "instagram_follow",
      "instagram_like",
      "instagram_comment",
    ];
    let consecutiveErrors = 0;
    let completedCount = 0;
    let errorCount = 0;
    let earnedPoints = 0;
    const pendingFollowIds: string[] = [];

    // Vòng lặp nhận job & thực hiện
    while (!signal.aborted) {
      const jobType = taskTypes[Math.floor(Math.random() * taskTypes.length)];
      this.updateAccountState(accountId, {
        status: `Lấy nhiệm vụ (${jobType.replace("instagram_", "")})...`,
      });

      const taskRes = await getXsmmTasks(xsmmToken, {
        type: jobType,
        uid: realUid,
      });

      if (!taskRes.success || !taskRes.tasks || taskRes.tasks.length === 0) {
        const waitSec = 8;
        for (let s = waitSec; s >= 1; s--) {
          if (signal.aborted) break;
          this.updateAccountState(accountId, {
            status: `Hết job ${jobType.replace("instagram_", "")} (chờ ${s}s)...`,
          });
          await new Promise((r) => setTimeout(r, 1000));
        }
        continue;
      }

      for (const task of taskRes.tasks) {
        if (signal.aborted) break;

        const targetId = task.target_id || task.idorlink || "";
        const targetUrl = task.target_url || "";
        const taskId = task.id;

        let actRes: IgActionResult = {
          isSuccess: false,
          httpCode: 0,
          rawBody: "",
          errorMessage: "Chưa hỗ trợ",
        };

        if (jobType === "instagram_follow") {
          const userFollow =
            targetUrl.replace(/\/+$/, "").split("/").pop() || targetId;
          this.updateAccountState(accountId, {
            status: `Đang Follow @${userFollow}...`,
          });
          actRes = await doFollow({
            cookie,
            targetNumericId: targetId,
            targetUsername: userFollow,
            targetUrl,
            tokens,
            proxy,
            userId: realUid,
          });
        } else if (jobType === "instagram_like") {
          this.updateAccountState(accountId, {
            status: `Đang thả tym bài viết ${targetId.substring(0, 15)}...`,
          });
          actRes = await doLike({
            cookie,
            mediaIdOrUrl: targetId || targetUrl,
            linkJob: targetUrl,
            tokens,
            proxy,
            userId: realUid,
          });
        } else if (jobType === "instagram_comment") {
          const cmtText = "Tuyệt vời quá! ❤️";
          this.updateAccountState(accountId, {
            status: `Đang comment bài viết...`,
          });
          actRes = await doComment({
            cookie,
            mediaIdOrUrl: targetId || targetUrl,
            text: cmtText,
            linkJob: targetUrl,
            tokens,
            proxy,
            userId: realUid,
          });
        }

        // Mô phỏng độ trễ người dùng
        await new Promise((r) => setTimeout(r, 2000));

        if (!actRes.isSuccess) {
          consecutiveErrors++;
          errorCount++;
          const errDetail = actRes.errorMessage || "Thao tác thất bại";
          this.updateAccountState(accountId, {
            errorCount,
            status: `Lỗi: ${errDetail}`,
            lastError: errDetail,
          });

          if (consecutiveErrors >= 5) {
            this.updateAccountState(accountId, {
              status: `Dừng: Gặp lỗi liên tiếp ${consecutiveErrors} lần`,
              lastError: "Quá giới hạn lỗi liên tiếp",
            });
            return;
          }
          await new Promise((r) => setTimeout(r, 3000));
        } else {
          consecutiveErrors = 0;
          completedCount++;

          if (jobType === "instagram_follow") {
            pendingFollowIds.push(taskId);
            this.updateAccountState(accountId, {
              successCount: completedCount,
              status: `Follow xong (Đã gom ${pendingFollowIds.length}/10)`,
            });

            // Đủ 10 follow gửi xác nhận nhận xu
            if (pendingFollowIds.length >= 10) {
              this.updateAccountState(accountId, {
                status: "Gửi xác nhận 10 follow...",
              });
              const compRes = await completeXsmmTask(xsmmToken, {
                type: "instagram_follow",
                task_id: [...pendingFollowIds],
                uid: realUid,
              });

              if (compRes.success && compRes.result) {
                const pts = compRes.result.points || 350;
                earnedPoints += pts;
                this.updateAccountState(accountId, {
                  earnedPoints,
                  status: `+${pts} xu (10 follow)`,
                });
                this.onPointsEarnedCallback?.(pts);
              }
              pendingFollowIds.length = 0;
            }
          } else {
            // Like hoặc comment: hoàn thành ngay
            this.updateAccountState(accountId, {
              status: "Xác nhận nhận xu...",
            });
            const compRes = await completeXsmmTask(xsmmToken, {
              type: jobType,
              task_id: [taskId],
              uid: realUid,
            });

            if (compRes.success && compRes.result) {
              const pts = compRes.result.points || 35;
              earnedPoints += pts;
              this.updateAccountState(accountId, {
                successCount: completedCount,
                earnedPoints,
                status: `+${pts} xu (${jobType.replace("instagram_", "")})`,
              });
              this.onPointsEarnedCallback?.(pts);
            }
          }

          // Delay giãn cách an toàn giữa các job
          for (let s = 8; s >= 1; s--) {
            if (signal.aborted) break;
            this.updateAccountState(accountId, {
              status: `Thành công | Nghỉ ${s}s...`,
            });
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      }
    }
  }

  // =========================================================================
  // LOGIC CHẠY NHIỆM VỤ FACEBOOK (Port từ XsmmFacebookTaskRunner.kt)
  // =========================================================================
  private async runFacebookTask(
    account: FacebookAccount,
    xsmmToken: string,
    signal: AbortSignal,
  ) {
    const accountId = account.id;
    const token = account.token?.trim() || "";
    const cookie = account.cookie?.trim() || "";
    const proxy =
      account.proxy && account.proxy !== "Chưa chọn"
        ? account.proxy
        : undefined;

    if (!token && !cookie) {
      this.updateAccountState(accountId, {
        status: "Thiếu Token hoặc Cookie FB",
        lastError: "Cần Token hoặc Cookie để chạy nhiệm vụ",
      });
      return;
    }

    const realUid = account.uid;
    const activeToken = token;

    this.updateAccountState(accountId, {
      status: `Kích hoạt nick [${realUid}] trên XSMM...`,
    });

    // Đồng bộ tài khoản Facebook trên XSMM
    try {
      await addXsmmAccount(xsmmToken, {
        type: "facebook",
        link_account: `https://www.facebook.com/${realUid}`,
      });
    } catch {
      // ignore
    }

    const queryCategories = [
      "facebook_like",
      "facebook_follow",
      "facebook_comment",
    ];
    let completedCount = 0;
    let errorCount = 0;
    let earnedPoints = 0;
    let consecutiveErrors = 0;
    const pendingFollowIds: string[] = [];

    while (!signal.aborted) {
      const queryType =
        queryCategories[Math.floor(Math.random() * queryCategories.length)];
      this.updateAccountState(accountId, {
        status: `Lấy nhiệm vụ FB (${queryType.replace("facebook_", "")})...`,
      });

      const taskRes = await getXsmmTasks(xsmmToken, {
        type: queryType,
        uid: realUid,
      });

      if (!taskRes.success || !taskRes.tasks || taskRes.tasks.length === 0) {
        const waitSec = 7;
        for (let s = waitSec; s >= 1; s--) {
          if (signal.aborted) break;
          this.updateAccountState(accountId, {
            status: `Hết NV ${queryType.replace("facebook_", "")} (chờ ${s}s)...`,
          });
          await new Promise((r) => setTimeout(r, 1000));
        }
        continue;
      }

      for (const task of taskRes.tasks) {
        if (signal.aborted) break;

        const targetId = task.target_id || task.idorlink || "";
        const taskId = task.id;
        const taskType = task.type || queryType;

        let res: FbTaskResult = {
          isSuccess: false,
          action: taskType,
          targetId,
          message: "Chưa hỗ trợ",
        };

        if (taskType.includes("comment")) {
          const cmt = "Tương tác tuyệt vời!";
          this.updateAccountState(accountId, {
            status: `Đang Comment UID: ${targetId.substring(0, 16)}...`,
          });
          res = await executeFacebookComment({
            targetId,
            comment: cmt,
            token: activeToken,
            userId: realUid,
            proxy,
          });
        } else if (taskType.includes("follow") || taskType.includes("sub")) {
          this.updateAccountState(accountId, {
            status: `Đang Follow UID: ${targetId.substring(0, 16)}...`,
          });
          res = await executeFacebookFollow({
            targetId,
            token: activeToken,
            userId: realUid,
            proxy,
          });
        } else if (taskType.includes("likepage")) {
          this.updateAccountState(accountId, {
            status: `Đang Like Page: ${targetId.substring(0, 16)}...`,
          });
          res = await executeFacebookLikePage({
            targetId,
            token: activeToken,
            userId: realUid,
            proxy,
          });
        } else if (taskType.includes("share")) {
          this.updateAccountState(accountId, {
            status: `Đang Share bài viết...`,
          });
          res = await executeFacebookShare({
            targetId,
            token: activeToken,
            proxy,
          });
        } else {
          // Thả cảm xúc Like / Love / Care / Haha / Wow / Sad / Angry
          this.updateAccountState(accountId, {
            status: `Đang thả cảm xúc (${taskType})...`,
          });
          res = await executeFacebookReaction({
            targetId,
            reactionType: taskType,
            token: activeToken,
            userId: realUid,
            proxy,
          });
        }

        await new Promise((r) => setTimeout(r, 2000));

        if (!res.isSuccess) {
          consecutiveErrors++;
          errorCount++;
          const errDetail = res.message || "Lỗi thao tác Facebook";
          this.updateAccountState(accountId, {
            errorCount,
            status: `Lỗi FB: ${errDetail}`,
            lastError: errDetail,
          });

          if (consecutiveErrors >= 5) {
            this.updateAccountState(accountId, {
              status: `Dừng nick: ${consecutiveErrors} job lỗi liên tiếp`,
              lastError: "Quá giới hạn lỗi liên tiếp",
            });
            return;
          }
          await new Promise((r) => setTimeout(r, 3000));
        } else {
          consecutiveErrors = 0;
          completedCount++;

          if (taskType.includes("follow") || taskType.includes("sub")) {
            pendingFollowIds.push(taskId);
            this.updateAccountState(accountId, {
              successCount: completedCount,
              status: `Follow xong (Gom ${pendingFollowIds.length}/10)`,
            });

            if (pendingFollowIds.length >= 10) {
              this.updateAccountState(accountId, {
                status: "Gửi nhận xu 10 follow...",
              });
              const compRes = await completeXsmmTask(xsmmToken, {
                type: "facebook_follow",
                task_id: [...pendingFollowIds],
                uid: realUid,
              });

              if (compRes.success && compRes.result) {
                const pts = compRes.result.points || 350;
                earnedPoints += pts;
                this.updateAccountState(accountId, {
                  earnedPoints,
                  status: `+${pts} xu (10 follow)`,
                });
                this.onPointsEarnedCallback?.(pts);
              }
              pendingFollowIds.length = 0;
            }
          } else {
            // Like / Comment hoàn thành ngay
            this.updateAccountState(accountId, {
              status: "Gửi hoàn thành nhiệm vụ...",
            });
            const compRes = await completeXsmmTask(xsmmToken, {
              type: taskType.includes("like") ? "facebook_like" : taskType,
              task_id: [taskId],
              uid: realUid,
            });

            if (compRes.success && compRes.result) {
              const pts = compRes.result.points || 35;
              earnedPoints += pts;
              this.updateAccountState(accountId, {
                successCount: completedCount,
                earnedPoints,
                status: `+${pts} xu (${taskType.replace("facebook_", "")})`,
              });
              this.onPointsEarnedCallback?.(pts);
            }
          }

          // Nghỉ an toàn
          for (let s = 8; s >= 1; s--) {
            if (signal.aborted) break;
            this.updateAccountState(accountId, {
              status: `Thành công | Nghỉ ${s}s...`,
            });
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      }
    }
  }
}

export const xsmmRunner = new XsmmRunnerManager();
