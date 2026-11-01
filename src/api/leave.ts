/** Leave types and policies (Phase 2 task 6). Shapes follow apps/leave serializers. */

import type { SettingsTable } from "./calendar";
import { formData } from "./hr";
import { api, type Page } from "./index";

export type LeaveCategory =
  | "annual" | "sick" | "maternity" | "paternity" | "marriage" | "bereavement" | "hajj" | "exam" | "iddah" | "unpaid" | "other";
export type Entitlement = "per_year" | "per_occasion" | "per_service" | "unlimited";
export type LeaveColor = "teal" | "pink" | "lavender" | "orange" | "sky" | "amber" | "green" | "neutral";

export type Band = { min_service_years: string; days: string };
export type Tier = { days: number; pay_percent: string };

export type LeavePolicy = {
  id: number;
  leave_type: number;
  scope: "company" | "tenant";
  company: number | null;
  entitlement: Entitlement;
  days: string | null;
  count_mode: "calendar" | "working";
  holidays_extend: boolean;
  paid: boolean;
  tier_window_days: number | null;
  min_service_days: number | null;
  max_times: number | null;
  max_days_per_request: number | null;
  within_days_of_event: number | null;
  min_notice_days: number | null;
  requires_attachment: boolean;
  carry_forward_max_days: string | null;
  service_suspends_after_days: number | null;
  source: string;
  bands: Band[];
  tiers: Tier[];
};

export type LeaveType = {
  id: number;
  code: string;
  category: LeaveCategory;
  name_ar: string;
  name_en: string;
  gender: "" | "female" | "male";
  color: LeaveColor;
  sort_order: number;
  is_system: boolean;
  is_active: boolean;
  policy: LeavePolicy | null;
  policy_scope: "company" | "tenant" | null;
};

export type LeaveSettings = { leave_year_start: "hire_anniversary" | "calendar_year" };
export type SelfServiceSettings = {
  permissions_per_month: number;
  permission_hours_per_month: string;
  permission_max_hours: string;
  remote_days_per_month: number;
  expense_max_age_days: number;
};

export type BalanceKind = "yearly" | "window" | "service" | "occasion" | "unlimited";
export type LeaveBalance = {
  leave_type: { id: number; code: string; name_ar: string; name_en: string; color: LeaveColor };
  kind: BalanceKind;
  year: { start: string; end: string } | null;
  entitled: string | null;
  available: string | null;
  pending: string;
  parts: Partial<Record<"opening" | "carried" | "accrued" | "taken" | "adjusted" | "expired" | "times", string | number>>;
  count_mode: "calendar" | "working";
  paid: boolean;
};
export type EntryKind =
  | "opening" | "accrual" | "adjustment" | "taken" | "reversal" | "carry_out" | "carry_forward" | "expiry" | "encashment";
export type LeaveEntry = {
  id: number;
  employee: number;
  leave_type: number;
  kind: EntryKind;
  kind_label: string;
  days: string;
  entry_date: string;
  year_start: string;
  period_end: string | null;
  reference: string;
  note: string;
  created_by: { id: number; name_ar: string; name_en: string } | null;
  created_at: string;
};

export type LeaveRequestStatus = "draft" | "pending" | "returned" | "approved" | "rejected" | "cancelled";
export type LeaveRequest = {
  id: number;
  employee: { id: number; name_ar: string; name_en: string; employee_no: string };
  requester: number;
  leave_type: { id: number; code: string; name_ar: string; name_en: string; color: LeaveColor };
  start_date: string;
  end_date: string;
  days: string;
  reason: string;
  event_date: string | null;
  file_name: string;
  has_file: boolean;
  status: LeaveRequestStatus;
  submitted_at: string | null;
  pay_split: [number, string][];
  reversed_at: string | null;
  reversed_from: string | null;
  reversed_days: string | null;
  reversal_reason: string;
  workflow_id: number | null;
  approval: { id: number | null; status: string; step: { ar: string; en: string } | null; comment: string } | null;
  substitute: { id: number; name_ar: string; name_en: string } | null;
  handover_notes: string;
  expected_return: string | null;
  returned_on: string | null;
  late_days: string | null;
  return_state: null | "due" | "on_time" | "late" | "early";
  pay_in_advance: boolean;
  advance: { month?: string; pieces?: { month: string; days: number; amount: string }[] };
};
export type RequestableType = {
  id: number;
  code: string;
  name_ar: string;
  name_en: string;
  color: LeaveColor;
  count_mode: "calendar" | "working";
  requires_attachment: boolean;
  needs_event: boolean;
  max_days: string | number | null;
  min_notice_days: number | null;
  /** Annual leave with payroll on: its pay can come with the month before (Art. 109). */
  pay_in_advance: boolean;
};
export type LeaveInput = {
  leave_type: number;
  start_date: string;
  end_date: string;
  reason?: string;
  event_date?: string | null;
  employee?: number;
  substitute?: number | null;
  handover_notes?: string;
  pay_in_advance?: boolean;
};
export type LeavePreview = {
  days: string;
  count_mode: "calendar" | "working" | null;
  balance: { available: string; pending: string; after: string } | null;
  needs_attachment: boolean;
  errors: Record<string, string[]>;
};

export const leave = {
  requests: (query: { mine?: boolean; status?: string; employee?: number; page?: number; return?: "due" } = {}) =>
    api.get<Page<LeaveRequest>>("/leave-requests", { ...query, mine: query.mine ? 1 : undefined, page_size: 50 }),
  requestableTypes: (employee?: number) => api.get<RequestableType[]>("/leave-requests/types", { employee }),
  preview: (body: LeaveInput, editing?: number) => api.post<LeavePreview>(`/leave-requests/preview${editing ? `?id=${editing}` : ""}`, body),
  request: (id: number) => api.get<LeaveRequest>(`/leave-requests/${id}`),
  askLeave: (body: LeaveInput & { file?: File | null }) => api.post<LeaveRequest>("/leave-requests", formData(body)),
  updateLeave: (id: number, body: Partial<LeaveInput> & { file?: File | null }) => api.patch<LeaveRequest>(`/leave-requests/${id}`, formData(body)),
  resubmitLeave: (id: number) => api.post<LeaveRequest>(`/leave-requests/${id}/submit`, {}),
  reverseLeave: (id: number, body: { from_date?: string; reason: string }) => api.post<LeaveRequest>(`/leave-requests/${id}/reverse`, body),
  confirmReturn: (id: number, returnedOn?: string) =>
    api.post<LeaveRequest>(`/leave-requests/${id}/return`, returnedOn ? { returned_on: returnedOn } : {}),
  substitutes: (search = "") =>
    api.get<{ id: number; name_ar: string; name_en: string; employee_no: string }[]>("/leave-requests/substitutes", { search }),
  leaveFile: (id: number) => api.get<{ url: string }>(`/leave-requests/${id}/download`),
  balances: (employee?: number) => api.get<{ employee: number; on: string; balances: LeaveBalance[] }>("/leave-balances", { employee }),
  entries: (employee: number, leaveType?: number, page = 1) =>
    api.get<Page<LeaveEntry>>("/leave-entries", { employee, leave_type: leaveType, page, page_size: 50 }),
  createEntry: (body: { employee: number; leave_type: number; kind: "adjustment" | "opening"; days: string; entry_date?: string; note: string }) =>
    api.post<LeaveEntry>("/leave-entries", body),
  access: () => api.get<{ manage: boolean; shared: boolean }>("/leave-types/access"),
  types: (active = false) => api.get<LeaveType[]>("/leave-types", { active: active ? 1 : undefined }),
  createType: (body: Partial<LeaveType>) => api.post<LeaveType>("/leave-types", body),
  updateType: (id: number, body: Partial<LeaveType>) => api.patch<LeaveType>(`/leave-types/${id}`, body),
  deleteType: (id: number) => api.del(`/leave-types/${id}`),
  policies: (leaveType: number) => api.get<Page<LeavePolicy>>("/leave-policies", { leave_type: leaveType }),
  /** The company's own policy, starting from the account's rules. */
  ownPolicy: (leaveType: number) => api.post<LeavePolicy>("/leave-policies", { leave_type: leaveType, scope: "company" }),
  updatePolicy: (id: number, body: Partial<LeavePolicy>) => api.patch<LeavePolicy>(`/leave-policies/${id}`, body),
  /** Back to the account's policy. */
  deletePolicy: (id: number) => api.del(`/leave-policies/${id}`),
  settings: () => api.get<SettingsTable<LeaveSettings>>("/leave-settings"),
  updateSettings: (level: "account" | "company", body: Partial<{ [K in keyof LeaveSettings]: LeaveSettings[K] | null }>) =>
    api.patch<SettingsTable<LeaveSettings>>("/leave-settings", { level, ...body }),
  selfService: () => api.get<SettingsTable<SelfServiceSettings>>("/self-service-settings"),
  updateSelfService: (level: "account" | "company", body: Partial<{ [K in keyof SelfServiceSettings]: SelfServiceSettings[K] | null }>) =>
    api.patch<SettingsTable<SelfServiceSettings>>("/self-service-settings", { level, ...body }),
};
