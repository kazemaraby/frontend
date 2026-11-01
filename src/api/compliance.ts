import { api } from "./index";
import type { SettingsTableData, SettingsValue } from "./payroll";

/** KSA compliance (Phase 5). Task 0: the government's numbers as dated values, Nitaqat activities and thresholds, and
 * the company's compliance practice. */
export type RuleStatus = "to_confirm" | "confirmed";
type Dated = { id: number; valid_from: string; valid_to: string | null; source: string; status: RuleStatus; note: string };
/** `hint`: what the seeded value rests on (translated); `note`: the user's own. */
export type ComplianceRule = Dated & { code: string; label: string; unit: string; hint: string; value: string };
export type GovernmentFee = Dated & { code: string; label: string; condition: string; condition_label: string; hint: string; amount: string; unit: "month" | "year" | "visa" | "extra_month" };
export type NitaqatBand = "platinum" | "high_green" | "medium_green" | "low_green";
export type NitaqatThreshold = Dated & { activity: number; band: NitaqatBand; m: string; c: string; min_employees: number; max_employees: number | null };
export type NitaqatActivity = { id: number; code: string; name_ar: string; name_en: string; is_active: boolean };
export type DatedTable<T> = { can_change: boolean; rows: T[] };
export type DatedKind = "compliance-rules" | "government-fees" | "nitaqat-thresholds";

export const complianceSettings = {
  table: <T>(kind: DatedKind) => api.get<DatedTable<T>>(`/${kind}`),
  add: (kind: DatedKind, body: Record<string, unknown>) => api.post<unknown>(`/${kind}`, body),
  change: (kind: DatedKind, id: number, body: Record<string, unknown>) => api.patch<unknown>(`/${kind}/${id}`, body),
  remove: (kind: DatedKind, id: number) => api.del(`/${kind}/${id}`),
  activities: () => api.get<NitaqatActivity[]>("/nitaqat-activities"),
  saveActivity: (body: Partial<NitaqatActivity>, id?: number) =>
    id ? api.patch<NitaqatActivity>(`/nitaqat-activities/${id}`, body) : api.post<NitaqatActivity>("/nitaqat-activities", body),
  practice: () => api.get<SettingsTableData>("/compliance-settings"),
  savePractice: (level: "account" | "company", values: Record<string, SettingsValue>) =>
    api.patch<SettingsTableData>("/compliance-settings", { level, ...values }),
};

// --- task 1: the integration layer --------------------------------------------------------------------------
export type GovSystem = "qiwa" | "gosi" | "mudad" | "muqeem";
export type IntegrationMode = "manual" | "api" | "mock";
export type Integration = { system: GovSystem; mode: IntegrationMode; base_url: string; is_active: boolean; credentials_set: boolean; credential_keys: string[]; last_sync_at: string | null; last_status: string };
/** `samples`: test files can be downloaded (development only). */
export type FileKind = { code: string; system: GovSystem; label: string; note: string; monthly: boolean; samples: boolean; fields: { key: string; label: string; headers: string[] }[] };
export type RunStatus = "checking" | "ready" | "failed" | "discarded" | "purged";
export type GovDataRun = {
  id: number;
  system: GovSystem;
  kind: string;
  kind_label: string;
  mode: IntegrationMode;
  period: string | null;
  status: RunStatus;
  file_name: string;
  counts: Partial<Record<"read" | RecordStatus, number>>;
  errors: string[];
  started_by_name: string;
  created_at: string;
  finished_at: string | null;
};
export type RecordStatus = "matched" | "different" | "unknown" | "ambiguous" | "missing";
export type Resolution = "open" | "accepted" | "linked" | "ignored";
export type ExternalRecord = {
  id: number;
  external_id: string;
  data: Record<string, string | null>;
  status: RecordStatus;
  /** `hidden`: a money value the user may not see (no salary access over the person) */
  differences: { field: string; label: string; ours: string | null; theirs: string | null; hidden?: boolean }[];
  hidden_fields?: string[];
  row: number | null;
  employee: number | null;
  employee_info: { id: number; employee_no: string; name_ar: string; name_en: string } | null;
  resolution: Resolution;
  resolved_at: string | null;
  note: string;
};
type Paged<T> = { count: number; results: T[] };

export const govData = {
  integrations: () => api.get<Integration[]>("/compliance/integrations"),
  saveIntegration: (system: GovSystem, body: Partial<Integration> & { credentials?: Record<string, string> | null }) =>
    api.request<Integration>(`/compliance/integrations/${system}`, { method: "PUT", body }),
  kinds: () => api.get<FileKind[]>("/compliance/file-kinds"),
  template: (code: string, filled = false) => api.download(`/compliance/file-kinds/${code}/template`, filled ? { filled: "1" } : undefined),
  runs: (page = 1) => api.get<Paged<GovDataRun>>("/compliance/runs", { page }),
  run: (id: number) => api.get<GovDataRun>(`/compliance/runs/${id}`),
  upload: (kind: string, file: File, period?: string) => {
    const body = new FormData();
    body.append("kind", kind);
    body.append("file", file);
    if (period) body.append("period", period);
    return api.post<GovDataRun>("/compliance/runs", body);
  },
  fetch: (kind: string, period?: string) => api.post<GovDataRun>("/compliance/runs/fetch", { kind, ...(period ? { period } : {}) }),
  discard: (id: number) => api.post<GovDataRun>(`/compliance/runs/${id}/discard`, {}),
  records: (id: number, query: { status?: string; resolution?: string; search?: string; page?: number }) =>
    api.get<Paged<ExternalRecord>>(`/compliance/runs/${id}/records`, query),
  resolve: (id: number, body: { action: "accept" | "link" | "ignore" | "reopen"; employee?: number; note?: string }) =>
    api.post<ExternalRecord>(`/compliance/records/${id}/resolve`, body),
};

// --- task 2: establishments and the employees' compliance facts ---------------------------------------------
export type Establishment = { id: number; number: string; is_main: boolean; activity: number | null; is_industrial: boolean; note: string; branches: { id: number; name_ar: string; name_en: string }[]; headcount: number };
export type SaudiEquivalent = "" | "saudi_spouse" | "saudi_mother" | "displaced_tribes";
/** `nationality`, `saudi_equivalent`, `is_student` only with employees.view_personal over the person; `counting_wage`
 * (basic + housing) only with employees.view_salary. */
export type CompliancePerson = {
  id: number;
  employee_no: string;
  name_ar: string;
  name_en: string;
  status: string;
  employment_type: "full_time" | "part_time";
  branch_name: { ar: string; en: string } | null;
  establishment: string;
  nationality?: { code: string; name_ar: string; name_en: string } | null;
  counting_wage?: string | null;
  saudi_equivalent?: SaudiEquivalent;
  is_student?: boolean;
  is_flexible: boolean;
  flexible_hours: string | null;
  is_owner: boolean;
};
export type PersonFacts = Partial<Pick<CompliancePerson, "saudi_equivalent" | "is_student" | "is_flexible" | "flexible_hours" | "is_owner">>;

export const establishmentsApi = {
  list: () => api.get<Establishment[]>("/compliance/establishments"),
  save: (id: number, body: { activity?: number | null; is_industrial?: boolean; note?: string }) => api.patch<Establishment>(`/compliance/establishments/${id}`, body),
  people: (query: { establishment?: number; search?: string; page?: number }) => api.get<Paged<CompliancePerson>>("/compliance/people", query),
  savePerson: (id: number, body: PersonFacts) => api.patch<CompliancePerson>(`/compliance/people/${id}`, body),
};

// --- task 4: Nitaqat and the Saudization report --------------------------------------------------------------
export type NitaqatBandCode = NitaqatBand | "red";
export type NitaqatSnapshot = {
  day: string;
  activity: number | null;
  headcount: number;
  non_saudis: number;
  saudis: string;
  total: string;
  capped_out: string;
  weeks: number;
  average_saudis: string;
  average_total: string;
  percent: string | null;
  band: NitaqatBandCode | "";
  minimums: Partial<Record<NitaqatBand, string>>;
  saudis_to_next: number | null;
  non_saudis_room: number | null;
  saudis_to_lose: number | null;
  problem: string;
  problem_text: string;
};
export type NitaqatRow = {
  establishment: { id: number; number: string; is_main: boolean; activity: number | null };
  snapshot: NitaqatSnapshot | null;
  trend: { day: string; percent: string | null; band: NitaqatBandCode | "" }[];
};
export type NitaqatPerson = { employee: number; employee_no: string; name_ar: string; name_en: string; saudi: string; total: string; reasons: string[]; capped: boolean };
export type SaudizationBy = "establishment" | "band" | "branch" | "department" | "job_title";
export type SaudizationRow = { key: string | number | null; label: string; saudis: number; non_saudis: number; headcount: number; saudis_weighted: string; total_weighted: string; percent: string | null };

export const nitaqatApi = {
  list: () => api.get<{ today: string; establishments: NitaqatRow[] }>("/compliance/nitaqat"),
  refresh: () => api.post<{ today: string; establishments: NitaqatRow[] }>("/compliance/nitaqat", {}),
  people: (establishment: number) => api.get<{ rows: NitaqatPerson[]; hidden: number; capped_out: string }>(`/compliance/nitaqat/${establishment}/people`),
  saudization: (by: SaudizationBy) => api.get<{ by: SaudizationBy; day: string; rows: SaudizationRow[]; totals: Omit<SaudizationRow, "key" | "label"> }>("/compliance/saudization", { by }),
  exportSaudization: (by: SaudizationBy) => api.download("/compliance/saudization", { by, export: "xlsx" }),
};

// --- task 5: the Nitaqat simulation ----------------------------------------------------------------------------
export type SimulatedHire = { count: number; saudi: boolean; wage: string | null; part_time: boolean; student: boolean };
export type SimulatedAssessment = { saudis: string; total: string; percent: string | null; band: NitaqatBandCode | ""; minimums: Partial<Record<NitaqatBand, string>>; saudis_to_next: number | null; non_saudis_room: number | null; saudis_to_lose: number | null };
export type SimulationSide = { headcount: number; spot: SimulatedAssessment; average: SimulatedAssessment };
export type SimulationResult = { day: string; weeks: number; thresholds: boolean; before: SimulationSide; after: SimulationSide };

export const simulationApi = {
  run: (establishment: number, body: { hire: SimulatedHire[]; leave: number[]; wages: { employee: number; wage: string }[] }) =>
    api.post<SimulationResult>(`/compliance/nitaqat/${establishment}/simulate`, body),
};

// --- task 6: Qiwa contract documentation -------------------------------------------------------------------------
export type QiwaIssueCode = "undocumented" | "renewal_undocumented" | "pending" | "rejected" | "salary_differs" | "dates_differ" | "left_documented" | "no_contract";
export type QiwaStatus = "not_documented" | "pending" | "documented" | "rejected" | "expired" | "ended" | "unknown";
/** `wage` only with employees.view_salary over the person. */
export type QiwaIssue = {
  code: QiwaIssueCode;
  label: string;
  since: string | null;
  employee: { id: number; employee_no: string; name_ar: string; name_en: string; status: string };
  contract: { id: number; number: string; start: string; end: string | null; wage?: string | null } | null;
  qiwa: { id: number; number: string; status: QiwaStatus; status_text: string; start: string | null; end: string | null; seen_at: string; wage?: string | null } | null;
};

export const qiwaApi = {
  issues: (query: { issue?: string; search?: string; page?: number }) =>
    api.get<{ known: boolean; counts: Record<QiwaIssueCode, number>; count: number; results: QiwaIssue[] }>("/compliance/qiwa", query),
};

// --- task 7: the GOSI register ---------------------------------------------------------------------------------
export type GosiIssueCode = "not_registered" | "stopped_at_work" | "left_registered" | "not_ours" | "wage_differs" | "nationality_differs" | "start_differs" | "id_differs";
export type GosiIssue = {
  code: GosiIssueCode;
  label: string;
  employee: { id: number; employee_no: string; name_ar: string; name_en: string; status: string } | null;
  subscriber: { id: number; id_number: string; gosi_number: string; name: string; status: "active" | "stopped" | "unknown" } | null;
  ours: string | null;
  theirs: string | null;
  /** a wage the user may not see */
  hidden: boolean;
};
export type InvoiceStatus = "same" | "differs" | "not_invoiced" | "not_on_payroll" | "not_ours";
export type InvoiceRow = {
  employee: { id: number; employee_no: string; name_ar: string; name_en: string } | null;
  id_number?: string;
  status: InvoiceStatus;
  payroll_ee: string;
  payroll_er: string;
  invoice_ee: string;
  invoice_er: string;
  difference: string;
};
export type GosiBranch = "annuities" | "saned" | "hazards";
export type ContributionRow = { establishment: string; people: number; wage: string; employee_total: string; employer_total: string; total: string } & Record<`${GosiBranch}_${"ee" | "er"}`, string>;

export const gosiApi = {
  issues: (query: { issue?: string; search?: string; page?: number }) =>
    api.get<{ known: boolean; counts: Record<GosiIssueCode, number>; count: number; results: GosiIssue[] }>("/compliance/gosi", query),
  invoice: (month: string) => api.get<{ month: string; read: boolean; rows: InvoiceRow[]; totals: { payroll: string; invoice: string; difference: string } }>("/compliance/gosi/invoice", { month }),
  contributions: (month: string) => api.get<{ month: string; rows: ContributionRow[]; totals: Omit<ContributionRow, "establishment"> }>("/compliance/gosi/contributions", { month }),
  exportContributions: (month: string) => api.download("/compliance/gosi/contributions", { month, export: "xlsx" }),
};

// --- task 8: Mudad / WPS tracking -------------------------------------------------------------------------------
export type WpsStatus = "upcoming" | "due" | "uploaded" | "late" | "no_payroll";
export type WpsResult = "" | "accepted" | "partial" | "rejected";
export type WpsMonthRow = {
  establishment: number;
  number: string;
  month: string;
  deadline: string | null;
  threshold: string | null;
  files: number;
  sent: number;
  mudad_status: string;
  row: number | null;
  uploaded_on: string | null;
  mudad_reference: string;
  result: WpsResult;
  mudad_percent: string | null;
  note: string;
  expected: number;
  paid: number;
  our_percent: string | null;
  status: WpsStatus;
  below: boolean;
};

export const wpsApi = {
  grid: (months = 12) => api.get<{ today: string; rows: WpsMonthRow[] }>("/compliance/wps", { months }),
  record: (establishment: number, month: string, body: { uploaded_on?: string | null; mudad_reference?: string; result?: WpsResult; mudad_percent?: string | null; note?: string }) =>
    api.request<WpsMonthRow>(`/compliance/wps/${establishment}/${month}`, { method: "PUT", body }),
};

// --- task 9: Muqeem visas ----------------------------------------------------------------------------------------
export type VisaKind = "exit_reentry_single" | "exit_reentry_multiple" | "final_exit";
export type VisaStatus = "requested" | "issued" | "used" | "returned" | "cancelled" | "expired";
export type Visa = {
  id: number;
  employee: number;
  employee_info: { id: number; employee_no: string; name_ar: string; name_en: string };
  kind: VisaKind;
  number: string;
  issued_on: string | null;
  valid_until: string | null;
  valid_until_hijri: string | null;
  return_by: string | null;
  return_by_hijri: string | null;
  duration_days: number | null;
  fee: string | null;
  status: VisaStatus;
  status_text: string;
  note: string;
};

export const visasApi = {
  list: (query: { status?: string; kind?: string; search?: string; page?: number }) => api.get<{ count: number; results: Visa[] }>("/compliance/visas", query),
};

// --- task 10: the exit re-entry request and the offboarding's government steps ------------------------------------
export type ExitReentryKind = "exit_reentry_single" | "exit_reentry_multiple";
export type ExitReentryBody = { kind: ExitReentryKind; leave_on: string; back_on: string; dependents: number[]; leave_request?: number | null; reason: string; pay_via: "payroll" | "direct"; consent: boolean };
export type FeeDetail = { months?: number; travellers?: number; covered_months?: number | null; base?: string; extra_month?: string | null; extra_months?: number; each?: string; charged?: string };
export type ExitReentryRequest = ExitReentryBody & {
  id: number;
  employee: number;
  employee_info: { id: number; employee_no: string; name_ar: string; name_en: string } | null;
  payer: "" | "company" | "employee";
  fee: string | null;
  fee_detail: FeeDetail;
  visa: { id: number; kind: string; number: string; issued_on: string | null; valid_until: string | null; return_by: string | null; fee: string | null; status: VisaStatus } | null;
  charged_month: string | null;
  paid_on: string | null;
  warnings: string[];
  status: string;
  submitted_at: string | null;
  decided_at: string | null;
  workflow_id: number | null;
};
export type ExitReentryPreview = { payer: "" | "company" | "employee"; fee: string | null; fee_detail: FeeDetail; errors: Record<string, string[]> };
export type OffboardingGovernment = { applies: boolean; transfer_of_service: boolean; iqama_cancelled: boolean; note: string; warnings: string[] };

export const exitReentryApi = {
  get: (id: number) => api.get<ExitReentryRequest>(`/exit-reentry-requests/${id}`),
  list: (query: { to_issue?: "1"; mine?: "1"; status?: string; page?: number }) => api.get<{ count: number; results: ExitReentryRequest[] }>("/exit-reentry-requests", query),
  preview: (body: ExitReentryBody, editId?: number) => api.post<ExitReentryPreview>(`/exit-reentry-requests/preview${editId ? `?id=${editId}` : ""}`, body),
  create: (body: ExitReentryBody) => api.post<ExitReentryRequest>("/exit-reentry-requests", body),
  update: (id: number, body: ExitReentryBody) => api.patch<ExitReentryRequest>(`/exit-reentry-requests/${id}`, body),
  resubmit: (id: number) => api.post<ExitReentryRequest>(`/exit-reentry-requests/${id}/submit`, {}),
  issue: (id: number, values: { number: string; issued_on: string; valid_until: string; return_by: string; fee: string }, file: File | null) => {
    const body = new FormData();
    Object.entries(values).forEach(([key, value]) => value && body.append(key, value));
    if (file) body.append("file", file);
    return api.post<ExitReentryRequest>(`/exit-reentry-requests/${id}/issue`, body);
  },
  paid: (id: number, paid_on: string) => api.post<ExitReentryRequest>(`/exit-reentry-requests/${id}/paid`, { paid_on }),
  government: (offboarding: number) => api.get<OffboardingGovernment>(`/compliance/offboardings/${offboarding}/government`),
  saveGovernment: (offboarding: number, body: Partial<OffboardingGovernment>) =>
    api.request<OffboardingGovernment>(`/compliance/offboardings/${offboarding}/government`, { method: "PUT", body }),
};

// --- task 11: iqama and work-permit renewals ---------------------------------------------------------------------
export type RenewalStatus = "upcoming" | "due" | "overdue" | "paid" | "renewed" | "not_renewing";
export type RenewalFees = { levy: string | null; iqama: string | null; dependents: string | null; dependents_count: number; dependents_paid_by: "employee" | "company"; exemption: "" | "small_establishment" | "industrial"; condition: string; company_total: string; missing: string[] };
export type RenewalRow = { id: number; employee: { id: number; employee_no: string; name_ar: string; name_en: string }; establishment: string; due_on: string; months: number; status: RenewalStatus; paid_on: string | null; amount_paid: string | null; note: string; fees: RenewalFees };
export type ForecastCell = { establishment: string; month: string; renewals: number; levy: string; iqama: string; dependents: string; company_total: string };
export type ForecastLine = RenewalFees & { employee: RenewalRow["employee"]; establishment: string; due_on: string; month: string };

export const renewalsApi = {
  schedule: (status?: string) => api.get<{ counts: Partial<Record<RenewalStatus, number>>; rows: RenewalRow[] }>("/compliance/renewals", status ? { status } : undefined),
  act: (id: number, body: { action: "paid" | "not_renewing" | "reopen"; paid_on?: string; amount_paid?: string; note?: string }) => api.post<RenewalRow>(`/compliance/renewals/${id}`, body),
  forecast: (months = 12) => api.get<{ first: string; months: number; period: number; rows: ForecastCell[]; lines: ForecastLine[]; totals: { levy: string; iqama: string; dependents: string; company_total: string; renewals: number } }>("/compliance/renewals/forecast", { months }),
  exportForecast: (months = 12) => api.download("/compliance/renewals/forecast", { months, export: "xlsx" }),
};

// --- task 12: the compliance dashboard and report --------------------------------------------------------------
export type Severity = "critical" | "high" | "medium" | "low";
export type ComplianceArea = "nitaqat" | "documents" | "visas" | "wps" | "gosi" | "qiwa" | "missing" | "integrations";
export type RiskRow = { establishment: { id: number; number: string; is_main: boolean }; score: number; band: "low" | "medium" | "high"; counts: Partial<Record<Severity, number>>; trend: { day: string; score: number }[] };
export type ComplianceItem = {
  id: number;
  area: ComplianceArea;
  code: string;
  severity: Severity;
  title: string;
  establishment: number | null;
  employee: { id: number; employee_no: string; name_ar: string; name_en: string } | null;
  /** about a person the user may not see */
  hidden: boolean;
  first_seen: string;
  age: number;
  resolved_on: string | null;
  escalated: boolean;
};

export const riskApi = {
  overview: () => api.get<{ establishments: RiskRow[]; areas: Partial<Record<ComplianceArea, number>>; severities: Partial<Record<Severity, number>>; checked_on: string | null }>("/compliance/overview"),
  runNow: () => api.post<{ establishments: RiskRow[]; areas: Partial<Record<ComplianceArea, number>>; severities: Partial<Record<Severity, number>>; checked_on: string | null }>("/compliance/overview", {}),
  items: (query: { area?: string; severity?: string; establishment?: number; resolved?: "1"; search?: string; page?: number }) => api.get<{ count: number; results: ComplianceItem[] }>("/compliance/items", query),
  exportItems: (query: { area?: string; severity?: string; resolved?: "1" }) => api.download("/compliance/items", { ...query, export: "xlsx" }),
};
