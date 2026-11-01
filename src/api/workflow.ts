/** Route builder endpoints (Phase 2 task 3). Shapes follow apps/workflow RouteSerializer and the routes viewset. */

import { api, type Bilingual, type Named, type Person } from "./index";

export type Operator = "eq" | "ne" | "in" | "not_in" | "gt" | "gte" | "lt" | "lte";
export type Condition = { fact: string; op: Operator; value: string | number | (string | number)[] };

export type FactOption = { value: string | number; label: Bilingual };
export type FactMeta = { name: string; label: Bilingual; kind: "number" | "choice" | "reference"; options: FactOption[]; own: boolean };
export type Choice = { value: string; label: Bilingual };
export type RoleBrief = Named & { id: number };

export type RouteMeta = {
  types: { code: string; name: Bilingual; facts: FactMeta[] }[];
  approver_types: Choice[];
  modes: Choice[];
  escalate_to: Choice[];
  operators: Choice[];
  roles: RoleBrief[];
  can_manage_tenant: boolean;
};

export type ApproverType = "manager" | "second_manager" | "department_manager" | "role" | "role_in_scope" | "user";
export type EscalateTo = "" | "approver_manager" | "second_manager" | "role" | "user";

export type RouteStep = {
  order: number;
  name_ar: string;
  name_en: string;
  approver_type: ApproverType;
  role: RoleBrief | null;
  user: Person | null;
  mode: "any" | "all";
  skip_if_unresolved: boolean;
  sla_hours: number | null;
  condition: Condition[];
  escalate_after_hours: number | null;
  escalate_to: EscalateTo;
  escalate_role: RoleBrief | null;
  escalate_user: Person | null;
};

export type Route = Named & {
  id: number;
  request_type: string;
  scope: "company" | "tenant";
  company: number | null;
  is_active: boolean;
  priority: number;
  conditions: Condition[];
  steps: RouteStep[];
  is_fallback: boolean;
  in_use: number;
  updated_at: string;
};

/** A step as the API takes it: ids instead of objects. */
export type StepInput = Omit<RouteStep, "order" | "role" | "user" | "escalate_role" | "escalate_user"> & {
  role: number | null;
  user: number | null;
  escalate_role: number | null;
  escalate_user: number | null;
};

export type RouteInput = Named & {
  request_type: string;
  scope: "company" | "tenant";
  is_active: boolean;
  priority: number;
  conditions: Condition[];
  steps: StepInput[];
};

export type PreviewStep = Named & {
  order: number;
  mode: "any" | "all";
  outcome: "ask" | "skipped" | "skipped_condition" | "admins";
  approvers: (Person & { delegate: Person | null })[];
};

export type Preview = {
  chosen: Named & { id: number; is_fallback: boolean };
  matches: boolean;
  facts: Record<string, string>;
  goes_to_admins: boolean;
  steps: PreviewStep[];
};

export type PreviewInput = {
  request_type: string;
  employee: number;
  facts?: Record<string, string>;
  scope?: "company" | "tenant";
  conditions?: Condition[];
  steps?: StepInput[];
};

const URL = "/workflow/routes";

export const workflow = {
  meta: () => api.get<RouteMeta>(`${URL}/meta`),
  routes: (requestType: string) => api.get<Route[]>(URL, { request_type: requestType }),
  route: (id: number) => api.get<Route>(`${URL}/${id}`),
  createRoute: (body: RouteInput) => api.post<Route>(URL, body),
  updateRoute: (id: number, body: Partial<RouteInput>) => api.patch<Route>(`${URL}/${id}`, body),
  deleteRoute: (id: number) => api.del(`${URL}/${id}`),
  people: (search = "") => api.get<(Person & { email: string })[]>(`${URL}/people`, { search }),
  preview: (body: PreviewInput) => api.post<Preview>(`${URL}/preview`, body),
};
