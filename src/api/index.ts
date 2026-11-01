import i18n from "@/i18n";

import { createApiClient, type Query } from "./client";

export { ApiError } from "./client";

/** Active company / branch, written by the session provider and read by the client on every request. */
export const scope: { companyId: number | null; branchId: number | null } = { companyId: null, branchId: null };

const signedOut = new Set<() => void>();

/** Subscribe to "the session could not be renewed" (refresh token expired or revoked). */
export function onSignedOut(listener: () => void) {
  signedOut.add(listener);
  return () => void signedOut.delete(listener);
}

export const api = createApiClient({
  getCompanyId: () => scope.companyId,
  getBranchId: () => scope.branchId,
  getLanguage: () => i18n.language,
  onUnauthenticated: () => signedOut.forEach((listener) => listener()),
});

// --- Response shapes (see backend serializers) -------------------------------------------------

export type Named = { name_ar: string; name_en: string };
export type MeBranch = Named & { id: number; is_main: boolean };
export type MeCompany = Named & { id: number; logo: string | null; branches: MeBranch[] };
export type Me = {
  id: number;
  email: string;
  full_name_ar: string;
  full_name_en: string;
  preferred_language: "ar" | "en";
  is_tenant_admin: boolean;
  tenant: Named & { schema: string; status: "trial" | "active" | "suspended" | "cancelled"; modules: string[] };
  default_company_id: number | null;
  companies: MeCompany[];
  /** Permission codes per company id. */
  permissions: Record<string, string[]>;
  /** The user's own employee file, if they are an employee. */
  employee: { id: number; company: number } | null;
};

/** A report's download (Phase 6 task 17): every report exports as Excel or PDF. */
export type ExportFormat = "xlsx" | "pdf";

export type Page<T> = { count: number; next: string | null; previous: string | null; results: T[] };

export type EmployeeStatus = "pending" | "hired" | "active" | "suspended" | "terminated" | "contract_ended";
export type Employee = Named & {
  id: number;
  company: number;
  employee_no: string;
  user: number | null;
  branch: number | null;
  department: number | null;
  manager: number | null;
  first_name_ar: string;
  father_name_ar: string;
  grandfather_name_ar: string;
  family_name_ar: string;
  first_name_en: string;
  father_name_en: string;
  grandfather_name_en: string;
  family_name_en: string;
  job_title: number | null;
  grade: number | null;
  employment_type: "full_time" | "part_time";
  status: EmployeeStatus;
  status_reason: string;
  hire_date: string | null;
  probation_end: string | null;
  confirmation_date: string | null;
  termination_date: string | null;
  mobile: string;
  work_email: string;
  /** Sensitive groups (personal / salary / bank) are left out when the user may not see them for this row. */
  id_type?: "national_id" | "iqama" | "border_no" | "";
  id_number?: string;
  id_expiry?: string | null;
  id_expiry_hijri?: string | null;
  nationality?: string | null;
  gender?: "male" | "female" | "";
  date_of_birth?: string | null;
  date_of_birth_hijri?: string | null;
  marital_status?: "single" | "married" | "divorced" | "widowed" | "";
  personal_email?: string;
  building_number?: string;
  street?: string;
  district?: string;
  city?: number | null;
  postal_code?: string;
  additional_number?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relation?: string;
  basic_salary?: string | null;
  housing_allowance?: string | null;
  transport_allowance?: string | null;
  other_allowances?: string | null;
  bank?: string | null;
  iban?: string;
  account_holder_name?: string;
  /** Detail only: permission codes the user holds over this employee (their role's data scope). */
  access?: string[];
};

/** Field groups of the employee file. A group is missing from a row when the user may not read it there. */
export const PERSONAL_FIELDS = [
  "id_type", "id_number", "id_expiry", "nationality", "gender", "date_of_birth", "marital_status", "personal_email",
  "building_number", "street", "district", "city", "postal_code", "additional_number",
  "emergency_contact_name", "emergency_contact_phone", "emergency_contact_relation",
] as const satisfies readonly (keyof Employee)[];
export const SALARY_FIELDS = ["basic_salary", "housing_allowance", "transport_allowance", "other_allowances"] as const;
export const BANK_FIELDS = ["bank", "iban", "account_holder_name"] as const;
export const canRead = (employee: Employee, fields: readonly (keyof Employee)[]) => fields[0] in employee;
/** Does the user hold `code` over this employee (not just somewhere in the company)? Uses the detail's `access`. */
export const holds = (employee: Employee, code: string) => employee.access?.includes(code) ?? false;

export type Department = Named & {
  id: number;
  company: number;
  code: string;
  branch: number | null;
  parent: number | null;
  manager: number | null;
  is_active: boolean;
};

export type Bilingual = { ar: string; en: string };
export type Person = { id: number; name_ar: string; name_en: string };

export type AppNotification = {
  id: number;
  kind: string;
  company: number | null;
  title_ar: string;
  title_en: string;
  body_ar: string;
  body_en: string;
  url: string;
  created_at: string;
  read: boolean;
};

export type RequestStatus = "draft" | "pending" | "returned" | "approved" | "rejected" | "cancelled";

export type WorkflowRequest = {
  id: number;
  request_type: string;
  object_id: number;
  type_name: Bilingual;
  title_ar: string;
  title_en: string;
  status: RequestStatus;
  requester: Person;
  employee: (Named & { id: number; employee_no: string }) | null;
  submitted_at: string;
  decided_at: string | null;
  current_step: Bilingual | null;
  can_cancel: boolean;
};

export type WorkflowEvent = {
  action: "submitted" | "resubmitted" | "approved" | "rejected" | "returned" | "cancelled" | "skipped" | "escalated" | "completed";
  step_order: number | null;
  actor: Person | null;
  comment: string;
  created_at: string;
};

export type WorkflowRequestDetail = WorkflowRequest & {
  summary: { label: Bilingual; value: string }[];
  events: WorkflowEvent[];
  tasks: { id: number; step_order: number; step_name_ar: string; step_name_en: string; assignee: Person; status: string; comment: string; acted_at: string | null }[];
  /** The user's pending task on this request (they can decide it from the detail). */
  my_task: number | null;
  /** The request has a file (a sick note, a proof): GET /requests/{id}/attachment gives a signed link. */
  has_attachment: boolean;
};

export type RequestFilters = { type?: string; status?: string; search?: string; page?: number };

export type ApprovalTask = {
  id: number;
  status: "pending" | "approved" | "rejected" | "returned" | "superseded" | "cancelled";
  step_name_ar: string;
  step_name_en: string;
  created_at: string;
  acted_at: string | null;
  due_at: string | null;
  overdue: boolean;
  comment: string;
  /** Set when the task came to you through a delegation: whose approval you are giving. */
  on_behalf_of: Person | null;
  /** Added because the step waited too long. */
  escalated: boolean;
  request: WorkflowRequest;
};

export type Delegation = {
  id: number;
  delegator: Person;
  delegate: Person;
  start_date: string;
  end_date: string;
  request_types: string[];
  request_type_names: Bilingual[];
  reason: string;
  status: "active" | "upcoming" | "ended";
  cancelled_at: string | null;
  created_at: string;
};

export type DelegationInput = {
  delegate: number;
  start_date: string;
  end_date: string;
  request_types: string[];
  reason: string;
};

export type Decision = "approve" | "reject" | "return";

export const endpoints = {
  health: () => api.get<{ status: string; tenant: string; tenant_status: string }>("/health"),
  me: () => api.get<Me>("/me"),
  updateMe: (patch: Partial<Pick<Me, "preferred_language">>) => api.patch<Me>("/me", patch),
  employees: (query: Query, signal?: AbortSignal) => api.get<Page<Employee>>("/employees", query, signal),
  departments: () => api.get<Page<Department>>("/departments", { page_size: 100 }),

  notifications: (query: Query = {}) => api.get<Page<AppNotification>>("/notifications", query),
  unreadCount: () => api.get<{ count: number }>("/notifications/unread-count"),
  markRead: (id: number) => api.post<void>(`/notifications/${id}/read`, {}),
  markAllRead: () => api.post<{ count: number }>("/notifications/read-all", {}),

  approvalTasks: (status: "pending" | "done", filters: RequestFilters = {}) =>
    api.get<Page<ApprovalTask>>("/approvals/tasks", { status, ...filters }),
  approvalCount: () => api.get<{ pending: number }>("/approvals/tasks/count"),
  decide: (taskId: number, decision: Decision, comment: string) =>
    api.post<ApprovalTask>(`/approvals/tasks/${taskId}/${decision}`, { comment }),

  myRequests: (filters: RequestFilters = {}) => api.get<Page<WorkflowRequest>>("/requests", { mine: 1, ...filters }),
  request: (id: number) => api.get<WorkflowRequestDetail>(`/requests/${id}`),
  requestAttachment: (id: number) => api.get<{ url: string; expires_in: number }>(`/requests/${id}/attachment`),
  cancelRequest: (id: number) => api.post<WorkflowRequestDetail>(`/requests/${id}/cancel`, {}),

  createGeneralRequest: (body: { subject: string; details: string }) =>
    api.post<{ id: number; status: RequestStatus }>("/general-requests", body),
  updateGeneralRequest: (id: number, body: { subject: string; details: string }) =>
    api.patch<{ id: number }>(`/general-requests/${id}`, body),
  resubmitGeneralRequest: (id: number) => api.post<{ id: number }>(`/general-requests/${id}/submit`, {}),

  delegations: () => api.get<Page<Delegation>>("/delegations"),
  createDelegation: (body: DelegationInput) => api.post<Delegation>("/delegations", body),
  cancelDelegation: (id: number) => api.post<Delegation>(`/delegations/${id}/cancel`, {}),
  delegationPeople: (search = "") => api.get<(Person & { email: string })[]>("/delegations/people", { search }),
  delegationTypes: () => api.get<{ code: string; name: Bilingual }[]>("/delegations/types"),
};
