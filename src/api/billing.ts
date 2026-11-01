/** The tenant's subscription and invoices (Phase 6 task 23). Shapes follow apps/billing/views.py. */

import { api, type Named } from "./index";

export type BillingInvoice = {
  id: number;
  number: string;
  kind: "subscription" | "proration";
  status: "open" | "paid" | "void";
  period_start: string;
  period_end: string;
  issued_on: string;
  due_on: string;
  paid_on: string | null;
  currency: string;
  subtotal: string;
  vat_rate: string;
  vat: string;
  total: string;
  zatca_status: "" | "pending" | "cleared" | "rejected";
  zatca_message: string;
  has_tax_invoice: boolean;
  lines: { description_ar: string; description_en: string; quantity: number; amount: string }[];
};
export type Billing = {
  account: {
    status: "trial" | "active" | "past_due" | "suspended" | "cancelled";
    tenant_status: string;
    period_start: string | null;
    period_end: string | null;
    billed_employees: number;
    employees_now: number | null;
    plan: Named;
    price: { period: "monthly" | "annual"; currency: string; base_fee: string; included_employees: number; per_employee: string; minimum: string };
    trial_ends_on: string | null;
    delete_on: string | null;
    buyer: Buyer;
  } | null;
  invoices: BillingInvoice[];
  gateway: { name: "mock" | "moyasar"; publishable_key: string };
};
export type Buyer = { legal_name: string; vat_number: string; cr_number: string; building_no: string; street: string; district: string; city: string; postal_code: string };
export type Card = { id: number; brand: string; last4: string; is_default: boolean };
export type PaymentResult = { id: number; invoice: string; status: "paid" | "failed" | "pending"; message: string; redirect_url: string; reference: string };

export const billingApi = {
  get: () => api.get<Billing>("/billing"),
  cards: () => api.get<Card[]>("/billing/cards"),
  addCard: (body: { token: string; brand: string; last4: string }) => api.post<Card>("/billing/cards", body),
  pay: (invoice: number) => api.post<PaymentResult>(`/billing/invoices/${invoice}/pay`, {}),
  saveBuyer: (body: Partial<Buyer>) => api.patch<Buyer>("/billing/buyer", body),
  taxInvoice: (invoice: number) => api.get<{ url: string; expires_in: number }>(`/billing/invoices/${invoice}/tax-invoice`),
  settle: (reference: string) => api.post<PaymentResult>(`/billing/payments/${reference}/settle`, {}),
};
