import { invoke } from "@tauri-apps/api/core";

export interface XsmmUser {
  username: string;
  points: number;
}

export interface XsmmUserResponse {
  user?: XsmmUser;
  error?: string;
}

export interface XsmmAccountItem {
  id: string;
  type: string;
  account_id: string;
  name: string;
  country?: string;
  variant?: string;
  link_account: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface XsmmTaskItem {
  id: string;
  type: string;
  target_id: string;
  target_id2?: string;
  idorlink?: string;
  target_url: string;
  points: number;
}

export interface XsmmCompleteResponse {
  countdown?: number;
  message?: string;
  points?: number;
  retry?: boolean;
  success_count?: number;
  error?: string;
}

const XSMM_BASE_URL = "https://xsmm.net/api/taskapi";

async function xsmmFetch<T>(
  url: string,
  method: string,
  token: string,
  body?: unknown,
): Promise<T> {
  const jsonBody = body !== undefined ? JSON.stringify(body) : null;

  try {
    const raw = await invoke<string>("xsmm_request", {
      url,
      method,
      token,
      body: jsonBody,
    });
    return JSON.parse(raw) as T;
  } catch {
    // Fallback to standard fetch if running outside of Tauri desktop runtime
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        "Content-Type": "application/json",
      },
      body: jsonBody ?? undefined,
    });
    return (await res.json()) as T;
  }
}

export async function getXsmmUser(token: string): Promise<{
  success: boolean;
  user?: XsmmUser;
  error?: string;
}> {
  try {
    const data = await xsmmFetch<XsmmUserResponse>(
      `${XSMM_BASE_URL}/user`,
      "GET",
      token,
    );

    if (data?.error) {
      return {
        success: false,
        error: data.error,
      };
    }

    if (data?.user) {
      return {
        success: true,
        user: data.user,
      };
    }

    return {
      success: false,
      error: "Không thể lấy thông tin người dùng XSMM",
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Lỗi kết nối máy chủ XSMM";
    return {
      success: false,
      error: message,
    };
  }
}

export async function getXsmmAccounts(
  token: string,
  params?: { search?: string; account_type?: string },
): Promise<{
  success: boolean;
  accounts?: XsmmAccountItem[];
  error?: string;
}> {
  try {
    const query = new URLSearchParams();
    if (params?.search) query.append("search", params.search);
    if (params?.account_type) query.append("account_type", params.account_type);

    const qs = query.toString();
    const url = qs
      ? `${XSMM_BASE_URL}/accounts2?${qs}`
      : `${XSMM_BASE_URL}/accounts2`;

    const data = await xsmmFetch<XsmmAccountItem[] | { error?: string }>(
      url,
      "GET",
      token,
    );

    if (data && "error" in data && data.error) {
      return {
        success: false,
        error: data.error,
      };
    }

    return {
      success: true,
      accounts: Array.isArray(data) ? data : [],
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Lỗi kết nối máy chủ XSMM";
    return {
      success: false,
      error: message,
    };
  }
}

export async function addXsmmAccount(
  token: string,
  data: { type: string; link_account: string },
): Promise<{
  success: boolean;
  account?: XsmmAccountItem;
  error?: string;
}> {
  try {
    const result = await xsmmFetch<XsmmAccountItem | { error?: string }>(
      `${XSMM_BASE_URL}/accounts2`,
      "POST",
      token,
      data,
    );

    if (result && "error" in result && result.error) {
      return {
        success: false,
        error: result.error,
      };
    }

    return {
      success: true,
      account: result as XsmmAccountItem,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Lỗi kết nối máy chủ XSMM";
    return {
      success: false,
      error: message,
    };
  }
}

export async function getXsmmTasks(
  token: string,
  params: { type: string; uid: string; typejob?: string },
): Promise<{
  success: boolean;
  tasks?: XsmmTaskItem[];
  error?: string;
}> {
  try {
    const query = new URLSearchParams({
      type: params.type,
      uid: params.uid,
    });
    if (params.typejob) query.append("typejob", params.typejob);

    const data = await xsmmFetch<XsmmTaskItem[] | { error?: string }>(
      `${XSMM_BASE_URL}/tasks2?${query.toString()}`,
      "GET",
      token,
    );

    if (data && "error" in data && data.error) {
      return {
        success: false,
        error: data.error,
      };
    }

    return {
      success: true,
      tasks: Array.isArray(data) ? data : [],
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Lỗi kết nối máy chủ XSMM";
    return {
      success: false,
      error: message,
    };
  }
}

export async function completeXsmmTask(
  token: string,
  payload: { type: string; task_id: string[]; uid: string },
): Promise<{
  success: boolean;
  result?: XsmmCompleteResponse;
  error?: string;
}> {
  try {
    const data = await xsmmFetch<XsmmCompleteResponse>(
      `${XSMM_BASE_URL}/tasks2/complete`,
      "POST",
      token,
      payload,
    );

    if (data?.error) {
      return {
        success: false,
        error: data.error,
      };
    }

    return {
      success: true,
      result: data,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Lỗi kết nối máy chủ XSMM";
    return {
      success: false,
      error: message,
    };
  }
}
