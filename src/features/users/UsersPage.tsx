import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { ApiError } from "@/api";
import { type AssignmentBody, type InviteBody, type UserOptions, type UserRow, usersApi } from "@/api/users";
import { useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { DateInput } from "@/design/DateInput";
import { Dialog } from "@/design/Dialog";
import { CheckField, FormSelect, SearchInput, Select, TextField } from "@/design/Field";
import { Pagination } from "@/design/Pagination";
import { Pill, type PillTone } from "@/design/Pill";
import { Tabs } from "@/design/Tabs";
import { Page } from "@/layout/Page";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

import { RoleDialog, RolesCard } from "./Roles";

type Tab = "users" | "roles";
const EMPTY_ASSIGNMENT: AssignmentBody = { role: null, company: null, scope: "own", branch: null, department: null, valid_from: null, valid_to: null };

/** /settings/users — the users of the companies I manage (core.manage_users): invite one (they choose their password
 * through an e-mailed link), give roles per company over a data scope, turn an account off; custom roles on the
 * second tab (core.manage_roles). The backend refuses giving more than you have and changing your own access. */
export default function UsersPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("tab") === "roles" ? "roles" : "users";
  const [inviting, setInviting] = useState(false);
  const [newRole, setNewRole] = useState(false);
  return (
    <Page
      title={t("settings.users.title")}
      tabs={<Tabs label={t("settings.users.title")} value={tab} onChange={(next) => setParams(next === "users" ? {} : { tab: next }, { replace: true })} items={(["users", "roles"] as const).map((id) => ({ id, label: t(`users.tabs.${id}`) }))} />}
      actions={
        tab === "users" ? (
          <Button variant="accent" icon={<Plus className="size-4" />} onClick={() => setInviting(true)}>{t("users.add")}</Button>
        ) : (
          can("core.manage_roles") && <Button variant="accent" icon={<Plus className="size-4" />} onClick={() => setNewRole(true)}>{t("roles.add")}</Button>
        )
      }
    >
      {tab === "users" ? <UsersCard /> : <RolesCard />}
      {inviting && <InviteDialog onClose={() => setInviting(false)} />}
      {newRole && <RoleDialog role={null} onClose={() => setNewRole(false)} />}
    </Page>
  );
}

function statusOf(u: UserRow): { tone: PillTone; key: "off" | "invited" | "active" } {
  if (!u.is_active) return { tone: "neutral", key: "off" };
  return u.has_password ? { tone: "green", key: "active" } : { tone: "amber", key: "invited" };
}

function UsersCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const [filters, setFilters] = useState({ search: "", company: "", role: "", active: "1", page: 1 });
  const list = useQuery({ queryKey: ["users", filters], queryFn: () => usersApi.list(filters), placeholderData: keepPreviousData });
  const options = useQuery({ queryKey: ["user-options"], queryFn: usersApi.options });
  const [open, setOpen] = useState<UserRow | null>(null); // kept from each save: a user turned off leaves the list
  const set = (patch: Partial<typeof filters>) => setFilters({ ...filters, page: 1, ...patch });
  const columns: Column<UserRow>[] = [
    { id: "name", header: t("users.name"), cell: (u) => <span className="flex flex-col"><span className="font-semibold text-ink">{format.pick({ ar: u.full_name_ar, en: u.full_name_en }) || u.email}</span><span dir="ltr" className="self-start text-xs text-muted">{u.email}</span></span> },
    { id: "companies", header: t("users.companies"), cell: (u) => <span className="text-sm">{u.companies.map((c) => format.name(c)).join(t("common.listSeparator"))}</span> },
    { id: "roles", header: t("users.roles"), cell: (u) => (u.is_superuser ? <Pill tone="navy">{t("users.superuser")}</Pill> : <span className="flex flex-wrap gap-1">{u.assignments.map((a) => <Pill key={a.id} tone={a.current ? "teal" : "neutral"}>{format.name(a.role)} · {t(`users.scopes.${a.scope}`)}</Pill>)}</span>) },
    { id: "status", header: t("users.status"), cell: (u) => { const s = statusOf(u); return <Pill tone={s.tone}>{t(`users.statuses.${s.key}`)}</Pill>; } },
    { id: "login", header: t("users.lastLogin"), cell: (u) => <span className="num text-sm">{u.last_login ? format.date(u.last_login) : "—"}</span> },
    { id: "act", header: t("common.actions"), cell: (u) => <Button size="sm" variant="outline" onClick={() => setOpen(u)}>{t("users.manage")}</Button> },
  ];
  return (
    <Card title={t("users.title")}>
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <SearchInput label={t("common.search")} placeholder={t("users.searchPlaceholder")} value={filters.search} onChange={(e) => set({ search: e.target.value })} />
        <Select label={t("users.companies")} value={filters.company} onChange={(e) => set({ company: e.target.value })} options={[{ value: "", label: t("users.allCompanies") }, ...(options.data?.companies ?? []).map((c) => ({ value: String(c.id), label: format.name(c) }))]} />
        <Select label={t("users.roles")} value={filters.role} onChange={(e) => set({ role: e.target.value })} options={[{ value: "", label: t("users.allRoles") }, ...(options.data?.roles ?? []).map((r) => ({ value: String(r.id), label: format.name(r) }))]} />
        <Select label={t("users.status")} value={filters.active} onChange={(e) => set({ active: e.target.value })} options={[{ value: "1", label: t("users.onlyActive") }, { value: "0", label: t("users.onlyOff") }, { value: "", label: t("users.everyone") }]} />
      </div>
      <DataTable caption={t("users.title")} columns={columns} rows={list.data?.results ?? []} rowKey={(u) => String(u.id)} rowLabel={(u) => u.email} loading={list.isPending} empty={t("users.empty")} />
      {list.data && list.data.count > 50 && <Pagination page={filters.page} pageCount={Math.ceil(list.data.count / 50)} onPageChange={(page) => setFilters({ ...filters, page })} />}
      {open && options.data && <UserDialog key={open.id} user={open} options={options.data} onChanged={setOpen} onClose={() => setOpen(null)} />}
    </Card>
  );
}

/** One role row: the role, the company, the data scope (and its branch or department), optionally a period. */
function AssignmentFields({ value, onChange, options, companies, errors }: { value: AssignmentBody; onChange: (v: AssignmentBody) => void; options: UserOptions; companies: number[]; errors: Record<string, string | undefined> }) {
  const { t } = useTranslation();
  const format = useFormat();
  const inCompany = <T extends { company: number }>(rows: T[]) => rows.filter((r) => r.company === value.company);
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <FormSelect label={t("users.role")} name="role" placeholder={t("common.choose")} value={value.role ? String(value.role) : ""} onChange={(e) => onChange({ ...value, role: Number(e.target.value) || null })} options={options.roles.map((r) => ({ value: String(r.id), label: format.name(r) }))} error={errors.role} />
      <FormSelect label={t("users.company")} name="company" placeholder={t("common.choose")} value={value.company ? String(value.company) : ""} onChange={(e) => onChange({ ...value, company: Number(e.target.value) || null, branch: null, department: null })} options={options.companies.filter((c) => companies.includes(c.id)).map((c) => ({ value: String(c.id), label: format.name(c) }))} error={errors.company} />
      <FormSelect label={t("users.scope")} name="scope" hint={t(`users.scopeHints.${value.scope}`)} value={value.scope} onChange={(e) => onChange({ ...value, scope: e.target.value as AssignmentBody["scope"], branch: null, department: null })} options={options.scopes.map((s) => ({ value: s.value, label: t(`users.scopes.${s.value}`) }))} error={errors.scope} />
      {value.scope === "branch" && <FormSelect label={t("users.branch")} name="branch" placeholder={t("common.choose")} value={value.branch ? String(value.branch) : ""} onChange={(e) => onChange({ ...value, branch: Number(e.target.value) || null })} options={inCompany(options.branches).map((b) => ({ value: String(b.id), label: format.name(b) }))} error={errors.branch} />}
      {value.scope === "department" && <FormSelect label={t("users.department")} name="department" placeholder={t("common.choose")} value={value.department ? String(value.department) : ""} onChange={(e) => onChange({ ...value, department: Number(e.target.value) || null })} options={inCompany(options.departments).map((d) => ({ value: String(d.id), label: format.name(d) }))} error={errors.department} />}
      <DateInput label={t("users.validFrom")} name="valid_from" value={value.valid_from ?? null} onChange={(d) => onChange({ ...value, valid_from: d })} error={errors.valid_from} hint={t("users.optional")} />
      <DateInput label={t("users.validTo")} name="valid_to" value={value.valid_to ?? null} onChange={(d) => onChange({ ...value, valid_to: d })} error={errors.valid_to} hint={t("users.optional")} />
    </div>
  );
}

function CompanyPicker({ options, companies, defaultCompany, onChange, error }: { options: UserOptions; companies: number[]; defaultCompany: number | null; onChange: (companies: number[], defaultCompany: number | null) => void; error?: string }) {
  const { t } = useTranslation();
  const format = useFormat();
  const toggle = (id: number) => {
    const next = companies.includes(id) ? companies.filter((c) => c !== id) : [...companies, id];
    onChange(next, next.includes(defaultCompany ?? -1) ? defaultCompany : (next[0] ?? null));
  };
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium text-ink">{t("users.companies")}</legend>
      {options.companies.map((c) => <CheckField key={c.id} label={format.name(c)} checked={companies.includes(c.id)} onChange={() => toggle(c.id)} />)}
      {companies.length > 1 && <FormSelect label={t("users.defaultCompany")} name="default_company" value={defaultCompany ? String(defaultCompany) : ""} onChange={(e) => onChange(companies, Number(e.target.value))} options={options.companies.filter((c) => companies.includes(c.id)).map((c) => ({ value: String(c.id), label: format.name(c) }))} />}
      {error && <span className="text-sm text-danger">{error}</span>}
    </fieldset>
  );
}

function InviteDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const options = useQuery({ queryKey: ["user-options"], queryFn: usersApi.options });
  const [v, setV] = useState<InviteBody>({ email: "", full_name_ar: "", full_name_en: "", preferred_language: "ar", companies: [], default_company: null, assignments: [{ ...EMPTY_ASSIGNMENT }], employee: null });
  const save = useMutation({
    mutationFn: () => usersApi.invite({ ...v, assignments: v.assignments.filter((a) => a.role && a.company) }),
    onSuccess: async () => {
      await Promise.all(["users", "user-options"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  // the first role's own errors come nested: {"assignments": [{"role": ["…"]}]}
  const assignmentErrors = (save.error instanceof ApiError && (save.error.body as { assignments?: Record<string, string[]>[] } | undefined)?.assignments?.[0]) || {};
  const pickEmployee = (id: number | null) => {
    const e = options.data?.employees.find((x) => x.id === id);
    setV({ ...v, employee: id, ...(e ? { full_name_ar: v.full_name_ar || e.name_ar, full_name_en: v.full_name_en || e.name_en, email: v.email || e.email, companies: v.companies.includes(e.company) ? v.companies : [...v.companies, e.company], default_company: v.default_company ?? e.company } : {}) });
  };
  if (!options.data)
    return (
      <Dialog open onClose={onClose} title={t("users.add")}>
        <p className="text-muted">{options.isError ? t("common.loadFailed") : t("common.loading")}</p>
      </Dialog>
    );
  const o = options.data;
  return (
    <Dialog open size="lg" onClose={onClose} title={t("users.add")} footer={<Button variant="accent" disabled={save.isPending || !v.email.trim() || !v.full_name_ar.trim() || !v.companies.length} onClick={() => save.mutate()}>{t("users.invite")}</Button>}>
      <div className="flex flex-col gap-4">
        <Alert tone="info">{t("users.inviteNote")}</Alert>
        <FormSelect label={t("users.employee")} hint={t("users.employeeHint")} name="employee" placeholder={t("users.noEmployee")} value={v.employee ? String(v.employee) : ""} onChange={(e) => pickEmployee(Number(e.target.value) || null)} options={o.employees.map((e) => ({ value: String(e.id), label: `${format.pick({ ar: e.name_ar, en: e.name_en })} (${e.employee_no})` }))} error={errors.fields.employee} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label={t("users.fullNameAr")} name="full_name_ar" value={v.full_name_ar} onChange={(e) => setV({ ...v, full_name_ar: e.target.value })} error={errors.fields.full_name_ar} />
          <TextField label={t("users.fullNameEn")} name="full_name_en" dir="ltr" value={v.full_name_en} onChange={(e) => setV({ ...v, full_name_en: e.target.value })} error={errors.fields.full_name_en} />
          <TextField label={t("users.email")} name="email" type="email" dir="ltr" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} error={errors.fields.email} />
          <FormSelect label={t("users.language")} name="preferred_language" value={v.preferred_language} onChange={(e) => setV({ ...v, preferred_language: e.target.value as "ar" | "en" })} options={(["ar", "en"] as const).map((l) => ({ value: l, label: t(`languages.${l}`) }))} />
        </div>
        <CompanyPicker options={o} companies={v.companies} defaultCompany={v.default_company} onChange={(companies, def) => setV({ ...v, companies, default_company: def })} error={errors.fields.companies ?? errors.fields.default_company} />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-ink">{t("users.firstRole")}</legend>
          <AssignmentFields value={v.assignments[0]} onChange={(a) => setV({ ...v, assignments: [a] })} options={o} companies={v.companies} errors={Object.fromEntries(Object.entries(assignmentErrors).map(([k, m]) => [k, Array.isArray(m) ? m[0] : String(m)]))} />
        </fieldset>
        {(errors.general || errors.fields.role || errors.fields.company) && <Alert>{errors.fields.role ?? errors.fields.company ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

/** One user: names and language, the companies, the roles (given and taken one by one), the account. */
function UserDialog({ user, options, onChanged, onClose }: { user: UserRow; options: UserOptions; onChanged: (user: UserRow) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const { me } = useSession();
  const queryClient = useQueryClient();
  const self = me?.id === user.id;
  const locked = self || (user.is_superuser && !me?.is_tenant_admin);
  const [names, setNames] = useState({ full_name_ar: user.full_name_ar, full_name_en: user.full_name_en, preferred_language: user.preferred_language });
  const [companies, setCompanies] = useState({ list: user.companies.map((c) => c.id).filter((id) => options.companies.some((c) => c.id === id)), def: user.companies.find((c) => c.is_default)?.id ?? null });
  const [role, setRole] = useState<AssignmentBody>({ ...EMPTY_ASSIGNMENT, company: user.companies.find((c) => c.is_default)?.id ?? null });
  const [notice, setNotice] = useState<string | null>(null);
  const done = async (saved: UserRow) => {
    onChanged(saved);
    setNotice(t("users.saved"));
    await queryClient.invalidateQueries({ queryKey: ["users"] });
  };
  const saveNames = useMutation({ mutationFn: () => usersApi.update(user.id, names), onSuccess: done });
  const saveCompanies = useMutation({ mutationFn: () => usersApi.setCompanies(user.id, companies.list, companies.def ?? companies.list[0]), onSuccess: done });
  const addRole = useMutation({ mutationFn: () => usersApi.addRole(user.id, role), onSuccess: async (saved) => { setRole({ ...EMPTY_ASSIGNMENT, company: role.company }); await done(saved); } });
  const removeRole = useMutation({ mutationFn: (id: number) => usersApi.removeRole(user.id, id), onSuccess: done });
  const toggle = useMutation({ mutationFn: () => (user.is_active ? usersApi.deactivate(user.id) : usersApi.activate(user.id)), onSuccess: done });
  const link = useMutation({ mutationFn: () => usersApi.passwordLink(user.id), onSuccess: () => setNotice(t("users.linkSent", { email: user.email })) });
  const failed = [saveNames, saveCompanies, addRole, removeRole, toggle, link].find((m) => m.error)?.error;
  const errors = apiErrors(failed ?? null, t("common.saveFailed"));
  const roleErrors = apiErrors(addRole.error, t("common.saveFailed"));
  const userCompanies = user.companies.map((c) => c.id);
  return (
    <Dialog open size="lg" onClose={onClose} title={format.pick({ ar: user.full_name_ar, en: user.full_name_en }) || user.email}>
      <div className="flex flex-col gap-5">
        <p dir="ltr" className="self-end text-sm text-muted">{user.email}{user.employee && ` · ${user.employee.employee_no}`}</p>
        {self && <Alert tone="info">{t("users.selfNote")}</Alert>}
        {user.is_superuser && !me?.is_tenant_admin && <Alert tone="info">{t("users.superuserNote")}</Alert>}
        {notice && <Alert tone="info">{notice}</Alert>}
        {failed && <Alert>{errors.fields.detail ?? errors.general ?? errors.fields.role ?? errors.fields.company}</Alert>}

        <section aria-labelledby="user-names" className="flex flex-col gap-3">
          <h3 id="user-names" className="font-semibold text-ink">{t("users.profile")}</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <TextField label={t("users.fullNameAr")} name="full_name_ar" value={names.full_name_ar} onChange={(e) => setNames({ ...names, full_name_ar: e.target.value })} disabled={user.is_superuser && !me?.is_tenant_admin} />
            <TextField label={t("users.fullNameEn")} name="full_name_en" dir="ltr" value={names.full_name_en} onChange={(e) => setNames({ ...names, full_name_en: e.target.value })} disabled={user.is_superuser && !me?.is_tenant_admin} />
            <FormSelect label={t("users.language")} name="preferred_language" value={names.preferred_language} onChange={(e) => setNames({ ...names, preferred_language: e.target.value as "ar" | "en" })} options={(["ar", "en"] as const).map((l) => ({ value: l, label: t(`languages.${l}`) }))} disabled={user.is_superuser && !me?.is_tenant_admin} />
          </div>
          <Button size="sm" variant="outline" className="self-start" disabled={saveNames.isPending || (user.is_superuser && !me?.is_tenant_admin)} onClick={() => saveNames.mutate()}>{t("common.save")}</Button>
        </section>

        {!locked && (
          <section aria-labelledby="user-companies" className="flex flex-col gap-3">
            <h3 id="user-companies" className="font-semibold text-ink">{t("users.companies")}</h3>
            <CompanyPicker options={options} companies={companies.list} defaultCompany={companies.def} onChange={(list, def) => setCompanies({ list, def })} />
            <p className="text-sm text-muted">{t("users.companiesNote")}</p>
            <Button size="sm" variant="outline" className="self-start" disabled={saveCompanies.isPending || !companies.list.length} onClick={() => saveCompanies.mutate()}>{t("users.saveCompanies")}</Button>
          </section>
        )}

        <section aria-labelledby="user-roles" className="flex flex-col gap-3">
          <h3 id="user-roles" className="font-semibold text-ink">{t("users.roles")}</h3>
          {user.assignments.length === 0 ? <p className="text-sm text-muted">{t("users.noRoles")}</p> : (
            <ul className="flex flex-col gap-2">
              {user.assignments.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-white px-4 py-3 text-sm">
                  <span className="font-semibold text-ink">{format.name(a.role)}</span>
                  <span className="text-muted">{a.company ? format.name(a.company) : t("users.everyCompany")} · {t(`users.scopes.${a.scope}`)}{a.branch && ` · ${format.name(a.branch)}`}{a.department && ` · ${format.name(a.department)}`}</span>
                  {(a.valid_from || a.valid_to) && <span className="num text-muted">{t("users.period", { from: a.valid_from ? format.date(a.valid_from) : "…", to: a.valid_to ? format.date(a.valid_to) : "…" })}</span>}
                  {!a.current && <Pill tone="neutral">{t("users.notCurrent")}</Pill>}
                  {!locked && <Button size="sm" variant="ghost" className="ms-auto text-danger" disabled={removeRole.isPending} onClick={() => removeRole.mutate(a.id)}>{t("users.removeRole")}</Button>}
                </li>
              ))}
            </ul>
          )}
          {!locked && (
            <div className="flex flex-col gap-3 rounded-card bg-neutral-soft p-4">
              <AssignmentFields value={role} onChange={setRole} options={options} companies={userCompanies} errors={roleErrors.fields} />
              <Button size="sm" variant="accent" className="self-start" disabled={addRole.isPending || !role.role || !role.company} onClick={() => addRole.mutate()}>{t("users.addRole")}</Button>
            </div>
          )}
        </section>

        {!locked && (
          <section aria-labelledby="user-account" className="flex flex-col gap-3">
            <h3 id="user-account" className="font-semibold text-ink">{t("users.account")}</h3>
            <p className="text-sm text-muted">{user.has_password ? t("users.hasPassword") : t("users.noPassword")}</p>
            <div className="flex flex-wrap gap-2">
              {user.is_active && <Button size="sm" variant="outline" disabled={link.isPending} onClick={() => link.mutate()}>{user.has_password ? t("users.sendReset") : t("users.resendInvite")}</Button>}
              <Button size="sm" variant={user.is_active ? "ghost" : "accent"} className={user.is_active ? "text-danger" : undefined} disabled={toggle.isPending} onClick={() => toggle.mutate()}>{user.is_active ? t("users.deactivate") : t("users.activate")}</Button>
            </div>
            {user.is_active && <p className="text-sm text-muted">{t("users.deactivateNote")}</p>}
          </section>
        )}
      </div>
    </Dialog>
  );
}
