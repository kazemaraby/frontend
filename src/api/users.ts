/** Settings → Users and roles. Shapes follow apps/core/users_api.py. */

import { api, type Named, type Page } from "./index";

export type Scope = "own" | "team" | "department" | "branch" | "company";
type Ref = Named & { id: number };

export type UserAssignment = {
  id: number;
  role: Ref & { code: string };
  company: Ref | null;
  scope: Scope;
  branch: Ref | null;
  department: Ref | null;
  valid_from: string | null;
  valid_to: string | null;
  current: boolean;
};
export type UserRow = {
  id: number;
  email: string;
  full_name_ar: string;
  full_name_en: string;
  preferred_language: "ar" | "en";
  is_active: boolean;
  is_superuser: boolean;
  last_login: string | null;
  date_joined: string;
  has_password: boolean;
  companies: (Ref & { is_default: boolean })[];
  assignments: UserAssignment[];
  employee: { id: number; employee_no: string } | null;
};
export type AssignmentBody = { role: number | null; company: number | null; scope: Scope; branch?: number | null; department?: number | null; valid_from?: string | null; valid_to?: string | null };
export type InviteBody = {
  email: string;
  full_name_ar: string;
  full_name_en: string;
  preferred_language: "ar" | "en";
  companies: number[];
  default_company: number | null;
  assignments: AssignmentBody[];
  employee: number | null;
};
export type UserOptions = {
  companies: Ref[];
  branches: (Ref & { company: number })[];
  departments: (Ref & { company: number })[];
  roles: (Ref & { code: string; is_system: boolean })[];
  scopes: { value: Scope; label: string }[];
  employees: (Named & { id: number; employee_no: string; company: number; email: string })[];
};
export type UserFilters = { search?: string; company?: string; role?: string; active?: string; page?: number };

export type RoleRow = Ref & { code: string; is_system: boolean; permissions: string[]; users: number };
export type PermissionRow = Named & { code: string; module: string; is_sensitive: boolean };

export const usersApi = {
  list: (filters: UserFilters) => api.get<Page<UserRow>>("/users", { page_size: 50, ...filters }),
  options: () => api.get<UserOptions>("/users/options"),
  invite: (body: InviteBody) => api.post<UserRow>("/users", body),
  update: (id: number, body: Partial<Pick<UserRow, "full_name_ar" | "full_name_en" | "preferred_language">>) => api.patch<UserRow>(`/users/${id}`, body),
  setCompanies: (id: number, companies: number[], defaultCompany: number) => api.post<UserRow>(`/users/${id}/companies`, { companies, default_company: defaultCompany }),
  addRole: (id: number, body: AssignmentBody) => api.post<UserRow>(`/users/${id}/roles`, body),
  removeRole: (id: number, assignment: number) => api.request<UserRow>(`/users/${id}/roles/${assignment}`, { method: "DELETE" }),
  activate: (id: number) => api.post<UserRow>(`/users/${id}/activate`, {}),
  deactivate: (id: number) => api.post<UserRow>(`/users/${id}/deactivate`, {}),
  passwordLink: (id: number) => api.post<{ sent: boolean }>(`/users/${id}/password-link`, {}),
};

export const rolesApi = {
  list: () => api.get<RoleRow[]>("/roles"),
  permissions: () => api.get<PermissionRow[]>("/roles/permissions"),
  create: (body: { name_ar: string; name_en: string; permissions: string[] }) => api.post<RoleRow>("/roles", body),
  update: (id: number, body: Partial<{ name_ar: string; name_en: string; permissions: string[] }>) => api.patch<RoleRow>(`/roles/${id}`, body),
  remove: (id: number) => api.del(`/roles/${id}`),
};

export const passwordLinkApi = {
  check: (uid: string, token: string) => api.get<{ valid: boolean; email: string }>("/auth/set-password", { uid, token }),
  set: (uid: string, token: string, password: string) => api.post<{ email: string }>("/auth/set-password", { uid, token, password }),
  /** "Forgot your password?": 204 whatever the address (the answer never says whether it has an account). */
  forgot: (email: string) => api.post<void>("/auth/forgot-password", { email }),
};
