/** Payroll (Phase 4). Task 1: the payroll rules (apps/payroll/views.py PayrollSettingsView) and the Labor Law's payroll
 * numbers (/labor-settings). */

import { api, type ExportFormat } from "./index";

/** The Labor Law's payroll numbers in LaborSettings (apps/core/labor.py), shown on the payroll settings. */
export const PAYROLL_LABOR = [
  "deduction_cap_percent",
  "advance_recovery_cap_percent",
  "fine_max_days",
  "fines_max_days_month",
  "suspension_max_days_month",
  "eosb_first_years",
  "eosb_first_rate",
  "eosb_later_rate",
  "resignation_no_award_years",
  "resignation_third_until_years",
  "resignation_two_thirds_until_years",
  "full_award_after_marriage_months",
  "full_award_after_childbirth_months",
  "unfair_termination_days_per_year",
  "unfair_termination_min_months",
  "overtime_premium_percent",
  "employer_notice_days",
  "employee_notice_days",
  "gosi_wage_cap",
  "gosi_wage_floor",
  "gosi_housing_in_kind_months",
  "discipline_charge_days",
  "resignation_accept_days",
  "resignation_postpone_days",
  "resignation_withdraw_days",
  "settlement_due_days_employer",
  "settlement_due_days_worker",
] as const;

export type SettingsValue = string | number | boolean | null;
export type SettingsTableData = { account: Record<string, SettingsValue>; company: Record<string, SettingsValue>; effective: Record<string, SettingsValue> };

export const payroll = {
  settings: () => api.get<SettingsTableData>("/payroll-settings"),
  saveSettings: (level: "account" | "company", values: Record<string, SettingsValue>) => api.patch<SettingsTableData>("/payroll-settings", { level, ...values }),
};

// --- task 3: components, structures, an employee's pay ----------------------------------------

export type ComponentKind = "earning" | "deduction" | "employer_cost";
export type ComponentMethod = "contract" | "fixed" | "percent" | "formula" | "attendance" | "monthly_input" | "system";
export type PackageField = "basic_salary" | "housing_allowance" | "transport_allowance" | "other_allowances";
export type PayComponent = {
  id: number;
  code: string;
  name_ar: string;
  name_en: string;
  kind: ComponentKind;
  method: ComponentMethod;
  contract_field: PackageField | "";
  percent: string | null;
  percent_of: number | null;
  formula: string;
  in_gosi_wage: boolean;
  in_eosb_wage: boolean;
  in_daily_wage: boolean;
  prorated: boolean;
  on_payslip: boolean;
  taxable_abroad: boolean;
  gl_account: string;
  order: number;
  is_active: boolean;
  is_system: boolean;
};
export type ComponentInput = Omit<PayComponent, "id" | "is_system">;
export type StructureLine = { component: number; amount: string | null; formula: string };
export type SalaryStructure = { id: number; name_ar: string; name_en: string; description: string; is_default: boolean; is_active: boolean; grades: number[]; lines: StructureLine[] };
export type FormulaCheck = { ok: true; value: string; sample: boolean } | { ok: false; error: string; column: number | null };
export type FormulaNames = { variables: { name: string; label: string }[]; components: { code: string; name_ar: string; name_en: string }[]; functions: string[] };
export type PayLine = { code: string; name_ar: string; name_en: string; kind: ComponentKind; amount: string; how: "package" | "structure" | "employee" | "percent" | "formula"; formula: string };
export type PayPart = { start: string; end: string; currency: string; structure_source: "employee" | "grade" | "default"; structure: { id: number; name_ar: string; name_en: string } | null; lines: PayLine[]; errors: string[] };
export type CalcStep = { rule: "full" | "prorated" | "not_prorated" | "leave_cut" | "advance_paid" | "advance_recovered" | "absence" | "time_lost" | "overtime" | "gosi" | "additional" | "expense" | "installment" | "fine" | "suspension" | "carried" | "negative_net"; expr: string; amount: string; values: Record<string, unknown>; sources: Record<string, number>[] };
export type CalcLine = { code: string; kind: ComponentKind; name_ar: string; name_en: string; on_payslip: boolean; amount: string; steps: CalcStep[] };
/** The payroll engine's month for one employee (Phase 4 task 4): period, prorated lines with their trace, totals. */
export type PayCalculation = {
  period: { start: string | null; end: string | null };
  month_days: number;
  paid_days: string;
  calendar_days: number;
  unpaid: { start: string; end: string; reason: "suspension"; source: Record<string, number> }[];
  currency: string;
  daily_wage: string;
  hourly_wage: string | null;
  gosi_wage: string | null;
  lines: CalcLine[];
  gross: string;
  deductions: string;
  employer_cost: string;
  net: string;
  notes: string[];
  proposals: Proposal[];
  wage_due: string | null;
  carried: { code: string; amount: string; reason: "art66_fines" | "art92_advance" | "art92_total" | "negative_net"; sources: Record<string, number>[] }[];
};
export type EmployeePay = { employee: number; month: string; structure_set: number | null; parts: PayPart[]; calculation: PayCalculation };
export type EmployeeComponent = { id: number; employee: number; component: number; amount: string; start_date: string; end_date: string | null; note: string };

export const components = {
  list: () => api.get<PayComponent[]>("/pay-components"),
  save: (body: Partial<ComponentInput>, id?: number) => (id ? api.patch<PayComponent>(`/pay-components/${id}`, body) : api.post<PayComponent>("/pay-components", body)),
  remove: (id: number) => api.del(`/pay-components/${id}`),
  check: (formula: string, employee?: number) => api.post<FormulaCheck>("/pay-components/check", { formula, ...(employee ? { employee } : {}) }),
  names: () => api.get<FormulaNames>("/pay-components/variables"),
};

export const structures = {
  list: () => api.get<SalaryStructure[]>("/salary-structures"),
  save: (body: Omit<SalaryStructure, "id">, id?: number) => (id ? api.patch<SalaryStructure>(`/salary-structures/${id}`, body) : api.post<SalaryStructure>("/salary-structures", body)),
  remove: (id: number) => api.del(`/salary-structures/${id}`),
};

export const employeePay = {
  get: (employee: number, month: string) => api.get<EmployeePay>(`/employee-pay/${employee}`, { month }),
  setStructure: (employee: number, structure: number | null) => api.patch<EmployeePay>(`/employee-pay/${employee}`, { structure }),
  components: (employee: number) => api.get<EmployeeComponent[]>("/employee-components", { employee }),
  addComponent: (body: Omit<EmployeeComponent, "id">) => api.post<EmployeeComponent>("/employee-components", body),
  removeComponent: (id: number) => api.del(`/employee-components/${id}`),
};

// --- task 6: the attendance penalty table ---------------------------------------------------------
export type PenaltyType = "warning" | "percent" | "days" | "days_or_hold" | "dismissal_award" | "dismissal_art80";
export type Penalty = { type: PenaltyType; value?: number };
export type PenaltyRuleRow = {
  id: number;
  number: number;
  kind: "late" | "early_leave" | "absence";
  min_value: number;
  max_value: number | null;
  delays_others: boolean;
  penalties: Penalty[];
  deduct_time: boolean;
  source: string;
};
export type PenaltyTable = { level: "company" | "account"; can_change_account: boolean; rows: PenaltyRuleRow[] };
export type Proposal = { kind: PenaltyRuleRow["kind"]; date: string; value: number; rule: number; occurrence: number; penalty: Penalty; amount: string | null };

export const penalties = {
  table: () => api.get<PenaltyTable>("/attendance-penalties"),
  copy: () => api.post<PenaltyTable>("/attendance-penalties", { action: "copy" }),
  reset: () => api.post<PenaltyTable>("/attendance-penalties", { action: "reset" }),
  save: (id: number, body: Partial<Omit<PenaltyRuleRow, "id" | "number" | "kind" | "source">>) => api.patch<PenaltyRuleRow>(`/attendance-penalties/${id}`, body),
};

// --- task 7: GOSI --------------------------------------------------------------------------------------
export type GosiBranch = "annuities" | "saned" | "hazards";
export type GosiRateRow = { id: number; branch: GosiBranch; saudi: boolean; registered_from: string | null; registered_until: string | null; effective_from: string; employee_percent: string; employer_percent: string; source: string };
export type GosiWageRow = { id: number; effective_from: string; wage: string; note: string };
export type EmployeeGosi = {
  first_registered: string | null;
  registered_on: string | null;
  gosi_number: string;
  exemption: "" | "gcc" | "other";
  housing_in_kind: boolean;
  note: string;
  saudi: boolean;
  gcc: boolean;
  cohort: "old" | "new";
  wages: GosiWageRow[];
  rates: { branch: GosiBranch; employee_percent: string; employer_percent: string }[];
};

export const gosi = {
  rates: () => api.get<{ can_change: boolean; rows: GosiRateRow[] }>("/gosi-rates"),
  saveRate: (id: number, body: Partial<GosiRateRow>) => api.patch<GosiRateRow>(`/gosi-rates/${id}`, body),
  employee: (id: number) => api.get<EmployeeGosi>(`/employee-gosi/${id}`),
  saveEmployee: (id: number, body: Partial<EmployeeGosi>) => api.patch<EmployeeGosi>(`/employee-gosi/${id}`, body),
  addWage: (id: number, body: Omit<GosiWageRow, "id">) => api.post<EmployeeGosi>(`/employee-gosi/${id}`, body),
  removeWage: (id: number, wage: number) => api.del(`/employee-gosi/${id}?wage=${wage}`),
};

// --- task 8: additional salaries (#96) ---------------------------------------------------------------
export type AdditionalSalary = {
  id: number;
  employee: number;
  component: number;
  month: string; // YYYY-MM
  amount: string;
  note: string;
  employee_info: { employee_no: string; name_ar: string; name_en: string };
  component_info: { code: string; name_ar: string; name_en: string; kind: ComponentKind; in_gosi_wage: boolean; in_eosb_wage: boolean };
};
export type AdditionalInput = Pick<AdditionalSalary, "employee" | "component" | "month" | "amount" | "note">;

export const additional = {
  list: (month: string) => api.get<AdditionalSalary[]>("/additional-salaries", { month }),
  save: (body: AdditionalInput, id?: number) => (id ? api.patch<AdditionalSalary>(`/additional-salaries/${id}`, body) : api.post<AdditionalSalary>("/additional-salaries", body)),
  remove: (id: number) => api.del(`/additional-salaries/${id}`),
};

// --- task 9: advances (#34, #58, #99) ------------------------------------------------------------------
export type AdvanceInstallment = { id: number; month: string; amount: string; status: "due" | "deducted" | "settled"; note: string };
export type Advance = {
  id: number;
  employee: number;
  amount: string;
  reason: string;
  source: "request" | "import" | "manual";
  request: number | null;
  paid_on: string | null;
  settled_on: string | null;
  created_at: string;
  installments: AdvanceInstallment[];
  balance: string;
  employee_info: { employee_no: string; name_ar: string; name_en: string };
};
export type AdvancePreview = { installment: string | null; wage: string; max_amount: string; max_installments: number; max_installment: string; has_open: boolean; errors: Record<string, string[]> };
export type AdvanceRequestInput = { amount: string; installments: number; first_month: string; reason: string };
export type AdvanceChangeInput = { advance: number; kind: "postpone" | "settle_cash" | "settle_payroll"; month: string; reason: string };

export const advances = {
  list: (employee: number) => api.get<Advance[]>("/advances", { employee }),
  mine: () => api.get<Advance[]>("/advances/mine"),
  create: (body: { employee: number; amount: string; installments: number; first_month: string; reason: string; paid_on: string | null }) => api.post<Advance>("/advances", body),
  pay: (id: number, paid_on: string) => api.post<Advance>(`/advances/${id}/pay`, { paid_on }),
  postpone: (id: number, month: string) => api.post<Advance>(`/advances/${id}/postpone`, { month }),
  settle: (id: number, how: "cash" | "salary", month?: string) => api.post<Advance>(`/advances/${id}/settle`, { how, month }),
  remove: (id: number) => api.del(`/advances/${id}`),
  preview: (body: AdvanceRequestInput, editId?: number) => api.post<AdvancePreview>(`/advance-requests/preview${editId ? `?id=${editId}` : ""}`, body),
  request: (id: number) => api.get<AdvanceRequestInput & { id: number }>(`/advance-requests/${id}`),
  ask: (body: AdvanceRequestInput) => api.post("/advance-requests", body),
  correct: (id: number, body: AdvanceRequestInput) => api.patch(`/advance-requests/${id}`, body),
  resubmit: (id: number) => api.post(`/advance-requests/${id}/submit`, {}),
  change: (id: number) => api.get<AdvanceChangeInput & { id: number }>(`/advance-change-requests/${id}`),
  askChange: (body: AdvanceChangeInput) => api.post("/advance-change-requests", body),
  correctChange: (id: number, body: AdvanceChangeInput) => api.patch(`/advance-change-requests/${id}`, body),
  resubmitChange: (id: number) => api.post(`/advance-change-requests/${id}/submit`, {}),
};

// --- task 11/12: payroll runs (#89, #97, #98) ----------------------------------------------------------
export type RunStage = "draft" | "calculating" | "calculated" | "in_review" | "locked" | "paid";
export type PayrollBatch = { id: number; name: string; payment_date: string | null; paid_on: string | null; headcount: number; net: string };
export type PayrollRun = {
  id: number;
  month: string;
  currency: string;
  branch: number | null;
  kind: "regular" | "final_settlement";
  employee: number | null;
  employee_info: { id: number; employee_no: string; name_ar: string; name_en: string } | null;
  options: SettlementOptions | null;
  note: string;
  stage: RunStage;
  status: string;
  in_review: boolean;
  editable: boolean;
  calculated_at: string | null;
  locked_at: string | null;
  problems: string[];
  totals: { headcount?: number; held?: number; gross?: string; deductions?: string; net?: string; employer_cost?: string; gosi_employer?: string };
  batches: PayrollBatch[];
  workflow_id: number | null;
  payslips: number;
};
export type PayrollRow = {
  id: number;
  employee: number;
  employee_info: { employee_no: string; name_ar: string; name_en: string; branch: string };
  batch: number | null;
  basic: string;
  allowances: string;
  gross: string;
  deductions: string;
  net: string;
  employer_cost: string;
  hold: boolean;
  leaving: boolean;
  warnings: string[];
};
type Paged<T> = { count: number; results: T[] };

/** What HR states for a final settlement (task 19): Art. 87, Art. 77, Art. 76. */
export type SettlementOptions = { full_award: "" | "marriage" | "childbirth" | "force_majeure"; event_date: string | null; unfair: boolean; notice_days: number; notice_by: "employer" | "employee" };
/** A final settlement row's extra part of the calculation. */
export type Settlement = {
  last_day: string;
  reason: string;
  hire_date: string;
  due_by: string;
  eosb: Omit<Eosb, "employee" | "hire_date" | "last_day" | "reason">;
  encashment: Omit<LeaveEncashment, "employee" | "last_day">;
  clearance: string[];
};

export const runs = {
  list: (month: string) => api.get<Paged<PayrollRun>>("/payroll-runs", { month }),
  get: (id: number) => api.get<PayrollRun>(`/payroll-runs/${id}`),
  create: (body: { month: string; currency: string; branch?: number | null }) => api.post<PayrollRun>("/payroll-runs", body),
  settle: (employee: number, options: SettlementOptions) => api.post<PayrollRun>("/payroll-runs", { kind: "final_settlement", employee, options }),
  remove: (id: number) => api.del(`/payroll-runs/${id}`),
  calculate: (id: number, employees?: number[]) => api.post<PayrollRun>(`/payroll-runs/${id}/calculate`, { employees }),
  submit: (id: number) => api.post<PayrollRun>(`/payroll-runs/${id}/submit`, {}),
  rows: (id: number, search: string, page: number) => api.get<Paged<PayrollRow>>(`/payroll-runs/${id}/rows`, { search: search || undefined, page }),
  row: (id: number, rowId: number) => api.get<PayrollRow & { result: PayCalculation & { settlement?: Settlement } }>(`/payroll-runs/${id}/rows/${rowId}`),
  hold: (id: number, row: number, hold: boolean) => api.post<PayrollRun>(`/payroll-runs/${id}/hold`, { row, hold }),
  split: (id: number, by: "branch" | "bank" | "single") => api.post<PayrollRun>(`/payroll-runs/${id}/batches`, { by }),
  saveBatch: (id: number, batch: number, body: { name?: string; payment_date?: string | null }) => api.patch<PayrollBatch>(`/payroll-runs/${id}/batches/${batch}`, body),
  paid: (id: number, batch: number, paid_on: string) => api.post<PayrollRun>(`/payroll-runs/${id}/batches/${batch}/paid`, { paid_on }),
};

// --- task 13: payslips (#66, #90) ---------------------------------------------------------------------
export type Payslip = { id: number; employee: number; employee_info: { employee_no: string; name_ar: string; name_en: string }; month: string; net: string; currency: string; file_name: string; published_at: string };

export const payslips = {
  mine: () => api.get<Payslip[]>("/payslips/mine"),
  of: (employee: number) => api.get<Payslip[]>("/payslips", { employee }),
  link: (id: number) => api.get<{ url: string; expires_in: number }>(`/payslips/${id}/download`),
  publish: (run: number) => api.post<PayrollRun>(`/payroll-runs/${run}/publish`, {}),
};

// --- task 14: wage files (#93, #102) and the payroll account -------------------------------------------
export type PayrollAccount = { bank: number; iban: string; bank_customer_id: string };
export type WageFile = { id: number; batch: number | null; format: string; format_name: string; reference: string; file_name: string; total: string; count: number; value_date: string; created_at: string; mudad_reference: string; mudad_status: string; mudad_message: string; sent_at: string | null; skipped: string[] };
export type FileFormatOption = { code: string; name: string; ready?: boolean };

export const wageFiles = {
  account: () => api.get<PayrollAccount | null>("/payroll-account"),
  saveAccount: (body: PayrollAccount) => api.request<PayrollAccount>("/payroll-account", { method: "PUT", body }),
  formats: () => api.get<FileFormatOption[]>("/payroll-runs/file-formats"),
  list: (run: number) => api.get<WageFile[]>(`/payroll-runs/${run}/files`),
  make: (run: number, body: { format: string; batch?: number | null; value_date?: string; language?: "ar" | "en"; skip_invalid?: boolean }) => api.post<WageFile>(`/payroll-runs/${run}/files`, body),
  link: (run: number, file: number) => api.get<{ url: string; expires_in: number }>(`/payroll-runs/${run}/files/${file}/download`),
  mudad: (run: number, file: number, refresh = false) => api.post<WageFile>(`/payroll-runs/${run}/files/${file}/mudad`, { refresh }),
};

// --- task 17: end-of-service award (#92) ------------------------------------------------------------------
export type EosbQuery = { last_day?: string; reason?: string; full_award?: "" | "marriage" | "childbirth" | "force_majeure"; event_date?: string; unfair?: boolean; notice_unserved_days?: number };
export type Eosb = {
  employee: number;
  hire_date: string;
  last_day: string;
  reason: string;
  service: { years: number; months: number; days: number; in_years: string; excluded_days: number };
  wage: string;
  full_award: string;
  fraction: string;
  fraction_rule: "art84" | "art85" | "art87" | "art80" | "art54" | "never_started";
  award: string;
  compensation: string | null;
  notice_pay: string;
  steps: { rule: string; expr: string; amount: string }[];
  notes: string[];
};

export const eosb = {
  of: (employee: number, query: EosbQuery) =>
    api.get<Eosb>(`/eosb/${employee}`, { ...query, unfair: query.unfair || undefined, notice_unserved_days: query.notice_unserved_days || undefined }),
};

// --- task 18: leave encashment at exit (#69, Art. 111) -------------------------------------------------------
export type LeaveEncashment = {
  employee: number;
  last_day: string;
  daily_wage: string;
  days: string;
  amount: string;
  lines: { leave_type: number; code: string; name_ar: string; name_en: string; days: string; amount: string; expr: string }[];
  notes: string[];
};

export const encashment = {
  of: (employee: number, lastDay?: string) => api.get<LeaveEncashment>(`/leave-encashment/${employee}`, { last_day: lastDay }),
};

// --- task 20: cost centers and the journal (#103, #104, #12) ---------------------------------------------------
export type CostCenter = { id: number; code: string; name_ar: string; name_en: string; is_active: boolean };
export type AllocationRow = { cost_center: number; percent: string };
export type Allocations = Record<"employee" | "department" | "branch", Record<string, AllocationRow[]>>;
export type JournalSettings = { erp_company: string; payable_account: string; gosi_payable_account: string; expense_account: string; deduction_account: string; cost_center: number | null; party_per_employee: boolean };
export type JournalFile = { id: number; format: string; posting_date: string; file_name: string; total: string; lines: number; created_at: string };
export type JournalPreview = {
  lines: { account: string; cost_center: string; party: string; debit: string; credit: string }[];
  debit: string;
  credit: string;
  problems: string[];
  formats: string[];
  files: JournalFile[];
};

export const accounting = {
  centers: () => api.get<CostCenter[]>("/cost-centers"),
  saveCenter: (body: Partial<CostCenter>, id?: number) => (id ? api.patch<CostCenter>(`/cost-centers/${id}`, body) : api.post<CostCenter>("/cost-centers", body)),
  removeCenter: (id: number) => api.del(`/cost-centers/${id}`),
  allocations: () => api.get<Allocations>("/cost-allocations"),
  allocate: (target: "employee" | "department" | "branch", id: number, rows: { cost_center: number; percent: number | string }[]) => api.request<Allocations>("/cost-allocations", { method: "PUT", body: { target, id, rows } }),
  settings: () => api.get<JournalSettings | null>("/journal-settings"),
  saveSettings: (body: JournalSettings) => api.request<JournalSettings>("/journal-settings", { method: "PUT", body }),
  journal: (run: number) => api.get<JournalPreview>(`/payroll-runs/${run}/journal`),
  makeJournal: (run: number, body: { format: string; posting_date: string }) => api.post<JournalFile>(`/payroll-runs/${run}/journal`, body),
  journalLink: (run: number, id: number) => api.get<{ url: string; expires_in: number }>(`/payroll-runs/${run}/journal/${id}/download`),
};

// --- task 21: payroll reports (#133, #135) ------------------------------------------------------------------
export type PayrollReportKind = "register" | "cost" | "gosi" | "variance" | "outstanding" | "provision" | "settlements";
export const PAYROLL_REPORTS: PayrollReportKind[] = ["register", "cost", "gosi", "variance", "outstanding", "provision", "settlements"];
export type PayrollReportQuery = { month: string; by?: "department" | "branch" | "cost_center"; search?: string };
export type PayrollReport = {
  kind: PayrollReportKind;
  title: string;
  month: string;
  monthly: boolean;
  columns: { key: string; label: string; kind: "text" | "date" | "number" | "money" }[];
  rows: Record<string, string | number | null>[];
  totals: Record<string, string>;
};

export const payrollReports = {
  get: (kind: PayrollReportKind, query: PayrollReportQuery) => api.get<PayrollReport>(`/payroll-reports/${kind}`, query),
  export: (kind: PayrollReportKind, query: PayrollReportQuery, as: ExportFormat = "xlsx") => api.download(`/payroll-reports/${kind}`, { ...query, export: as }),
};
