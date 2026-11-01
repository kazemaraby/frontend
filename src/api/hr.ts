/** Core HR endpoints (Phase 1): employee file, status, contracts, documents, dependents, insurance, lifecycle
 * actions, history, onboarding. Shapes follow the backend serializers in apps/employees and apps/onboarding. */

import type { Query } from "./client";
import { api, type Employee, type EmployeeStatus, type ExportFormat, type Named, type Page, type Person } from "./index";

export type Id = number;
export type Money = string; // decimal string, never a float
type Hijri = { [K in `${string}_hijri`]?: string | null };

// --- master and reference data --------------------------------------------------------------------

export type JobTitle = Named & { id: Id; code: string; occupation_code: string; is_active: boolean };
export type Grade = Named & { id: Id; code: string; rank: number; min_salary?: Money | null; max_salary?: Money | null; is_active: boolean };
export type ContractType = Named & { id: Id; code: string; has_end_date: boolean; is_part_time: boolean; is_active: boolean };
export type DocumentType = Named & {
  id: Id;
  code: string;
  category: string;
  has_expiry: boolean;
  requires_number: boolean;
  alert_days: number[];
  applies_to: "employee" | "dependent" | "both";
  is_active: boolean;
};
export type Country = Named & { code: string; alpha3: string; is_gcc: boolean };
export type Bank = Named & { id: Id; code: string; swift: string };
export type City = Named & { id: Id; code: string; country: string; region: string | null };
export type Role = Named & { id: Id; code: string };

// --- status ----------------------------------------------------------------------------------------

export type StatusOption = {
  to: EmployeeStatus;
  action: string;
  reasons: string[];
  needs_note: boolean;
  needs_hire_date: boolean;
  needs_termination_date: boolean;
  needs_contract: boolean;
};
/** A change waiting for approval: its request (open it in /approvals), where it waits, why it was returned. */
export type PendingApproval = {
  id: Id | null;
  status: "pending" | "returned";
  step: { ar: string; en: string } | null;
  comment: string;
};
export type StatusInfo = {
  status: EmployeeStatus;
  status_reason: string;
  options: StatusOption[];
  pending_request: (PendingApproval & { to: EmployeeStatus }) | null;
};
export type StatusChange = {
  id: Id;
  from_status: EmployeeStatus;
  to_status: EmployeeStatus;
  effective_date: string;
  until: string | null;
  reason: string;
  note: string;
  changed_by: Person | null;
  created_at: string;
};

// --- contracts -------------------------------------------------------------------------------------

export type ContractStatus = "draft" | "active" | "renewed" | "expired" | "terminated" | "cancelled";
export type Contract = Hijri & {
  id: Id;
  employee: Id;
  contract_type: Id;
  contract_no: string;
  status: ContractStatus;
  start_date: string;
  end_date: string | null;
  ended_on: string | null;
  signed_on: string | null;
  probation_days: number;
  probation_end: string | null;
  employer_notice_days: number | null;
  employee_notice_days: number | null;
  renewal_of: Id | null;
  renewal: Id | null;
  basic_salary?: Money | null;
  housing_allowance?: Money | null;
  transport_allowance?: Money | null;
  other_allowances?: Money | null;
  note: string;
  has_file?: boolean;
  file_name?: string;
  probation_request: (PendingApproval & { decision: ProbationDecision }) | null;
};
export type ProbationDecision = "confirm" | "extend" | "end";
export type ProbationReview = {
  id: Id;
  decision: ProbationDecision;
  review_date: string;
  new_end_date: string | null;
  notes: string;
  decided_by: Person | null;
  created_at: string;
};

// --- documents -------------------------------------------------------------------------------------

export type ExpiryStatus = "valid" | "expiring" | "expired" | "no_expiry";
export type EmployeeDocument = Hijri & {
  id: Id;
  employee: Id;
  dependent: Id | null;
  document_type: string; // code
  number: string;
  issue_date: string | null;
  expiry_date: string | null;
  issue_place: string;
  notes: string;
  has_file: boolean;
  file_name: string;
  content_type: string;
  file_size: number | null;
  expiry_status: ExpiryStatus;
  days_to_expiry: number | null;
  uploaded_by: Person | null;
  employee_info: { id: Id; employee_no: string; name_ar: string; name_en: string };
  dependent_name: { ar: string; en: string } | null;
  created_at: string;
};
export type FileLink = { url: string; expires_in: number };

// --- dependents and insurance ----------------------------------------------------------------------

export type Relationship = "spouse" | "son" | "daughter" | "father" | "mother" | "brother" | "sister" | "other";
export type Dependent = Named & {
  id: Id;
  employee: Id;
  relationship: Relationship;
  gender: "male" | "female" | "";
  date_of_birth: string | null;
  nationality: string | null;
  id_type: "national_id" | "iqama" | "border_no" | "";
  id_number: string;
  marital_status: string;
  is_working: boolean;
  on_iqama: boolean;
  is_active: boolean;
  insured: boolean;
  insurance_required: boolean;
};
export type InsurancePolicy = {
  id: Id;
  provider_ar: string;
  provider_en: string;
  policy_no: string;
  start_date: string;
  end_date: string;
  classes: string[];
  is_active: boolean;
  member_count: number;
};
export type InsuranceMember = {
  id: Id;
  policy: Id;
  employee: Id;
  dependent: Id | null;
  insurance_class: string;
  member_no: string;
  start_date: string;
  end_date: string | null;
  has_file: boolean;
  file_name: string;
  covered_today: boolean;
};

// --- lifecycle actions and history -----------------------------------------------------------------

export type ActionType = "promotion" | "transfer" | "salary_change" | "title_change";
export type ActionStatus = "draft" | "pending" | "scheduled" | "applied" | "cancelled";
export const ACTION_FIELDS = {
  promotion: ["job_title", "grade", "basic_salary", "housing_allowance", "transport_allowance", "other_allowances"],
  transfer: ["branch", "department", "manager"],
  salary_change: ["basic_salary", "housing_allowance", "transport_allowance", "other_allowances"],
  title_change: ["job_title"],
} as const satisfies Record<ActionType, readonly string[]>;
export type ActionField = (typeof ACTION_FIELDS)[ActionType][number];
export type LifecycleAction = {
  id: Id;
  employee: Id;
  action_type: ActionType;
  status: ActionStatus;
  effective_date: string;
  changed_fields: ActionField[];
  reason: string;
  error: string;
  created_by: Person | null;
  confirmed_by: Person | null;
  applied_at: string | null;
  approval: (Omit<PendingApproval, "status"> & { status: "pending" | "returned" | "approved" | "rejected" | "cancelled" }) | null;
  created_at: string;
} & { [K in `to_${ActionField}` | `from_${ActionField}`]?: Id | Money | null };

export type ChangeLogEntry = {
  id: Id;
  at: string;
  action: string;
  model: string;
  object_id: string;
  object_repr: string;
  actor: Person | string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};
export type History = {
  status_changes: StatusChange[];
  actions: LifecycleAction[];
  contracts: Contract[];
  change_log: ChangeLogEntry[] | null; // null = no permission
};

// --- onboarding ------------------------------------------------------------------------------------

export type OnboardingTask = {
  id: Id;
  employee: Id;
  employee_name: { ar: string; en: string };
  started_on: string;
  title_ar: string;
  title_en: string;
  details_ar: string;
  details_en: string;
  assignee_type: "hr" | "manager" | "employee" | "role" | "user";
  role: Id | null;
  assignee: Id | null;
  assignee_name: Person | null;
  due_date: string;
  status: "open" | "done" | "skipped";
  is_overdue: boolean;
  completed_by: Person | null;
  completed_at: string | null;
  note: string;
};
export type ImportStatus = "validating" | "ready" | "invalid" | "importing" | "done" | "failed";
export type ImportRow = { row: number; key: string; action: "create" | "update" | "unchanged" | "error"; errors: Record<string, string> };
export type ImportBatch = {
  id: Id;
  kind: string;
  status: ImportStatus;
  file_name: string;
  rows: number;
  summary: Partial<Record<ImportRow["action"], number>>;
  report?: ImportRow[];
  error: string;
  created_by: Person | null;
  confirmed_by: Person | null;
  created_at: string;
  finished_at: string | null;
};
export type SearchResults = {
  employees: (Named & { id: Id; employee_no: string; job_title: { ar: string; en: string } | null; status: EmployeeStatus })[];
  documents: { id: Id; number: string; document_type: { ar: string; en: string }; employee: Named & { id: Id }; expiry_date: string | null }[];
  requests: { id: Id; title_ar: string; title_en: string; status: string }[];
};
export type OrgDepartment = Named & { id: Id; parent: Id | null; manager: Id | null; head_count: number };
export type OrgPerson = Named & {
  id: Id;
  employee_no: string;
  job_title: { ar: string; en: string } | null;
  department: Id | null;
  manager: Id | null;
  status: EmployeeStatus;
};
export type Company = Named & {
  id: Id;
  cr_number: string;
  vat_number: string;
  gosi_number: string;
  mhrsd_establishment_no: string;
  mudad_id: string;
  unified_number: string;
  default_currency: string;
  address_ar: string;
  address_en: string;
  logo: string | null;
  employee_no_prefix: string;
  employee_no_digits: number;
  is_active: boolean;
};
export type Branch = Named & {
  id: Id;
  code: string;
  /** The pay currency of the branch's employees (#4). */
  currency: string;
  establishment_no: string;
  country: string | null;
  city: Id | null;
  is_main: boolean;
  is_active: boolean;
  /** ISO weekdays (5 = Friday); null = the company's weekend. */
  weekend_days: number[] | null;
  timezone: string;
  /** The web check-in geofence (Phase 3 task 8): a centre and a radius; empty = not checked. */
  geofence_lat: string | null;
  geofence_lng: string | null;
  geofence_radius_m: number | null;
};
export type DepartmentRow = Named & { id: Id; code: string; branch: Id | null; parent: Id | null; manager: Id | null; is_active: boolean };
export type OnboardingProgress = { total: number; open: number; done: number; skipped: number; overdue: number };

// --- endpoints -------------------------------------------------------------------------------------

const all = <T>(path: string, query: Query = {}) => api.get<Page<T>>(path, { page_size: 100, ...query });

/** Builds multipart data: undefined values are left out, null becomes "" (cleared), files are attached. */
export function formData(values: Record<string, unknown>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    if (value instanceof Blob) form.set(key, value, (value as File).name ?? "file");
    else form.set(key, value === null ? "" : String(value));
  }
  return form;
}

export const hr = {
  employee: (id: Id) => api.get<Employee>(`/employees/${id}`),
  createEmployee: (body: Partial<Employee>) => api.post<Employee>("/employees", body),
  updateEmployee: (id: Id, body: Partial<Employee> & Hijri) => api.patch<Employee>(`/employees/${id}`, body),
  searchEmployees: (search: string) => api.get<Page<Employee>>("/employees", { search, page_size: 20 }),
  employeeChoices: () => api.get<Page<Employee>>("/employees", { page_size: 100, ordering: "name_ar" }),
  status: (id: Id) => api.get<StatusInfo>(`/employees/${id}/status`),
  /** Sends the change for approval (202); it is made when the route approves it. */
  changeStatus: (id: Id, body: Record<string, string>) => api.post<StatusInfo>(`/employees/${id}/status`, body),

  jobTitles: () => all<JobTitle>("/job-titles"),
  grades: () => all<Grade>("/grades"),
  contractTypes: () => all<ContractType>("/contract-types"),
  documentTypes: () => all<DocumentType>("/document-types"),
  countries: () => api.get<Country[]>("/reference/countries"),
  banks: () => api.get<Bank[]>("/reference/banks"),
  cities: (country = "SA") => api.get<City[]>("/reference/cities", { country }),
  convertDate: (query: { gregorian: string } | { hijri: string }) =>
    api.get<{ gregorian: string; hijri: string }>("/reference/dates", query),

  contracts: (employee: Id) => api.get<Contract[]>(`/employees/${employee}/contracts`),
  createContract: (body: Partial<Contract>) => api.post<Contract>("/contracts", body),
  updateContract: (id: Id, body: Partial<Contract> | FormData) => api.patch<Contract>(`/contracts/${id}`, body),
  activateContract: (id: Id, signed_on?: string) => api.post<Contract>(`/contracts/${id}/activate`, signed_on ? { signed_on } : {}),
  renewContract: (id: Id, body: Partial<Contract>) => api.post<Contract>(`/contracts/${id}/renew`, body),
  deleteContract: (id: Id) => api.del(`/contracts/${id}`),
  contractLink: (id: Id) => api.get<FileLink>(`/contracts/${id}/download`),
  probationReviews: (contract: Id) => api.get<ProbationReview[]>(`/contracts/${contract}/probation-reviews`),
  reviewProbation: (contract: Id, body: { decision: ProbationDecision; notes?: string; new_end_date?: string }) =>
    api.post<{ pending_request: NonNullable<Contract["probation_request"]> }>(`/contracts/${contract}/probation-reviews`, body),

  documents: (employee: Id) => api.get<EmployeeDocument[]>(`/employees/${employee}/documents`),
  uploadDocument: (form: FormData) => api.post<EmployeeDocument>("/documents", form),
  updateDocument: (id: Id, form: FormData) => api.patch<EmployeeDocument>(`/documents/${id}`, form),
  deleteDocument: (id: Id) => api.del(`/documents/${id}`),
  documentLink: (id: Id) => api.get<FileLink>(`/documents/${id}/download`),

  dependents: (employee: Id) => api.get<Dependent[]>(`/employees/${employee}/dependents`),
  createDependent: (body: Partial<Dependent>) => api.post<Dependent>("/dependents", body),
  updateDependent: (id: Id, body: Partial<Dependent>) => api.patch<Dependent>(`/dependents/${id}`, body),
  deleteDependent: (id: Id) => api.del(`/dependents/${id}`),

  insurance: (employee: Id) => api.get<InsuranceMember[]>(`/employees/${employee}/insurance`),
  policies: () => all<InsurancePolicy>("/insurance-policies"),
  createMember: (body: Partial<InsuranceMember>) => api.post<InsuranceMember>("/insurance-members", body),
  updateMember: (id: Id, body: FormData) => api.patch<InsuranceMember>(`/insurance-members/${id}`, body),
  deleteMember: (id: Id) => api.del(`/insurance-members/${id}`),
  memberLink: (id: Id) => api.get<FileLink>(`/insurance-members/${id}/download`),

  actions: (employee: Id) => api.get<LifecycleAction[]>(`/employees/${employee}/actions`),
  createAction: (body: Record<string, unknown>) => api.post<LifecycleAction>("/actions", body),
  submitAction: (id: Id) => api.post<LifecycleAction>(`/actions/${id}/submit`, {}),
  cancelAction: (id: Id) => api.post<LifecycleAction>(`/actions/${id}/cancel`, {}),
  deleteAction: (id: Id) => api.del(`/actions/${id}`),
  history: (employee: Id) => api.get<History>(`/employees/${employee}/history`),

  exportEmployees: (query: Query, as: ExportFormat = "xlsx") => api.download("/employees/export", { ...query, export: as }),
  exportDocuments: (query: Query, as: ExportFormat = "xlsx") => api.download("/documents/export", { ...query, export: as }),
  documentReport: (query: Query) => api.get<Page<EmployeeDocument>>("/documents", query),

  imports: (kind = "employees") => api.get<Page<ImportBatch>>("/imports", { kind, page_size: 20 }),
  importBatch: (id: Id) => api.get<ImportBatch>(`/imports/${id}`),
  uploadImport: (file: File, kind = "employees") => api.post<ImportBatch>("/imports", formData({ kind, file })),
  confirmImport: (id: Id) => api.post<ImportBatch>(`/imports/${id}/confirm`, {}),
  importTemplate: (kind = "employees") => api.download("/imports/template", { kind }),
  importReport: (id: Id) => api.download(`/imports/${id}/report`),

  search: (q: string, signal?: AbortSignal) => api.get<SearchResults>("/search", { q }, signal),
  orgChart: () => api.get<{ departments: OrgDepartment[]; people: OrgPerson[] }>("/org-chart"),
  companies: () => all<Company>("/companies"),
  createCompany: (body: Partial<Company>) => api.post<Company>("/companies", body),
  updateCompany: (id: Id, body: Partial<Company> | FormData) => api.patch<Company>(`/companies/${id}`, body),
  branches: () => all<Branch>("/branches"),
  createBranch: (body: Partial<Branch>) => api.post<Branch>("/branches", body),
  updateBranch: (id: Id, body: Partial<Branch>) => api.patch<Branch>(`/branches/${id}`, body),
  deleteBranch: (id: Id) => api.del(`/branches/${id}`),
  departmentRows: () => all<DepartmentRow>("/departments"),
  updateDepartment: (id: Id, body: Partial<DepartmentRow>) => api.patch<DepartmentRow>(`/departments/${id}`, body),
  saveJobTitle: (body: Partial<JobTitle>, id?: Id) =>
    id ? api.patch<JobTitle>(`/job-titles/${id}`, body) : api.post<JobTitle>("/job-titles", body),
  deleteJobTitle: (id: Id) => api.del(`/job-titles/${id}`),
  saveGrade: (body: Partial<Grade>, id?: Id) => (id ? api.patch<Grade>(`/grades/${id}`, body) : api.post<Grade>("/grades", body)),
  deleteGrade: (id: Id) => api.del(`/grades/${id}`),
  createDepartment: (body: Partial<DepartmentRow>) => api.post<DepartmentRow>("/departments", body),
  deleteDepartment: (id: Id) => api.del(`/departments/${id}`),

  onboardingTasks: (query: Query) => api.get<Page<OnboardingTask>>("/onboarding-tasks", { page_size: 100, ...query }),
  updateTask: (id: Id, body: Partial<Pick<OnboardingTask, "status" | "note">>) =>
    api.patch<OnboardingTask>(`/onboarding-tasks/${id}`, body),
  onboardingProgress: (employee: Id) => api.get<OnboardingProgress>("/onboarding-tasks/progress", { employee }),
};
