/** Employee dashboard (#55) and the leave balance report (#132). Shapes follow apps/selfservice/dashboard.py and
 * apps/leave/report.py. */

import type { Bilingual, ExportFormat, Named } from "./index";
import { api } from "./index";
import type { LeaveBalance } from "./leave";

type Person = Named & { id: number };
export type TicketBalanceRow = { leave_type: null; kind: "tickets"; available: string; entitled: string; pending: string; next_due: string | null };
export type AwayEntry = {
  employee: Person;
  start: string;
  end: string;
  kind: "leave" | "mission" | "remote" | "trip";
  label: Bilingual;
  /** The leave's category (annual, sick…), only when the user may read that employee's leave. */
  category: string | null;
};
export type Dashboard = {
  today: string;
  employee: Person | null;
  balances: (LeaveBalance | TicketBalanceRow)[];
  away: AwayEntry[];
  birthdays: { employee: Person; day: string; in_days: number }[];
  counts: { approvals: number; returned: number; open: number; custody_to_confirm: number };
};

export type ReportRow = {
  employee: Person & { employee_no: string };
  department: Person | null;
  kind: string;
  year: { start: string; end: string } | null;
} & Record<"entitled" | "opening" | "carried" | "accrued" | "taken" | "adjusted" | "expired" | "pending" | "available" | "granted" | "utilisation", string | null>;
export type DepartmentRow = { department: Person | null; employees: number; taken: string; available: string; pending: string; utilisation: string | null };
export type LeaveBalanceReport = { leave_type: Person; on: string; rows: ReportRow[]; departments: DepartmentRow[] };
export type ReportQuery = { leave_type?: number; on?: string; department?: number; search?: string };

export const dashboard = {
  get: () => api.get<Dashboard>("/dashboard"),
  leaveReport: (query: ReportQuery) => api.get<LeaveBalanceReport>("/leave-balance-report", query),
  leaveReportMeta: () => api.get<{ others: boolean }>("/leave-balance-report", { meta: 1 }),
  exportLeaveReport: (query: ReportQuery, as: ExportFormat = "xlsx") => api.download("/leave-balance-report", { ...query, export: as }),
};
