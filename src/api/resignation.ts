import { api } from "./index";

/** Resignation (#65) and offboarding (#46), Phase 4 task 16 (apps/employees/resignation.py). */
export type ContractKind = "indefinite" | "fixed" | "probation";
export type ResignationTerms = {
  kind: ContractKind;
  notice_days: number;
  earliest: string;
  default: string;
  latest: string;
  accepted_by: string;
  withdraw_until: string;
};
export type Resignation = {
  id: number;
  employee: number;
  employee_info: { id: number; employee_no: string; name_ar: string; name_en: string };
  reason: string;
  given_on: string;
  proposed_last_day: string | null;
  contract_kind: ContractKind | "";
  notice_days: number;
  last_working_day: string | null;
  postpone_reason: string;
  terms: ResignationTerms;
  status: string;
  submitted_at: string | null;
  decided_at: string | null;
  workflow_id: number | null;
};
export type ResignationInput = { reason: string; proposed_last_day: string | null };
export type Offboarding = {
  id: number;
  employee: number;
  employee_info: Resignation["employee_info"];
  reason: string;
  notice_given_on: string;
  last_working_day: string;
  status: "notice" | "left" | "settled" | "cancelled";
  resignation: number | null;
  note: string;
  outstanding: { custody_open: number; custody_cash: string; custody_shortfall: string; advance_balance: string };
  clearance: ClearanceItem[];
  settlement: { id: number; month: string; stage: string } | null;
  /** A non-Saudi's government steps (Phase 5 task 10): warnings, never a condition of the settlement. */
  government?: { applies: boolean; transfer_of_service: boolean; iqama_cancelled: boolean; note: string; warnings: string[] };
};
export type ClearanceArea = "custody" | "it" | "finance" | "manager" | "hr";
export type ClearanceItem = { id: number; area: ClearanceArea; status: "open" | "cleared" | "waived"; note: string; cleared_by: number | null; cleared_by_name: { ar: string; en: string } | null; cleared_at: string | null };

export const resignations = {
  get: (id: number) => api.get<Resignation>(`/resignations/${id}`),
  of: (employee: number) => api.get<Resignation[]>("/resignations", { employee }),
  preview: (body: ResignationInput, editId?: number) =>
    api.post<{ terms: ResignationTerms; errors: Record<string, string[]> }>(`/resignations/preview${editId ? `?id=${editId}` : ""}`, body),
  create: (body: ResignationInput) => api.post<Resignation>("/resignations", body),
  update: (id: number, body: ResignationInput) => api.patch<Resignation>(`/resignations/${id}`, body),
  resubmit: (id: number) => api.post<Resignation>(`/resignations/${id}/submit`, {}),
  setLastDay: (id: number, body: { last_working_day: string; postpone_reason: string }) => api.post<Resignation>(`/resignations/${id}/last-day`, body),
  offboardings: (params: { employee?: number; status?: string }) => api.get<Offboarding[]>("/offboardings", params),
  keep: (id: number, note: string) => api.post<Offboarding>(`/offboardings/${id}/cancel`, { note }),
  start: (body: { employee: number; reason: string; last_working_day: string | null; note: string }) => api.post<Offboarding>("/offboardings", body),
  sign: (id: number, body: { area: ClearanceArea; status: ClearanceItem["status"]; note: string }) => api.post<Offboarding>(`/offboardings/${id}/clearance`, body),
};
