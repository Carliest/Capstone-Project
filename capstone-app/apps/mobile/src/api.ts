export type ApiErrorEnvelope = {
  status: "error";
  message: string;
  details?: unknown;
};

export type ApiSuccessEnvelope<T> = {
  status: "ok";
  data: T;
};

export type ApiClient = ReturnType<typeof createApiClient>;

export function normalizeApiBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, "");
}

export function createApiClient(baseUrl: string) {
  const normalizedBaseUrl = normalizeApiBaseUrl(baseUrl);

  async function request<T>(
    path: string,
    options: RequestInit = {},
    token?: string
  ): Promise<T> {
    const response = await fetch(`${normalizedBaseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {}),
      },
    });

    let payload: ApiSuccessEnvelope<T> | ApiErrorEnvelope | null = null;
    try {
      payload = (await response.json()) as ApiSuccessEnvelope<T> | ApiErrorEnvelope;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(
        payload && payload.status === "error"
          ? payload.message
          : `Request failed with status ${response.status}`
      );
    }

    if (payload && payload.status === "error") {
      throw new Error(payload.message);
    }

    return (payload as ApiSuccessEnvelope<T>).data;
  }

  return {
    baseUrl: normalizedBaseUrl,
    get: <T>(path: string, token?: string) => request<T>(path, {}, token),
    post: <T>(path: string, body: unknown, token?: string) =>
      request<T>(path, { method: "POST", body: JSON.stringify(body) }, token),
    patch: <T>(path: string, body: unknown, token?: string) =>
      request<T>(path, { method: "PATCH", body: JSON.stringify(body) }, token),
    del: <T>(path: string, token?: string) =>
      request<T>(path, { method: "DELETE" }, token),
  };
}
