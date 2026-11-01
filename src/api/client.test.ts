import { describe, expect, it, vi } from "vitest";

import { ApiError, createApiClient } from "./client";

type Call = {
  url: string;
  method: string;
  headers: Headers;
  body: string | FormData | undefined;
  credentials: string | undefined;
};

/** A fake backend: `routes` answers by "METHOD /path"; every request is recorded. */
function fakeBackend(routes: Record<string, (call: Call) => Response | Promise<Response>>) {
  const calls: Call[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: Call = {
      url: String(input),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: init?.body as string | FormData | undefined,
      credentials: init?.credentials,
    };
    calls.push(call);
    const path = new URL(call.url, "http://cactus.localhost").pathname;
    const handler = routes[`${call.method} ${path}`];
    if (!handler) return json(404, { detail: "not found" });
    return handler(call);
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const bearer = (call: Call) => call.headers.get("Authorization");

describe("api client", () => {
  it("sends the access token and the active company / branch on every call", async () => {
    const backend = fakeBackend({
      "POST /api/v1/auth/login": () => json(200, { access: "token-1" }),
      "GET /api/v1/employees": () => json(200, { count: 0, results: [] }),
    });
    const api = createApiClient({ fetch: backend.fetch, getCompanyId: () => 2, getBranchId: () => 5, getLanguage: () => "ar" });

    await api.login("hr@cactus.localhost", "pw");
    await api.get("/employees", { page: 1, search: "", status: undefined });

    const call = backend.calls[1];
    expect(bearer(call)).toBe("Bearer token-1");
    expect(call.headers.get("X-Company-Id")).toBe("2");
    expect(call.headers.get("X-Branch-Id")).toBe("5");
    expect(call.headers.get("Accept-Language")).toBe("ar");
    expect(call.url).toBe("/api/v1/employees?page=1"); // empty / undefined params are dropped
  });

  it("omits the company and branch headers until one is chosen", async () => {
    const backend = fakeBackend({ "GET /api/v1/me": () => json(200, {}) });
    const api = createApiClient({ fetch: backend.fetch, getCompanyId: () => null, getBranchId: () => null });

    await api.get("/me");

    expect(backend.calls[0].headers.has("X-Company-Id")).toBe(false);
    expect(backend.calls[0].headers.has("X-Branch-Id")).toBe(false);
  });

  it("never sends a tenant identifier: the tenant is the page's own subdomain", async () => {
    const backend = fakeBackend({
      "POST /api/v1/auth/login": () => json(200, { access: "t" }),
      "GET /api/v1/me": () => json(200, {}),
    });
    const api = createApiClient({ fetch: backend.fetch, getCompanyId: () => 1 });

    await api.login("a@b.c", "pw");
    await api.get("/me");

    for (const call of backend.calls) {
      expect(call.url.startsWith("/api/v1/")).toBe(true); // same origin, no tenant host or prefix
      expect(call.url).not.toMatch(/tenant|schema/i);
      expect([...call.headers.keys()].some((h) => /tenant|schema/i.test(h))).toBe(false);
      expect(call.body ?? "").not.toMatch(/tenant|schema/i);
    }
  });

  it("refreshes the access token on 401 and retries the request once", async () => {
    let token = "old";
    const backend = fakeBackend({
      "POST /api/v1/auth/login": () => json(200, { access: "old" }),
      "POST /api/v1/auth/refresh": () => {
        token = "new";
        return json(200, { access: "new" });
      },
      "GET /api/v1/me": (call) => (bearer(call) === `Bearer ${token}` && token === "new" ? json(200, { id: 7 }) : json(401, {})),
    });
    const onUnauthenticated = vi.fn();
    const api = createApiClient({ fetch: backend.fetch, onUnauthenticated });
    await api.login("a@b.c", "pw");

    await expect(api.get("/me")).resolves.toEqual({ id: 7 });

    expect(backend.calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST /api/v1/auth/login",
      "GET /api/v1/me",
      "POST /api/v1/auth/refresh",
      "GET /api/v1/me",
    ]);
    expect(bearer(backend.calls[3])).toBe("Bearer new");
    expect(backend.calls[2].credentials).toBe("same-origin"); // the refresh cookie must travel
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });

  it("shares one refresh between concurrent 401s (a rotated refresh token is blacklisted)", async () => {
    let refreshed = false;
    const backend = fakeBackend({
      "POST /api/v1/auth/refresh": async () => {
        await new Promise((r) => setTimeout(r, 10));
        refreshed = true;
        return json(200, { access: "new" });
      },
      "GET /api/v1/a": () => (refreshed ? json(200, "a") : json(401, {})),
      "GET /api/v1/b": () => (refreshed ? json(200, "b") : json(401, {})),
      "GET /api/v1/c": () => (refreshed ? json(200, "c") : json(401, {})),
    });
    const api = createApiClient({ fetch: backend.fetch });

    const results = await Promise.all([api.get("/a"), api.get("/b"), api.get("/c")]);

    expect(results).toEqual(["a", "b", "c"]);
    expect(backend.calls.filter((c) => c.url.endsWith("/auth/refresh"))).toHaveLength(1);
  });

  it("signs the user out when the refresh fails", async () => {
    const backend = fakeBackend({
      "POST /api/v1/auth/login": () => json(200, { access: "old" }),
      "POST /api/v1/auth/refresh": () => json(401, { detail: "expired" }),
      "GET /api/v1/me": () => json(401, {}),
    });
    const onUnauthenticated = vi.fn();
    const api = createApiClient({ fetch: backend.fetch, onUnauthenticated });
    await api.login("a@b.c", "pw");

    const error = (await api.get("/me").catch((e: unknown) => e)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(401);
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
    expect(api.hasAccessToken()).toBe(false);
  });

  it("retries only once: a second 401 after a successful refresh signs out", async () => {
    const backend = fakeBackend({
      "POST /api/v1/auth/refresh": () => json(200, { access: "new" }),
      "GET /api/v1/me": () => json(401, {}),
    });
    const onUnauthenticated = vi.fn();
    const api = createApiClient({ fetch: backend.fetch, onUnauthenticated });

    await expect(api.get("/me")).rejects.toMatchObject({ status: 401 });

    expect(backend.calls.filter((c) => c.url === "/api/v1/me")).toHaveLength(2);
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it("does not refresh on 403: no permission is not an expired session", async () => {
    const backend = fakeBackend({ "GET /api/v1/employees": () => json(403, { detail: "denied" }) });
    const onUnauthenticated = vi.fn();
    const api = createApiClient({ fetch: backend.fetch, onUnauthenticated });

    await expect(api.get("/employees")).rejects.toMatchObject({ status: 403, body: { detail: "denied" } });

    expect(backend.calls).toHaveLength(1);
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });

  it("reports a wrong password from login without treating it as an expired session", async () => {
    const backend = fakeBackend({ "POST /api/v1/auth/login": () => json(401, { detail: "Invalid email or password." }) });
    const onUnauthenticated = vi.fn();
    const api = createApiClient({ fetch: backend.fetch, onUnauthenticated });

    await expect(api.login("a@b.c", "wrong")).rejects.toMatchObject({ status: 401 });

    expect(backend.calls.filter((c) => c.url.endsWith("/auth/refresh"))).toHaveLength(0);
    expect(onUnauthenticated).not.toHaveBeenCalled();
    expect(api.hasAccessToken()).toBe(false);
  });

  it("logout clears the token even if the server call fails", async () => {
    const backend = fakeBackend({
      "POST /api/v1/auth/login": () => json(200, { access: "t" }),
      "POST /api/v1/auth/logout": () => {
        throw new TypeError("offline");
      },
    });
    const api = createApiClient({ fetch: backend.fetch });
    await api.login("a@b.c", "pw");

    await expect(api.logout()).rejects.toMatchObject({ status: 0 });

    expect(api.hasAccessToken()).toBe(false);
  });

  it("sends files as multipart form data, leaving the boundary to the browser", async () => {
    const backend = fakeBackend({ "POST /api/v1/documents": () => json(201, { id: 9 }) });
    const api = createApiClient({ fetch: backend.fetch });
    const form = new FormData();
    form.set("document_type", "iqama");
    form.set("file", new Blob(["%PDF-1.4"], { type: "application/pdf" }), "scan.pdf");

    await api.post("/documents", form);

    const [call] = backend.calls;
    expect(call.body).toBe(form); // not JSON-encoded
    expect(call.headers.get("Content-Type")).toBeNull(); // fetch adds multipart/form-data; boundary=…
  });

  it("deletes with DELETE and accepts an empty 204 answer", async () => {
    const backend = fakeBackend({ "DELETE /api/v1/documents/9": () => new Response(null, { status: 204 }) });
    const api = createApiClient({ fetch: backend.fetch });
    await expect(api.del("/documents/9")).resolves.toBeUndefined();
  });

  it("downloads a file with the session and the server's file name", async () => {
    const backend = fakeBackend({
      "POST /api/v1/auth/login": () => json(200, { access: "t" }),
      "GET /api/v1/employees/export": () =>
        new Response("xlsx-bytes", { status: 200, headers: { "Content-Disposition": 'attachment; filename="employees-2026-10-21.xlsx"' } }),
    });
    const api = createApiClient({ fetch: backend.fetch, getCompanyId: () => 3 });
    await api.login("hr@x", "pw");

    const { blob, filename } = await api.download("/employees/export", { status: "active" });

    expect(filename).toBe("employees-2026-10-21.xlsx");
    expect(await blob.text()).toBe("xlsx-bytes");
    const call = backend.calls.at(-1)!;
    expect(call.url).toContain("status=active");
    expect(call.headers.get("Authorization")).toBe("Bearer t");
    expect(call.headers.get("X-Company-Id")).toBe("3");
  });

  it("reports a refused export as an ApiError with the body", async () => {
    const backend = fakeBackend({ "GET /api/v1/employees/export": () => json(403, { detail: "No" }) });
    const api = createApiClient({ fetch: backend.fetch });
    await expect(api.download("/employees/export")).rejects.toMatchObject({ status: 403, body: { detail: "No" } });
  });
});
