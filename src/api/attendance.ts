/** Attendance (Phase 3). Task 1: working-hours labor settings, employee groups, Ramadan periods. Shapes follow
 * apps/attendance/views.py and apps/core/views.py (LaborSettingsView). */

import { api, type ExportFormat } from "./index";

type Person = { id: number; name_ar: string; name_en: string; employee_no: string };

export const WORKING_HOURS = [
  "max_daily_hours",
  "max_weekly_hours",
  "ramadan_daily_hours",
  "ramadan_weekly_hours",
  "max_continuous_work_hours",
  "min_break_minutes",
  "max_hours_at_workplace",
  "weekly_rest_hours",
  "overtime_premium_percent",
  "max_overtime_hours_year",
] as const;
export type LaborField = (typeof WORKING_HOURS)[number];
type Values = Record<string, string | number | null>;
export type LaborSettingsData = {
  account: Values;
  company: Values;
  effective: Values;
  sources: Record<string, { article: string; status: "checked" | "to_confirm" }>;
};

export type EmployeeGroup = { id: number; name_ar: string; name_en: string; description: string; members: Person[]; is_active: boolean };
export type RamadanPeriod = {
  id: number;
  hijri_year: number;
  start_date: string;
  end_date: string;
  start_date_hijri: string;
  end_date_hijri: string;
  days: number;
  dates_confirmed: boolean;
  applies_to: "everyone" | "groups";
  groups: number[];
  notes: string;
};

export const attendance = {
  labor: () => api.get<LaborSettingsData>("/labor-settings"),
  saveLabor: (level: "account" | "company", values: Values) => api.patch<LaborSettingsData>("/labor-settings", { level, ...values }),
  groups: () => api.get<EmployeeGroup[]>("/employee-groups"),
  saveGroup: (body: { name_ar: string; name_en: string; description: string; members: number[]; is_active: boolean }, id?: number) =>
    id ? api.patch<EmployeeGroup>(`/employee-groups/${id}`, body) : api.post<EmployeeGroup>("/employee-groups", body),
  deleteGroup: (id: number) => api.del(`/employee-groups/${id}`),
  ramadan: () => api.get<RamadanPeriod[]>("/ramadan-periods"),
  saveRamadan: (id: number, body: Partial<RamadanPeriod>) => api.patch<RamadanPeriod>(`/ramadan-periods/${id}`, body),
  generateRamadan: () => api.post<{ made: number; results: RamadanPeriod[] }>("/ramadan-periods/generate", {}),
};

// --- task 2: shifts and breaks -------------------------------------------------------------

export type ShiftKind = "fixed" | "night" | "split" | "flexible";
export type ShiftColor = "teal" | "sky" | "lavender" | "amber" | "orange" | "pink" | "green" | "navy";
export type Variant = "normal" | "ramadan";
export type Segment = { variant: Variant; order: number; start_time: string; end_time: string };
export type ShiftBreak = { kind: "lunch" | "short"; applies_to: "both" | Variant; start_time: string; end_time: string; minutes: number; paid: boolean };
export const RULES = ["late_grace_minutes", "early_leave_grace_minutes", "punch_before_minutes", "punch_after_minutes", "rounding_minutes", "rounding_direction", "half_day_minutes"] as const;
export type RuleField = (typeof RULES)[number];
/** The company's attendance rules: the shift rules and the repeat window (not set per shift). */
export const SETTINGS_RULES = [...RULES, "duplicate_window_seconds", "overtime_min_minutes", "max_accuracy_m", "selfie_required", "selfie_keep_days", "offline_after_minutes", "correction_days"] as const;
export type SettingsRuleField = (typeof SETTINGS_RULES)[number];
export type Rules = { [K in RuleField]: K extends "rounding_direction" ? string : number };
export type ShiftPlan = {
  segments: { start: string; end: string }[];
  breaks: { kind: string; start: string; end: string; minutes: number; paid: boolean }[];
  scheduled_minutes: number;
  span_minutes: number;
  longest_stretch: number;
  crosses_midnight: boolean;
  flexible: boolean;
};
export type ShiftSummary = { plans: Partial<Record<Variant, ShiftPlan | null>>; warnings: string[]; errors: Record<string, string[]> };
export type Shift = {
  id: number;
  code: string;
  name_ar: string;
  name_en: string;
  kind: ShiftKind;
  color: ShiftColor;
  is_active: boolean;
  flex_earliest_start: string | null;
  flex_latest_start: string | null;
  required_minutes: number | null;
  ramadan_required_minutes: number | null;
  segments: Segment[];
  breaks: ShiftBreak[];
  plans: Partial<Record<Variant, ShiftPlan | null>>;
  warnings: string[];
  rules: Rules;
} & { [K in RuleField]: (K extends "rounding_direction" ? string : number) | null };
export type ShiftInput = Omit<Shift, "id" | "plans" | "warnings" | "rules">;
type SettingsTable = { account: Record<string, string | number | boolean | null>; company: Record<string, string | number | boolean | null>; effective: Record<string, string | number | boolean> };

export const shifts = {
  list: (active = false) => api.get<Shift[]>("/shifts", active ? { active: 1 } : undefined),
  save: (body: Partial<ShiftInput>, id?: number) => (id ? api.patch<Shift>(`/shifts/${id}`, body) : api.post<Shift>("/shifts", body)),
  remove: (id: number) => api.del(`/shifts/${id}`),
  preview: (body: Partial<ShiftInput>) => api.post<ShiftSummary>("/shifts/preview", body),
  settings: () => api.get<SettingsTable>("/attendance-settings"),
  saveSettings: (level: "account" | "company", values: Record<string, string | number | boolean | null>) => api.patch<SettingsTable>("/attendance-settings", { level, ...values }),
};

// --- task 3: roster ------------------------------------------------------------------------

export type Rotation = { id: number; name_ar: string; name_en: string; is_active: boolean; days: { position: number; shift: number | null }[] };
export type AssignmentTarget = "employee" | "group" | "department" | "branch" | "company";
export type Assignment = {
  id: number;
  target: AssignmentTarget;
  employee: number | null;
  group: number | null;
  department: number | null;
  branch: number | null;
  shift: number | null;
  rotation: number | null;
  start_date: string;
  end_date: string | null;
  note: string;
  target_name: { ar: string; en: string };
  what: { kind: "shift" | "rotation"; name_ar: string; name_en: string };
};
export type RosterDay = { date: string; shift: number | null; off: boolean; source: string; why: string; ramadan: boolean; minutes: number; needs_ramadan_times: boolean };
export type RosterWeek = { start: string; minutes: number; limit_minutes: number; over: boolean; ramadan: boolean };
export type ShiftBrief = { id: number; code: string; name_ar: string; name_en: string; color: ShiftColor; kind: ShiftKind };
export type RosterData = {
  from: string;
  to: string;
  shifts: ShiftBrief[];
  rows: { employee: { id: number; name_ar: string; name_en: string; employee_no: string; department: string }; days: RosterDay[]; weeks: RosterWeek[] }[];
};

export const roster = {
  get: (query: { from: string; to: string; department?: number; group?: number; search?: string }) => api.get<RosterData>("/roster", query),
  mine: (from: string, to: string) => api.get<{ from: string; to: string; shifts: ShiftBrief[]; days: RosterDay[] }>("/roster/mine", { from, to }),
  assignments: (query: { on?: string; page?: number } = {}) => api.get<{ count: number; results: Assignment[] }>("/shift-assignments", query),
  assign: (body: Partial<Assignment>, id?: number) => (id ? api.patch<Assignment>(`/shift-assignments/${id}`, body) : api.post<Assignment>("/shift-assignments", body)),
  unassign: (id: number) => api.del(`/shift-assignments/${id}`),
  change: (body: { employee: number; date: string; shift: number | null; reason: string }) => api.post("/roster-overrides", body),
  overrides: (employee: number, from: string, to: string) => api.get<{ results: { id: number; date: string; shift: number | null; reason: string }[] }>("/roster-overrides", { employee, from, to }),
  removeChange: (id: number) => api.del(`/roster-overrides/${id}`),
  rotations: () => api.get<Rotation[]>("/rotations"),
  saveRotation: (body: Omit<Rotation, "id">, id?: number) => (id ? api.patch<Rotation>(`/rotations/${id}`, body) : api.post<Rotation>("/rotations", body)),
  removeRotation: (id: number) => api.del(`/rotations/${id}`),
};

// --- task 4: punches -----------------------------------------------------------------------

export type ConnectorKind = "biotime" | "biostar";
export type Connector = {
  id: number;
  name: string;
  kind: ConnectorKind;
  mode: "cloud" | "agent";
  branch: number | null;
  is_active: boolean;
  token_hint: string;
  last_seen_at: string | null;
  time_zone: string;
  people: number;
  unmapped: number;
  /** Task 9: read by the cloud. The password is write-only: `has_password` says whether one is kept. */
  base_url: string;
  username: string;
  password?: string;
  has_password: boolean;
  verify_tls: boolean;
  poll_minutes: number;
  /** BioStar only: the event codes that are punches ("4865, 4096-4111"); empty = every successful authentication. */
  event_codes: string;
  cursor_at: string | null;
  last_success_at: string | null;
  last_error: string;
  last_run: SyncRun | null;
  /** Task 11: what the on-site agent reported with its last batch. */
  agent_version: string;
  agent_queued: number;
  /** Task 12: the latest contact (the agent's batch or the cloud's read) and whether it is past the offline limit. */
  last_contact_at: string | null;
  offline: boolean;
};
export type SyncRunRow = SyncRun & { connector: { id: number; name: string; kind: ConnectorKind; mode: Connector["mode"] } };
export type Terminal = { terminal: string; last_punch_at: string; week: number };
export type AttendanceHealth = { connectors: number; last_sync_at: string | null; last_sync_minutes: number | null; offline: { id: number; name: string }[] };
export type SyncRun = {
  id: number;
  trigger: "schedule" | "manual" | "agent";
  status: "running" | "ok" | "failed";
  started_at: string;
  finished_at: string | null;
  window_from: string | null;
  window_to: string | null;
  received: number;
  new: number;
  already: number;
  unmapped: number;
  error_count: number;
  message: string;
  details: { errors?: { index: number; error: string }[] };
};
export type ConnectionTest =
  | { ok: true; found: { login: string; terminals: { serial: string; name: string; last_activity: string | null }[]; people: number; punches: number; samples: { event_id: string; user_id: string; time: string; kind: PunchKind; terminal: string; name: string }[]; event_codes?: string[] } }
  | { ok: false; error: string };
type EmployeeBrief = { id: number; name_ar: string; name_en: string; employee_no: string };
export type DeviceUser = { id: number; connector: number; external_id: string; name: string; employee: EmployeeBrief | null; matched_by: string; punches: number };
export type PunchKind = "in" | "out" | "break_start" | "break_end" | "unknown";
export type Punch = {
  id: number;
  employee: EmployeeBrief | null;
  source: "biotime" | "biostar" | "web" | "mobile" | "manual" | "correction";
  kind: PunchKind;
  punched_at: string;
  local_time: string;
  time_zone: string;
  terminal: string;
  note: string;
  duplicate_of: number | null;
  received_at: string;
  entered_by: string | null;
  connector: string | null;
  has_selfie: boolean;
  location: { latitude: string; longitude: string; accuracy_m: number | null; distance_m: number | null; outside: "" | "remote" | "mission" } | null;
};

export const punches = {
  connectors: () => api.get<Connector[]>("/connectors"),
  saveConnector: (body: Partial<Connector>, id?: number) => (id ? api.patch<Connector>(`/connectors/${id}`, body) : api.post<Connector>("/connectors", body)),
  token: (id: number) => api.post<{ token: string; hint: string }>(`/connectors/${id}/token`, {}),
  test: (id: number) => api.post<ConnectionTest>(`/connectors/${id}/test`, {}),
  read: (id: number) => api.post<{ queued: boolean }>(`/connectors/${id}/read`, {}),
  runs: (id: number) => api.get<SyncRun[]>(`/connectors/${id}/runs`),
  terminals: (id: number) => api.get<Terminal[]>(`/connectors/${id}/terminals`),
  syncLog: (query: { connector?: number; status?: string; trigger?: string; page?: number }) => api.get<{ count: number; results: SyncRunRow[] }>("/sync-runs", query),
  health: () => api.get<AttendanceHealth>("/attendance/health"),
  deviceUsers: (query: { unmapped?: 1; connector?: number; search?: string; page?: number }) => api.get<{ count: number; results: DeviceUser[] }>("/device-users", query),
  linkUser: (id: number, employee: number | null) => api.patch<DeviceUser>(`/device-users/${id}`, { employee }),
  list: (query: { employee?: number; from?: string; to?: string; source?: string; page?: number }) => api.get<{ count: number; results: Punch[] }>("/punches", query),
  enter: (body: { employee: number; time: string; kind: PunchKind; note: string }) => api.post<Punch>("/punches", body),
  selfie: (id: number) => api.get<{ url: string; expires_in: number }>(`/punches/${id}/selfie`),
};

// --- task 5: attendance days ---------------------------------------------------------------

export type DayStatus = "present" | "late" | "early_leave" | "incomplete" | "absent" | "working" | "not_started" | "leave" | "mission" | "trip" | "remote" | "holiday" | "off" | "unscheduled";
export type AttendanceDay = {
  id: number;
  employee: EmployeeBrief;
  date: string;
  status: DayStatus;
  shift: ShiftBrief | null;
  roster_source: string;
  ramadan: boolean;
  first_in: string | null;
  last_out: string | null;
  punch_count: number;
  scheduled_minutes: number;
  worked_minutes: number;
  present_minutes: number;
  break_minutes: number;
  late_minutes: number;
  early_leave_minutes: number;
  covered_minutes: number;
  overtime_minutes: number;
  overtime_kind: "" | "normal" | "rest_day" | "holiday";
  overtime_approved_minutes: number;
  is_late: boolean;
  is_early_leave: boolean;
  half_day: boolean;
  covers: { type: string; id: number; label: { ar: string; en: string } }[];
  flags: string[];
  is_final: boolean;
  time_zone: string;
};

type OvertimeBucket = { minutes: number; approved_minutes: number };
export type OvertimeYear = {
  employee: number;
  year: number;
  by_kind: Record<"normal" | "rest_day" | "holiday", OvertimeBucket>;
  minutes: number;
  approved_minutes: number;
  unapproved_minutes: number;
  cap_minutes: number;
  remaining_minutes: number;
  over_cap: boolean;
};

export const days = {
  list: (query: { date?: string; from?: string; to?: string; employee?: number; status?: string; department?: number; search?: string; page?: number; page_size?: number }) =>
    api.get<{ count: number; results: AttendanceDay[] }>("/attendance-days", query),
  mine: (from: string, to: string) => api.get<AttendanceDay[]>("/attendance-days/mine", { from, to }),
  rebuild: (body: { from: string; to?: string; employee?: number }) => api.post<{ days: number }>("/attendance-days/rebuild", body),
  overtime: (query: { employee?: number; year?: number }) => api.get<OvertimeYear>("/attendance-days/overtime", query),
};

// --- task 7: the dashboard card --------------------------------------------------------------

export type BreakKind = "lunch" | "short";
export type CardAction = "in" | "out" | "break_end" | `break_start:${BreakKind}`;
export type Today = {
  date: string;
  time_zone: string;
  now: string;
  shift: ShiftBrief | null;
  off: boolean;
  ramadan: boolean;
  parts: { from: string; to: string }[];
  flexible: boolean;
  latest_start: string | null;
  scheduled_minutes: number;
  breaks: { kind: BreakKind; minutes: number; paid: boolean; from: string; to: string }[];
  punches: { time: string; kind: PunchKind; source: Punch["source"]; break: BreakKind | "" }[];
  checked_in: boolean;
  on_break: BreakKind | null;
  status: DayStatus;
  late_minutes: number;
  worked_minutes: number;
  break_minutes: number;
  covers: { type: string; label: { ar: string; en: string } }[];
  actions: CardAction[];
  /** Task 8: what a check in / out needs here. */
  checks: {
    geofence: boolean;
    radius_m: number | null;
    max_accuracy_m: number;
    excused_by: "" | "remote" | "mission";
    selfie_required: boolean;
    selfie_consent: boolean;
    selfie_keep_days: number;
  };
};
export type Where = { latitude: number; longitude: number; accuracy: number };

export const myDay = {
  today: () => api.get<Today>("/attendance/me/today"),
  punch: (kind: Exclude<PunchKind, "unknown">, brk?: BreakKind, where?: Where | null, selfie?: Blob | null) => {
    const fields: Record<string, string> = { kind, ...(brk ? { break: brk } : {}) };
    if (where) Object.assign(fields, { latitude: String(where.latitude), longitude: String(where.longitude), accuracy: String(where.accuracy) });
    if (!selfie) return api.post<Today & { punch: number }>("/attendance/me/punch", fields);
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    form.append("selfie", selfie, "selfie.jpg");
    return api.post<Today & { punch: number }>("/attendance/me/punch", form);
  },
  consent: () => api.post<Today>("/attendance/me/selfie-consent", {}),
  withdraw: () => api.del("/attendance/me/selfie-consent"),
};

// --- task 13: attendance correction ----------------------------------------------------------

export type Correction = {
  id: number;
  date: string;
  check_in: string | null;
  check_out: string | null;
  out_next_day: boolean;
  reason: string;
  file_name: string;
  has_file: boolean;
  status: string;
  workflow_id: number | null;
};
export type CorrectionInput = { date: string; check_in: string | null; check_out: string | null; out_next_day: boolean; reason: string };

function correctionForm(values: CorrectionInput, file?: File | null): FormData | CorrectionInput {
  if (!file) return values;
  const form = new FormData();
  for (const [k, v] of Object.entries(values)) form.append(k, v === null ? "" : String(v));
  form.append("file", file);
  return form;
}

export const correctionRequests = {
  get: (id: number) => api.get<Correction>(`/correction-requests/${id}`),
  preview: (values: CorrectionInput, editId?: number) =>
    api.post<{ replaces: number; errors: Record<string, string[]> }>(`/correction-requests/preview${editId ? `?id=${editId}` : ""}`, values),
  create: (values: CorrectionInput, file?: File | null) => api.post<Correction>("/correction-requests", correctionForm(values, file)),
  update: (id: number, values: CorrectionInput, file?: File | null) => api.patch<Correction>(`/correction-requests/${id}`, correctionForm(values, file)),
  submit: (id: number) => api.post<Correction>(`/correction-requests/${id}/submit`, {}),
};

// --- task 14: overtime request ---------------------------------------------------------------

export type OvertimeInput = { date: string; from_time: string; to_time: string; to_next_day: boolean; reason: string };
export type OvertimeStored = OvertimeInput & { id: number; minutes: number; day_type: string; status: string; workflow_id: number | null };
export type OvertimePreview = { minutes: number; day_type: "" | "normal" | "rest_day" | "holiday"; year_left_minutes?: number; errors: Record<string, string[]> };

export const overtimeRequests = {
  get: (id: number) => api.get<OvertimeStored>(`/overtime-requests/${id}`),
  preview: (values: OvertimeInput, editId?: number) => api.post<OvertimePreview>(`/overtime-requests/preview${editId ? `?id=${editId}` : ""}`, values),
  create: (values: OvertimeInput) => api.post<OvertimeStored>("/overtime-requests", values),
  update: (id: number, values: OvertimeInput) => api.patch<OvertimeStored>(`/overtime-requests/${id}`, values),
  submit: (id: number) => api.post<OvertimeStored>(`/overtime-requests/${id}/submit`, {}),
};

// --- task 15: month lock ---------------------------------------------------------------------

export type AttendanceMonth = {
  month: string; // "2026-10"
  status: "open" | "locked";
  ended: boolean;
  locked_at: string | null;
  locked_by: { ar: string; en: string } | null;
  unlocked_at: string | null;
  unlocked_by: { ar: string; en: string } | null;
  unlock_reason: string;
};

export const periods = {
  list: (year: number) => api.get<{ year: number; months: AttendanceMonth[]; can_lock: boolean }>("/attendance-periods", { year }),
  lock: (month: string) => api.post<{ month: string; status: string; days: number; pending: number }>("/attendance-periods/lock", { month }),
  unlock: (month: string, reason: string) => api.post<{ month: string; status: string }>("/attendance-periods/unlock", { month, reason }),
};

// --- task 16: screens and reports ------------------------------------------------------------

export type BoardRow = {
  employee: EmployeeBrief;
  department: string;
  shift: { id: number; name_ar: string; name_en: string; color: ShiftColor; hours: string } | null;
  status: DayStatus;
  first_in: string;
  last_out: string;
  worked_minutes: number;
  late_minutes: number;
  early_leave_minutes: number;
  overtime_minutes: number;
  flags: string[];
  covers: { ar: string; en: string }[];
  source: { kind: Punch["source"]; name: string; terminal: string } | null;
  time_zone: string;
};
export type Board = { date: string; rows: BoardRow[]; counts: { total?: number; at_work?: number; late?: number; missing?: number; away?: number } };
export type ReportKind = "daily" | "monthly" | "lateness" | "absence" | "overtime" | "sync";
export type ReportColumn = { key: string; label: string; kind: "text" | "date" | "number" | "duration" };
export type ReportData = { kind: ReportKind; title: string; from: string; to: string; columns: ReportColumn[]; rows: Record<string, string | number | null>[] };
type ReportQuery = { date?: string; from?: string; to?: string; department?: number; search?: string };

export const attendanceBoard = {
  get: (query: { date?: string; department?: number; search?: string; status?: string }) => api.get<Board>("/attendance/board", query),
  report: (kind: ReportKind, query: ReportQuery) => api.get<ReportData>(`/attendance-reports/${kind}`, query),
  exportReport: (kind: ReportKind, query: ReportQuery, as: ExportFormat = "xlsx") => api.download(`/attendance-reports/${kind}`, { ...query, export: as }),
};
