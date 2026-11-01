/** Public API clients (Phase 6 task 21), managed with api.manage_clients. Shapes follow apps/public_api/manage.py. */

import { api, type Named, type Page } from "./index";

export type ApiClientRow = {
  id: number;
  name: string;
  client_id: string;
  secret_hint: string;
  scopes: string[];
  companies: number[];
  role: number;
  is_active: boolean;
  last_used_at: string | null;
  rotated_at: string | null;
  created_at: string;
  info: { role: Named & { code: string }; companies: (Named & { id: number })[] };
};
export type ApiClientBody = { name: string; scopes: string[]; companies: number[]; role: number | null };
export type ApiClientOptions = { scopes: { code: string; label: string }[]; roles: (Named & { id: number; code: string })[]; companies: (Named & { id: number })[] };

export const apiClientsApi = {
  list: () => api.get<Page<ApiClientRow>>("/api-clients", { page_size: 100 }),
  options: () => api.get<ApiClientOptions>("/api-clients/options"),
  create: (body: ApiClientBody) => api.post<ApiClientRow & { client_secret: string }>("/api-clients", body),
  update: (id: number, body: Partial<ApiClientBody>) => api.patch<ApiClientRow>(`/api-clients/${id}`, body),
  rotate: (id: number) => api.post<ApiClientRow & { client_secret: string }>(`/api-clients/${id}/rotate`, {}),
  revoke: (id: number) => api.post<ApiClientRow>(`/api-clients/${id}/revoke`, {}),
};

// --- task 22: webhooks ---------------------------------------------------------------------------------------------

export type WebhookEndpoint = { id: number; name: string; url: string; events: string[]; companies: number[]; is_active: boolean; disabled_at: string | null; disabled_reason: string; created_at: string; info: { last: { status: string; at: string; code: number | null } | null } };
export type WebhookBody = { name: string; url: string; events: string[]; companies: number[] };
export type WebhookDelivery = { id: number; event: { id: string; type: string; data: Record<string, unknown> }; status: "pending" | "sent" | "failed" | "skipped"; attempts: number; next_attempt_at: string | null; last_status: number | null; last_error: string; sent_at: string | null; created_at: string };

export const webhooksApi = {
  list: () => api.get<Page<WebhookEndpoint>>("/webhook-endpoints", { page_size: 100 }),
  options: () => api.get<{ events: { code: string; label: string }[]; companies: (Named & { id: number })[] }>("/webhook-endpoints/options"),
  create: (body: WebhookBody) => api.post<WebhookEndpoint & { secret: string }>("/webhook-endpoints", body),
  update: (id: number, body: Partial<WebhookBody & { is_active: boolean }>) => api.patch<WebhookEndpoint>(`/webhook-endpoints/${id}`, body),
  remove: (id: number) => api.del(`/webhook-endpoints/${id}`),
  rotate: (id: number) => api.post<WebhookEndpoint & { secret: string }>(`/webhook-endpoints/${id}/rotate`, {}),
  test: (id: number) => api.post<WebhookDelivery>(`/webhook-endpoints/${id}/test`, {}),
  deliveries: (id: number) => api.get<WebhookDelivery[]>(`/webhook-endpoints/${id}/deliveries`),
  redeliver: (id: number, delivery: number) => api.post<WebhookDelivery>(`/webhook-endpoints/${id}/deliveries/${delivery}/redeliver`, {}),
};
