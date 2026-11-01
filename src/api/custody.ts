/** Custody (Phase 2 task 14, #35): the company's register and what is handed to employees. Shapes follow
 * apps/selfservice views. */

import type { FileLink } from "./hr";
import { formData } from "./hr";
import { api } from "./index";

export type CustodyCategory = "laptop" | "phone" | "sim" | "vehicle" | "key" | "access_card" | "tool" | "uniform" | "other";
export type ItemStatus = "available" | "assigned" | "maintenance" | "lost" | "retired";
export type CustodyStatus = "open" | "returned" | "lost";
export type CustodyKind = "asset" | "cash";

export type CustodyItem = {
  id: number;
  category: CustodyCategory;
  name_ar: string;
  name_en: string;
  asset_tag: string;
  serial_number: string;
  value: string | null;
  status: ItemStatus;
  notes: string;
  holder: { id: number; name_ar: string; name_en: string } | null;
};
export type Custody = {
  id: number;
  employee: { id: number; name_ar: string; name_en: string; employee_no: string };
  kind: CustodyKind;
  item: number | null;
  category: CustodyCategory | null;
  label: { ar: string; en: string };
  description: string;
  amount: string | null;
  handed_on: string;
  condition_out: string;
  due_on: string | null;
  has_file: boolean;
  file_name: string;
  acknowledged_at: string | null;
  status: CustodyStatus;
  returned_on: string | null;
  condition_in: "" | "good" | "damaged";
  returned_amount: string | null;
  spent_amount: string | null;
  shortfall: string;
  return_notes: string;
  has_return_file: boolean;
  return_file_name: string;
};
export type Outstanding = { open: number; open_cash: string; shortfall: string };
type Page<T> = { count: number; results: T[] };
type Query = Record<string, string | number | undefined>;
type Fields = Record<string, string | number | null | File | undefined>;

export const custody = {
  list: (query: Query) => api.get<Page<Custody>>("/custody", query),
  handOver: (body: Fields) => api.post<Custody>("/custody", formData(body)),
  acknowledge: (id: number) => api.post<Custody>(`/custody/${id}/acknowledge`, {}),
  receive: (id: number, body: Fields) => api.post<Custody>(`/custody/${id}/return`, formData(body)),
  lost: (id: number, body: Fields) => api.post<Custody>(`/custody/${id}/lost`, body),
  link: (id: number, file: "handover" | "return") => api.get<FileLink>(`/custody/${id}/download`, file === "return" ? { file: "return" } : undefined),
  outstanding: (employee: number) => api.get<Outstanding>("/custody/outstanding", { employee }),
  items: (query: Query) => api.get<Page<CustodyItem>>("/custody-items", query),
  saveItem: (body: Partial<CustodyItem>, id?: number) =>
    id ? api.patch<CustodyItem>(`/custody-items/${id}`, body) : api.post<CustodyItem>("/custody-items", body),
  deleteItem: (id: number) => api.del(`/custody-items/${id}`),
};
