/** Work calendar endpoints (Phase 2 task 5): holidays, holiday rules, the weekend, company events. Shapes follow
 * apps/leave serializers and views. */

import { api, type Page, type Person } from "./index";

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7; // ISO: 5 = Friday, 6 = Saturday
export type HolidayKind = "eid_al_fitr" | "eid_al_adha" | "national_day" | "founding_day" | "other";
export type Scope = "company" | "tenant";

export type Holiday = {
  id: number;
  scope: Scope;
  company: number | null;
  country: string | null;
  kind: HolidayKind;
  name_ar: string;
  name_en: string;
  start_date: string;
  end_date: string;
  start_date_hijri: string;
  end_date_hijri: string;
  days: number;
  branches: number[];
  rule: number | null;
  rule_year: number | null;
  is_active: boolean;
  note: string;
};

export type HolidayRule = {
  id: number;
  scope: Scope;
  company: number | null;
  country: string | null;
  kind: HolidayKind;
  name_ar: string;
  name_en: string;
  calendar: "gregorian" | "hijri";
  month: number;
  day: number;
  length_days: number;
  is_active: boolean;
  source: string;
};

export type Audience = "company" | "branch" | "department";
export type CompanyEvent = {
  id: number;
  title_ar: string;
  title_en: string;
  description: string;
  start_date: string;
  end_date: string;
  start_date_hijri: string;
  all_day: boolean;
  start_time: string | null;
  end_time: string | null;
  location: string;
  audience: Audience;
  branch: number | null;
  department: number | null;
  created_by: Person | null;
};

export type CalendarData = {
  from: string;
  to: string;
  branch: number | null;
  weekend_days: Weekday[];
  working_days: number;
  holidays: Holiday[];
  events: CompanyEvent[];
};

export type SettingsTable<T> = { account: T; company: { [K in keyof T]: T[K] | null }; effective: T };
export type CalendarSettings = { weekend_days: Weekday[] };

export const calendar = {
  month: (from: string, to: string, branch?: number | null) =>
    api.get<CalendarData>("/calendar", { from, to, branch: branch ?? undefined }),
  holidays: (year: number, all = false) => api.get<Page<Holiday>>("/holidays", { year, all: all ? 1 : undefined, page_size: 100 }),
  createHoliday: (body: Partial<Holiday>) => api.post<Holiday>("/holidays", body),
  updateHoliday: (id: number, body: Partial<Holiday>) => api.patch<Holiday>(`/holidays/${id}`, body),
  deleteHoliday: (id: number) => api.del(`/holidays/${id}`),
  access: () => api.get<{ manage: boolean; shared: boolean }>("/holidays/access"),
  generate: (year: number) => api.post<{ created: number }>("/holidays/generate", { year }),
  rules: () => api.get<Page<HolidayRule>>("/holiday-rules", { page_size: 100 }),
  createRule: (body: Partial<HolidayRule>) => api.post<HolidayRule>("/holiday-rules", body),
  updateRule: (id: number, body: Partial<HolidayRule>) => api.patch<HolidayRule>(`/holiday-rules/${id}`, body),
  deleteRule: (id: number) => api.del(`/holiday-rules/${id}`),
  settings: () => api.get<SettingsTable<CalendarSettings>>("/calendar-settings"),
  updateSettings: (level: "account" | "company", weekend_days: Weekday[] | null) =>
    api.patch<SettingsTable<CalendarSettings>>("/calendar-settings", { level, weekend_days }),
  createEvent: (body: Partial<CompanyEvent>) => api.post<CompanyEvent>("/company-events", body),
  updateEvent: (id: number, body: Partial<CompanyEvent>) => api.patch<CompanyEvent>(`/company-events/${id}`, body),
  deleteEvent: (id: number) => api.del(`/company-events/${id}`),
};
