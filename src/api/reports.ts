/** Reports (Phase 6): the HR dashboard (task 15). Shapes follow apps/reports/dashboard.py. Decimals as strings. */

import { api, type ExportFormat, type Page } from "./index";

export type DashboardPeriod = "default" | "today" | "d7" | "d30" | "m3";
export type NitaqatBand = "platinum" | "high_green" | "medium_green" | "low_green" | "red" | "";
/** Money is null when masked (a small group, or no salary access over all of it). */
export type PayrollCost = { currency: string; masked: boolean; employees: string | null; total: string | null };

export type HrDashboard = {
  /** months: what the monthly figures (leave, permission hours, payroll cost) cover — whole months. */
  period: { key: DashboardPeriod; first: string; last: string; months: { first: string; last: string } };
  company_wide: boolean;
  hires: { first: string; last: string; months: { month: string; count: number }[] };
  leave: {
    utilisation: string | null;
    taken: string;
    earned: string;
    permission_hours: string;
    average_daily_hours: string | null;
    used_full_balance: string | null;
    peak: { month: string; hours: string } | null;
  };
  workforce: {
    active: number;
    payroll_cost: PayrollCost[];
    nitaqat: { percent: string | null; band: NitaqatBand; day: string; number: string } | null;
    iqamas_expiring: number;
    iqama_days: number;
  };
  turnover: {
    turnover: string | null;
    retention: string | null;
    separations: number;
    voluntary: number;
    hires: number;
    points: { start: string; end: string; turnover: string | null; retention: string | null }[];
  };
};

export const reportsApi = {
  hrDashboard: (period: DashboardPeriod) => api.get<HrDashboard>("/reports/hr-dashboard", { period }),
};

// --- task 16: the leadership dashboard ---------------------------------------------------------------------------

export type LeadershipRow = {
  active: number;
  headcount_start: number;
  stayed: number;
  hires: number;
  separations: number;
  voluntary: number;
  turnover: string | null;
  retention: string | null;
  saudis: number;
  nitaqat: { percent: string | null; band: NitaqatBand; day: string; number: string } | null;
  payroll_cost: PayrollCost[];
};
/** A branch row with id null: the employees with no branch. Branches with nobody in the period are left out. */
export type LeadershipCompany = LeadershipRow & { id: number; name_ar: string; name_en: string; hidden_branches: number; branches: (LeadershipRow & { id: number | null; name_ar: string; name_en: string })[] };
export type Leadership = { period: HrDashboard["period"]; companies: LeadershipCompany[]; totals: LeadershipRow };

export const leadershipApi = {
  get: (period: DashboardPeriod) => api.get<Leadership>("/reports/leadership", { period }),
};

// --- task 17: export and scheduled reports ---------------------------------------------------------------------

export type CatalogEntry = { code: string; title: string; group: string; options: Record<string, { value: string; label: string }[]> };
export type Frequency = "daily" | "weekly" | "monthly";
export type ScheduleBody = { name: string; report: string; params: Record<string, string>; format: ExportFormat; frequency: Frequency; weekday: number; day_of_month: number; recipients: number[]; is_active: boolean };
export type Schedule = ScheduleBody & {
  id: number;
  last_run_on: string | null;
  last_status: "" | "sent" | "no_access" | "failed";
  last_error: string;
  info: { report: string; recipients: { id: number; name_ar: string; name_en: string }[]; last_sent: string | null };
};
export type Recipient = { id: number; email: string; name_ar: string; name_en: string };

export const exportsApi = {
  catalog: () => api.get<CatalogEntry[]>("/reports/catalog"),
  run: (code: string, as: ExportFormat, params: Record<string, string> = {}) => api.download(`/reports/run/${code}`, { ...params, export: as }),
  file: (token: string) => api.download(`/report-files/${token}`),
};

export const schedulesApi = {
  list: () => api.get<Page<Schedule>>("/report-schedules", { page_size: 100 }),
  save: (body: ScheduleBody & { id?: number }) => (body.id ? api.patch<Schedule>(`/report-schedules/${body.id}`, body) : api.post<Schedule>("/report-schedules", body)),
  remove: (id: number) => api.del(`/report-schedules/${id}`),
  runNow: (id: number) => api.post<{ deliveries: { recipient: string; status: string; rows: number }[] }>(`/report-schedules/${id}/run-now`, {}),
  recipients: (report: string) => api.get<Recipient[]>("/report-schedules/recipients", { report }),
};

// --- task 18: the custom report builder ---------------------------------------------------------------------------

export type FieldKind = "text" | "number" | "money" | "date" | "choice" | "bool";
export type BuilderField = { key: string; label: string; kind: FieldKind; group: "" | "personal" | "salary" | "bank"; ops: string[]; choices: { value: string; label: string }[] };
export type BuilderDataset = { code: string; title: string; fields: BuilderField[] };
export type BuilderFilter = { field: string; op: string; value: string | string[] | boolean | number };
export type Aggregate = { fn: "count" | "sum" | "avg" | "min" | "max"; field: string };
export type Definition = { dataset: string; columns: string[]; filters: BuilderFilter[]; group_by: string[]; aggregates: Aggregate[] };
export type BuilderResult = { columns: { key: string; label: string; kind: FieldKind }[]; rows: Record<string, string | number | boolean | null>[]; truncated: boolean; suppressed: number };
export type SavedReport = { id: number; name: string; definition: Definition; code: string; updated_at: string };

export const builderApi = {
  datasets: () => api.get<{ datasets: BuilderDataset[]; limits: Record<string, number>; preview_rows: number; min_group: number }>("/report-builder/datasets"),
  preview: (definition: Definition) => api.post<BuilderResult>("/report-builder/preview", { definition }),
  saved: () => api.get<Page<SavedReport>>("/saved-reports", { page_size: 100 }),
  save: (body: { id?: number; name: string; definition: Definition }) => (body.id ? api.patch<SavedReport>(`/saved-reports/${body.id}`, body) : api.post<SavedReport>("/saved-reports", body)),
  remove: (id: number) => api.del(`/saved-reports/${id}`),
};
