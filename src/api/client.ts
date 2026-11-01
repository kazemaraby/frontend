/** HTTP client for the tenant API.
 *
 * - The tenant is the page's own subdomain: requests go to the same origin (`/api/v1/...`) and the dev proxy /
 *   ingress forwards the Host header. The client never sends a tenant id.
 * - The access token lives in memory only. The refresh token is an HttpOnly cookie scoped to /api/v1/auth/,
 *   so a page reload restores the session with `refresh()`.
 * - Every call carries X-Company-Id (and X-Branch-Id when a branch is chosen) from the company switcher.
 * - A 401 triggers one refresh (shared by concurrent requests) and one retry; if that fails the user is signed out.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `API request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export type Query = Record<string, string | number | boolean | null | undefined>;

export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
};

export type ClientOptions = {
  baseUrl?: string;
  fetch?: typeof fetch;
  getCompanyId?: () => number | null;
  getBranchId?: () => number | null;
  getLanguage?: () => string;
  /** Called when the session cannot be renewed (refresh token missing, expired or revoked). */
  onUnauthenticated?: () => void;
};

const AUTH = "/auth";

export function createApiClient(options: ClientOptions = {}) {
  const baseUrl = options.baseUrl ?? "/api/v1";
  const doFetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  let accessToken: string | null = null;
  let refreshing: Promise<boolean> | null = null;

  function url(path: string, query?: Query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
    }
    const qs = params.toString();
    return `${baseUrl}${path}${qs ? `?${qs}` : ""}`;
  }

  function headers(body: unknown): Headers {
    const h = new Headers({ Accept: "application/json" });
    // FormData (file uploads) sets its own multipart Content-Type with the boundary.
    if (body !== undefined && !(body instanceof FormData)) h.set("Content-Type", "application/json");
    if (accessToken) h.set("Authorization", `Bearer ${accessToken}`);
    const company = options.getCompanyId?.();
    if (company != null) h.set("X-Company-Id", String(company));
    const branch = options.getBranchId?.();
    if (branch != null) h.set("X-Branch-Id", String(branch));
    const lang = options.getLanguage?.();
    if (lang) h.set("Accept-Language", lang);
    return h;
  }

  async function send(path: string, init: RequestOptions): Promise<Response> {
    try {
      return await doFetch(url(path, init.query), {
        method: init.method ?? "GET",
        headers: headers(init.body),
        body: init.body === undefined || init.body instanceof FormData ? init.body : JSON.stringify(init.body),
        credentials: "same-origin",
        signal: init.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      throw new ApiError(0, null, "Network error");
    }
  }

  async function parse<T>(response: Response): Promise<T> {
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    const body = text ? JSON.parse(text) : undefined;
    if (!response.ok) throw new ApiError(response.status, body);
    return body as T;
  }

  /** Exchanges the refresh cookie for a new access token. Concurrent callers share one network call,
   * which matters because the backend blacklists a refresh token once it has been rotated. */
  function refresh(): Promise<boolean> {
    refreshing ??= (async () => {
      try {
        const response = await send(`${AUTH}/refresh`, { method: "POST" });
        if (!response.ok) {
          accessToken = null;
          return false;
        }
        accessToken = (await response.json()).access;
        return true;
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  }

  async function request<T>(path: string, init: RequestOptions = {}): Promise<T> {
    const response = await send(path, init);
    if (response.status !== 401) return parse<T>(response);

    if (await refresh()) {
      const retried = await send(path, init);
      if (retried.status !== 401) return parse<T>(retried);
    }
    accessToken = null;
    options.onUnauthenticated?.();
    throw new ApiError(401, null, "Session expired");
  }

  /** A file answer (Excel export): same auth, company header and refresh as request(), returns the bytes and the
   * server's file name. Errors still arrive as ApiError with the JSON body. */
  async function download(path: string, query?: Query): Promise<{ blob: Blob; filename: string }> {
    let response = await send(path, { query });
    if (response.status === 401 && (await refresh())) response = await send(path, { query });
    if (response.status === 401) {
      accessToken = null;
      options.onUnauthenticated?.();
      throw new ApiError(401, null, "Session expired");
    }
    if (!response.ok) return parse(response);
    const disposition = response.headers.get("Content-Disposition") ?? "";
    const filename = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? "download";
    return { blob: await response.blob(), filename };
  }

  async function login(email: string, password: string): Promise<void> {
    const response = await send(`${AUTH}/login`, { method: "POST", body: { email, password } });
    const body = await parse<{ access: string }>(response);
    accessToken = body.access;
  }

  async function logout(): Promise<void> {
    try {
      await send(`${AUTH}/logout`, { method: "POST" });
    } finally {
      accessToken = null;
    }
  }

  return {
    request,
    get: <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>(path, { query, signal }),
    patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body }),
    post: <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body }),
    del: (path: string) => request<void>(path, { method: "DELETE" }),
    download,
    login,
    logout,
    refresh,
    hasAccessToken: () => accessToken !== null,
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
