import { api } from "./index";
import type { Penalty, PenaltyRuleRow } from "./payroll";

/** Disciplinary actions (#47, Phase 4 task 10) and the account's / company's violation list. */
export type PenaltyType = "warning" | "percent" | "days" | "suspension" | "hold" | "dismissal_award" | "dismissal_art80";
export const PENALTY_TYPES: PenaltyType[] = ["warning", "percent", "days", "suspension", "hold", "dismissal_award", "dismissal_art80"];
export type Violation = { id: number; company: number | null; category: "work" | "behaviour" | "other"; name_ar: string; name_en: string; penalties: Penalty[]; source: string; is_active: boolean };
export type DisciplinaryAction = {
  id: number;
  employee: number;
  violation: number | null;
  attendance_rule: number | null;
  occurred_on: string;
  discovered_on: string;
  description: string;
  occurrence: number;
  notified_on: string | null;
  statement: string;
  penalty_type: PenaltyType;
  penalty_value: string | null;
  suspension_from: string | null;
  deduct_month: string | null;
  status: string;
  submitted_at: string | null;
  decided_at: string | null;
  workflow_id: number | null;
  employee_info: { employee_no: string; name_ar: string; name_en: string };
};
export type ActionInput = Omit<DisciplinaryAction, "id" | "occurrence" | "deduct_month" | "status" | "submitted_at" | "decided_at" | "workflow_id" | "employee_info">;
export type AttendanceRule = PenaltyRuleRow;

export const discipline = {
  violations: () => api.get<Violation[]>("/violations"),
  saveViolation: (body: Partial<Violation>, id?: number) => (id ? api.patch<Violation>(`/violations/${id}`, body) : api.post<Violation>("/violations", body)),
  removeViolation: (id: number) => api.del(`/violations/${id}`),
  actions: (employee: number) => api.get<DisciplinaryAction[]>("/disciplinary-actions", { employee }),
  mine: () => api.get<DisciplinaryAction[]>("/disciplinary-actions/mine"),
  file: (body: ActionInput) => api.post<DisciplinaryAction>("/disciplinary-actions", body),
  propose: (body: { employee: number; occurred_on: string; violation?: number | null; attendance_rule?: number | null }) =>
    api.post<{ occurrence: number; penalty: Penalty | null }>("/disciplinary-actions/propose", body),
};
