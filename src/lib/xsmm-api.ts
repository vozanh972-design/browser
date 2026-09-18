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

export async function getXsmmUser(token: string): Promise<{
  success: boolean;
  user?: XsmmUser;
  error?: string;
}> {
  try {
    const res = await fetch(`${XSMM_BASE_URL}/user`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token.trim()}`,
      },
    });

    const data = (await res.json()) as XsmmUserResponse;
    if (!res.ok || data.error) {
      return {
        success: false,
        error: data.error || "Token không hợp lệ hoặc đã hết hạn",
      };
    }

    if (data.user) {
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

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token.trim()}`,
      },
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      return {
        success: false,
        error: data.error || "Không thể lấy danh sách tài khoản",
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
    const res = await fetch(`${XSMM_BASE_URL}/accounts2`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const result = await res.json();
    if (!res.ok || result.error) {
      return {
        success: false,
        error: result.error || "Không thể thêm tài khoản lên XSMM",
      };
    }

    return {
      success: true,
      account: result,
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

    const res = await fetch(`${XSMM_BASE_URL}/tasks2?${query.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token.trim()}`,
      },
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      return {
        success: false,
        error: data.error || "Không thể lấy danh sách nhiệm vụ",
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
    const res = await fetch(`${XSMM_BASE_URL}/tasks2/complete`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      return {
        success: false,
        error: data.error || "Hoàn thành nhiệm vụ thất bại",
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
