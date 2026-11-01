import { api } from "./index";

/** Expense claims (#61, Phase 4 task 8): a draft, its lines with receipts, then sent for approval. */
export type ExpenseCategory = "travel" | "accommodation" | "meals" | "transport" | "fuel" | "communication" | "supplies" | "training" | "other";
export const EXPENSE_CATEGORIES: ExpenseCategory[] = ["travel", "accommodation", "meals", "transport", "fuel", "communication", "supplies", "training", "other"];
export type ExpenseLine = { id: number; category: ExpenseCategory; date: string; description: string; amount: string; currency: string; rate: string; file_name: string; has_file: boolean; paid_amount: string };
export type ExpenseClaim = {
  id: number;
  purpose: string;
  pay_via: "payroll" | "finance";
  currency: string;
  total: string;
  paid_month: string | null;
  paid_on: string | null;
  lines: ExpenseLine[];
  status: string;
  submitted_at: string | null;
  decided_at: string | null;
  workflow_id: number | null;
};
export type NewLine = { category: ExpenseCategory; date: string; description: string; amount: string; currency: string; rate: string; file: File };

export const expenses = {
  get: (id: number) => api.get<ExpenseClaim>(`/expense-claims/${id}`),
  create: (purpose: string) => api.post<ExpenseClaim>("/expense-claims", { purpose }),
  update: (id: number, purpose: string) => api.patch<ExpenseClaim>(`/expense-claims/${id}`, { purpose }),
  addLine: (id: number, line: NewLine) => {
    const form = new FormData();
    Object.entries(line).forEach(([key, value]) => form.append(key, value));
    return api.post<ExpenseClaim>(`/expense-claims/${id}/lines`, form);
  },
  removeLine: (id: number, lineId: number) => api.del(`/expense-claims/${id}/lines/${lineId}`),
  submit: (id: number) => api.post<ExpenseClaim>(`/expense-claims/${id}/submit`, {}),
  remove: (id: number) => api.del(`/expense-claims/${id}`),
  receipt: (id: number, lineId: number) => api.get<{ url: string }>(`/expense-claims/${id}/lines/${lineId}/receipt`),
};
