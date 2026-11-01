/** Letters (Phase 2 task 13): templates, signatories, issued letters and the public verification. Shapes follow
 * apps/selfservice views. */

import type { FileLink } from "./hr";
import { formData } from "./hr";
import { api } from "./index";

export type LetterKind = "salary_certificate" | "employment" | "experience" | "no_objection" | "bank" | "embassy" | "other";
export type LetterLanguage = "ar" | "en" | "both";
export type LetterTemplate = {
  id: number;
  scope: "company" | "tenant";
  company: number | null;
  code: string;
  kind: LetterKind;
  name_ar: string;
  name_en: string;
  body_ar: string;
  body_en: string;
  shows_salary: boolean;
  is_active: boolean;
  is_system: boolean;
  updated_at: string;
};
export type Signatory = {
  id: number;
  name_ar: string;
  name_en: string;
  title_ar: string;
  title_en: string;
  is_default: boolean;
  is_active: boolean;
  has_signature: boolean;
  has_stamp: boolean;
};
export type Letter = {
  id: number;
  employee: { id: number; name_ar: string; name_en: string; employee_no: string };
  template: number;
  reference: string;
  language: LetterLanguage;
  addressee: string;
  title_ar: string;
  title_en: string;
  issued_on: string;
  status: "valid" | "revoked";
  revoked_at: string | null;
  revoke_reason: string;
  request: number | null;
};
type Bilingual = { ar: string; en: string };
export type Verification = {
  valid: boolean;
  status: "valid" | "revoked";
  letter: Bilingual;
  reference: string;
  issued_on: string;
  company: Bilingual;
  employee: Bilingual;
};

type SignatoryBody = Partial<Omit<Signatory, "id" | "has_signature" | "has_stamp">> & { signature?: File; stamp?: File };

export const letters = {
  templates: (active?: boolean) => api.get<LetterTemplate[]>("/letter-templates", active ? { active: 1 } : undefined),
  placeholders: () => api.get<{ placeholders: string[]; salary: string[] }>("/letter-templates/placeholders"),
  saveTemplate: (body: Partial<LetterTemplate>, id?: number) =>
    id ? api.patch<LetterTemplate>(`/letter-templates/${id}`, body) : api.post<LetterTemplate>("/letter-templates", body),
  deleteTemplate: (id: number) => api.del(`/letter-templates/${id}`),
  signatories: () => api.get<Signatory[]>("/letter-signatories"),
  saveSignatory: (body: SignatoryBody, id?: number) =>
    id ? api.patch<Signatory>(`/letter-signatories/${id}`, formData(body)) : api.post<Signatory>("/letter-signatories", formData(body)),
  deleteSignatory: (id: number) => api.del(`/letter-signatories/${id}`),
  signatoryImage: (id: number, field: "signature" | "stamp") => api.get<FileLink>(`/letter-signatories/${id}/image`, { field }),
  list: (query?: { employee?: number; page?: number }) => api.get<{ count: number; results: Letter[] }>("/letters", query),
  issue: (body: { employee: number; template: number; language: LetterLanguage; addressee: string; purpose: string }) => api.post<Letter>("/letters", body),
  revoke: (id: number, reason: string) => api.post<Letter>(`/letters/${id}/revoke`, { reason }),
  link: (id: number) => api.get<FileLink>(`/letters/${id}/download`),
  ask: (body: { template: number; language: LetterLanguage; addressee: string; purpose: string }) => api.post<{ id: number }>("/letter-requests", body),
  askedFor: (id: number) => api.get<{ id: number; template: number; language: LetterLanguage; addressee: string; purpose: string }>(`/letter-requests/${id}`),
  updateAsk: (id: number, body: { template: number; language: LetterLanguage; addressee: string; purpose: string }) => api.patch(`/letter-requests/${id}`, body),
  resubmitAsk: (id: number) => api.post(`/letter-requests/${id}/submit`, {}),
  verify: (token: string) => api.get<Verification>(`/letters/verify/${encodeURIComponent(token)}`),
};
