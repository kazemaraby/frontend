/** Self-service requests (Phase 2 task 10): short permissions, work missions, remote work. Shapes follow
 * apps/selfservice views. */

import { api } from "./index";

export type ShortKind = "late_arrival" | "early_leave" | "during_day";
export type Usage = {
  month: string;
  permissions: { used: number; limit: number };
  permission_hours: { used: string; limit: string };
  permission_max_hours: string;
  remote_days: { used: number; limit: number };
};

export type DestinationClass = "domestic" | "gcc" | "international";
export type TicketClass = "economy" | "business" | "first";
export type PerDiemRate = { id: number; grade: number | null; destination_class: DestinationClass; daily_amount: string };
export type TicketPolicy = {
  id: number;
  grade: number | null;
  ticket_class: TicketClass;
  every_months: number;
  includes_family: boolean;
  family_members_max: number | null;
  cash_allowed: boolean;
  cash_amount: string | null;
  is_active: boolean;
};
export type TicketBalance = {
  employee: number;
  policy: TicketPolicy | null;
  earned?: number;
  used?: string;
  adjusted?: string;
  pending?: number;
  available?: string;
  next_due?: string | null;
  family?: { id: number; name_ar: string; name_en: string; relationship: string }[];
};

const PATHS = {
  permission: "/permission-requests",
  mission: "/mission-requests",
  remote: "/remote-work-requests",
  trip: "/trip-requests",
  ticket: "/ticket-requests",
} as const;
type Kind = keyof typeof PATHS;
export type Payload = Record<string, string | number | boolean | null | number[]>;
export type Preview = {
  hours?: string;
  days?: string | number;
  destination_class?: DestinationClass;
  daily_rate?: string | null;
  per_diem_total?: string;
  ticket_class?: TicketClass;
  errors: Record<string, string[]>;
};

export const selfService = {
  usage: (month: string) => api.get<Usage>("/self-service/usage", { month }),
  /** `editing`: the returned request being corrected (not counted against itself). */
  preview: (kind: Kind, body: Payload, editing?: number) => api.post<Preview>(`${PATHS[kind]}/preview${editing ? `?id=${editing}` : ""}`, body),
  create: (kind: Kind, body: Payload) => api.post<{ id: number; status: string }>(PATHS[kind], body),
  ticketBalance: (employee?: number) => api.get<TicketBalance>("/ticket-balance", { employee }),
  perDiemRates: () => api.get<PerDiemRate[]>("/per-diem-rates"),
  saveRate: (body: Partial<PerDiemRate>, id?: number) =>
    id ? api.patch<PerDiemRate>(`/per-diem-rates/${id}`, body) : api.post<PerDiemRate>("/per-diem-rates", body),
  deleteRate: (id: number) => api.del(`/per-diem-rates/${id}`),
  ticketPolicies: () => api.get<TicketPolicy[]>("/ticket-policies"),
  savePolicy: (body: Partial<TicketPolicy>, id?: number) =>
    id ? api.patch<TicketPolicy>(`/ticket-policies/${id}`, body) : api.post<TicketPolicy>("/ticket-policies", body),
  deletePolicy: (id: number) => api.del(`/ticket-policies/${id}`),
};
