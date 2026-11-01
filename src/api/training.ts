/** Training (Phase 6 task 19). Shapes follow apps/training/views.py. Decimals as strings. */

import { api, type Named, type Page } from "./index";

export type CourseKind = "internal" | "external";
export type SessionRow = { id: number; start_date: string; end_date: string; place: string; seats_left: number };
export type CourseBody = Named & { code: string; kind: CourseKind; provider: string; description: string; hours: string; cost: string; currency: string; competencies: number[]; certificate_months: number | null; is_active: boolean };
export type Course = CourseBody & { id: number; upcoming: SessionRow[] };
export type SessionBody = { course: number; start_date: string; end_date: string; seats: number; trainer: string; place: string; status: "planned" | "done" | "cancelled" };
export type Session = SessionBody & { id: number; seats_left: number; course_name: Named };
export type Person = Named & { id: number; employee_no: string };
export type BudgetStatus = "" | "within" | "over" | "none";
export type TrainingRequest = {
  id: number;
  employee: number;
  course: number;
  session: number | null;
  reason: string;
  cost: string;
  budget: BudgetStatus;
  budget_detail: { amount?: string | null; used?: string; asking?: string; left?: string | null };
  status: "draft" | "pending" | "returned" | "approved" | "rejected" | "cancelled";
  submitted_at: string | null;
  info: { employee: Person; nominated: boolean; requester: Named; course: Named & { kind: CourseKind; hours: string }; session: { start_date: string; end_date: string; place: string } | null };
};
export type EnrollmentStatus = "enrolled" | "attended" | "completed" | "no_show" | "cancelled";
export type Enrollment = {
  id: number;
  employee: number;
  course: number;
  session: number | null;
  status: EnrollmentStatus;
  cost: string;
  hours: string;
  completed_on: string | null;
  score: string | null;
  note: string;
  info: { employee: Person; course: Named & { kind: CourseKind }; session: { start_date: string; end_date: string } | null; certificate: { id: number; expiry_date: string | null } | null };
};
export type TrainingBudget = { id: number; year: number; department: number | null; department_name: Named | null; amount: string; currency: string; note: string; taken: string };
export type Suggestion = { course: Named & { id: number; hours: string }; competency: Named; rating: number; top: number };

export const trainingApi = {
  courses: (active?: boolean) => api.get<Page<Course>>("/courses", { page_size: 100, active: active ? "1" : undefined }),
  saveCourse: (body: CourseBody & { id?: number }) => (body.id ? api.patch<Course>(`/courses/${body.id}`, body) : api.post<Course>("/courses", body)),
  sessions: (course?: number) => api.get<Page<Session>>("/training-sessions", { course, page_size: 100 }),
  saveSession: (body: SessionBody & { id?: number }) => (body.id ? api.patch<Session>(`/training-sessions/${body.id}`, body) : api.post<Session>("/training-sessions", body)),
  requests: () => api.get<Page<TrainingRequest>>("/training-requests", { page_size: 100 }),
  ask: (body: { employee: number; course: number; session: number | null; reason: string }) => api.post<TrainingRequest>("/training-requests", body),
  enrollments: (query: { mine?: "1"; course?: number } = {}) => api.get<Page<Enrollment>>("/enrollments", { ...query, page_size: 100 }),
  record: (id: number, form: FormData) => api.post<Enrollment>(`/enrollments/${id}/record`, form),
  budgets: (year: number) => api.get<Page<TrainingBudget>>("/training-budgets", { year, page_size: 100 }),
  saveBudget: (body: { id?: number; year: number; department: number | null; amount: string; note: string }) => (body.id ? api.patch<TrainingBudget>(`/training-budgets/${body.id}`, body) : api.post<TrainingBudget>("/training-budgets", body)),
  removeBudget: (id: number) => api.del(`/training-budgets/${id}`),
  suggestions: (employee?: number) => api.get<Suggestion[]>("/training/suggestions", { employee }),
};
