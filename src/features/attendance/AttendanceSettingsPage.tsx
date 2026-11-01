import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { attendance, type EmployeeGroup, type RamadanPeriod, SETTINGS_RULES, type SettingsRuleField, shifts, WORKING_HOURS } from "@/api/attendance";
import { hr } from "@/api/hr";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { DateInput } from "@/design/DateInput";
import { Dialog } from "@/design/Dialog";
import { CheckField, FormSelect, TextArea, TextField } from "@/design/Field";
import { Pill } from "@/design/Pill";
import { Tabs } from "@/design/Tabs";
import NoAccess from "@/features/misc/NoAccessPage";
import { Page } from "@/layout/Page";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

import { GeofencesTab } from "./GeofencesTab";
import { LaborValuesCard } from "@/features/setup/LaborValuesCard";

import { RotationsTab } from "./RotationsTab";
import { ShiftsTab } from "./ShiftsTab";


/** /settings/attendance — the Labor Law's working-hour limits (each with its article; every value is to be confirmed
 * against the official text: maximums that shifts are checked against, never anyone's hours, which come from their
 * shift), Ramadan periods (when, and who; the shifts carry their Ramadan times) and the company's employee groups. */
type Tab = "shifts" | "rotations" | "rules" | "geofences" | "ramadan" | "groups";
const TABS: Tab[] = ["shifts", "rotations", "rules", "geofences", "ramadan", "groups"];

export default function AttendanceSettingsPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const [params, setParams] = useSearchParams();
  const asked = params.get("tab") as Tab | null;
  const tab: Tab = asked && TABS.includes(asked) ? asked : "shifts";
  if (!can("attendance.manage")) return <NoAccess />;
  return (
    <Page
      title={t("attendanceSettings.title")}
      tabs={<Tabs label={t("attendanceSettings.title")} value={tab} onChange={(next) => setParams(next === "shifts" ? {} : { tab: next }, { replace: true })} items={TABS.map((id) => ({ id, label: t(`attendanceSettings.tabs.${id}`) }))} />}
    >
      <div className="flex flex-col gap-4">
        {tab === "shifts" && <ShiftsTab />}
        {tab === "rotations" && <RotationsTab />}
        {tab === "rules" && (
          <>
            <RulesCard />
            <LaborValuesCard fields={WORKING_HOURS} title={t("attendanceSettings.hours.title")} hint={t("attendanceSettings.hours.hint")} labels="attendanceSettings.hours.fields" also={["ramadan"]} />
          </>
        )}
        {tab === "geofences" && <GeofencesTab />}
        {tab === "ramadan" && <RamadanCard />}
        {tab === "groups" && <GroupsCard />}
      </div>
    </Page>
  );
}

// --- attendance rules (grace, punch window, rounding, half day) -----------------------------

function RulesCard() {
  const { t } = useTranslation();
  const scope = useScopeKey();
  const { me, can } = useSession();
  const queryClient = useQueryClient();
  const data = useQuery({ queryKey: ["attendance-settings", ...scope], queryFn: shifts.settings });
  const [account, setAccount] = useState<Record<string, string>>({});
  const [company, setCompany] = useState<Record<string, string>>({});
  const shared = Boolean(me?.is_tenant_admin || can("core.manage_companies")); // the account level applies everywhere
  const save = useMutation({
    mutationFn: ({ level, draft }: { level: "account" | "company"; draft: Record<string, string> }) =>
      shifts.saveSettings(level, Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v === "" ? null : k === "rounding_direction" ? v : k === "selfie_required" ? v === "true" : Number(v)]))),
    onSuccess: async (_d, { level }) => {
      (level === "account" ? setAccount : setCompany)({});
      await queryClient.invalidateQueries({ queryKey: ["attendance-settings"] });
      await queryClient.invalidateQueries({ queryKey: ["shifts"] });
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const d = data.data;
  const input = (level: "account" | "company", name: SettingsRuleField, label: string) => {
    const draft = level === "account" ? account : company;
    const change = level === "account" ? setAccount : setCompany;
    const stored = d?.[level][name];
    const value = draft[name] ?? (stored === null || stored === undefined ? "" : String(stored));
    const common = { label: `${label} · ${t(`attendanceSettings.hours.${level}`)}`, className: "[&_label]:sr-only", disabled: level === "account" && !shared };
    if (name === "selfie_required")
      return <FormSelect {...common} value={value} placeholder={level === "company" ? t("attendanceSettings.rules.inherit") : undefined} onChange={(e) => change((x) => ({ ...x, [name]: e.target.value }))} options={[{ value: "true", label: t("common.yes") }, { value: "false", label: t("common.no") }]} />;
    return name === "rounding_direction" ? (
      <FormSelect {...common} value={value} placeholder={level === "company" ? t("attendanceSettings.rules.inherit") : undefined} onChange={(e) => change((x) => ({ ...x, [name]: e.target.value }))} options={(["nearest", "up", "down"] as const).map((x) => ({ value: x, label: t(`attendanceSettings.rules.directions.${x}`) }))} />
    ) : (
      <TextField {...common} inputMode="numeric" dir="ltr" placeholder={level === "company" && d ? String(d.account[name] ?? "") : ""} value={value} onChange={(e) => change((x) => ({ ...x, [name]: e.target.value }))} error={save.variables?.level === level ? errors.fields[name] : undefined} />
    );
  };
  return (
    <Card
      variant="solid"
      title={t("attendanceSettings.rules.title")}
      subtitle={t("attendanceSettings.rules.hint")}
      action={
        <div className="flex gap-2">
          {shared && (
            <Button size="sm" variant="outline" disabled={!Object.keys(account).length || save.isPending} onClick={() => save.mutate({ level: "account", draft: account })}>
              {t("attendanceSettings.hours.saveAccount")}
            </Button>
          )}
          <Button size="sm" disabled={!Object.keys(company).length || save.isPending} onClick={() => save.mutate({ level: "company", draft: company })}>
            {t("attendanceSettings.hours.saveCompany")}
          </Button>
        </div>
      }
    >
      {!d ? (
        <p className="text-muted">{t("common.loading")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">{t("attendanceSettings.rules.title")}</caption>
            <thead>
              <tr className="text-muted">
                <th scope="col" className="py-2 text-start font-medium">{t("attendanceSettings.hours.rule")}</th>
                <th scope="col" className="py-2 text-start font-medium">{t("attendanceSettings.hours.account")}</th>
                <th scope="col" className="py-2 text-start font-medium">{t("attendanceSettings.hours.company")}</th>
                <th scope="col" className="py-2 text-start font-medium">{t("attendanceSettings.hours.applies")}</th>
              </tr>
            </thead>
            <tbody>
              {SETTINGS_RULES.map((name) => {
                const label = t(`attendanceSettings.rules.fields.${name}`);
                const effective = d.effective[name];
                return (
                  <tr key={name} className="border-t border-line">
                    <th scope="row" className="py-2 pe-3 text-start font-medium text-ink">{label}</th>
                    <td className="w-40 py-2 pe-3">{input("account", name, label)}</td>
                    <td className="w-40 py-2 pe-3">{input("company", name, label)}</td>
                    <td className="num py-2 font-semibold text-ink">{name === "rounding_direction" ? t(`attendanceSettings.rules.directions.${effective}`) : typeof effective === "boolean" ? t(effective ? "common.yes" : "common.no") : String(effective)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-sm text-muted">{t("attendanceSettings.rules.shiftHint")}</p>
        </div>
      )}
      {errors.general && save.error && <Alert className="mt-3">{errors.general}</Alert>}
    </Card>
  );
}

// --- working hours (labor settings) ---------------------------------------------------------

// --- Ramadan --------------------------------------------------------------------------------

function RamadanCard() {
  const { t, i18n } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const queryClient = useQueryClient();
  const periods = useQuery({ queryKey: ["ramadan", ...scope], queryFn: attendance.ramadan });
  const groups = useQuery({ queryKey: ["employee-groups", ...scope], queryFn: attendance.groups });
  const [editing, setEditing] = useState<RamadanPeriod | null>(null);
  const generate = useMutation({ mutationFn: attendance.generateRamadan, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ramadan"] }) });
  const groupName = (id: number) => {
    const g = (groups.data ?? []).find((x) => x.id === id);
    return g ? format.name(g) : `#${id}`;
  };
  return (
    <Card
      variant="solid"
      title={t("attendanceSettings.ramadan.title")}
      subtitle={t("attendanceSettings.ramadan.hint")}
      action={
        <Button size="sm" variant="outline" icon={<RefreshCw className="size-4" />} disabled={generate.isPending} onClick={() => generate.mutate()}>
          {t("attendanceSettings.ramadan.generate")}
        </Button>
      }
    >
      <ul aria-label={t("attendanceSettings.ramadan.title")} className="flex flex-col divide-y divide-line">
        {(periods.data ?? []).map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
            <span className="num min-w-24 font-semibold text-ink">{t("attendanceSettings.ramadan.year", { year: p.hijri_year })}</span>
            <span className="flex min-w-56 flex-col">
              <span className="num">{format.dateRange(p.start_date, p.end_date)}</span>
              <span className="num text-sm text-muted" dir="ltr">
                {p.start_date_hijri} – {p.end_date_hijri}
              </span>
            </span>
            <Pill tone={p.dates_confirmed ? "green" : "amber"}>{t(p.dates_confirmed ? "attendanceSettings.ramadan.confirmed" : "attendanceSettings.ramadan.forecast")}</Pill>
            <span className="text-sm text-muted">{p.applies_to === "everyone" ? t("attendanceSettings.ramadan.everyone") : new Intl.ListFormat(i18n.language).format(p.groups.map(groupName))}</span>
            <IconButton className="ms-auto" size="sm" variant="plain" label={t("attendanceSettings.ramadan.edit", { year: p.hijri_year })} icon={<Pencil />} onClick={() => setEditing(p)} />
          </li>
        ))}
      </ul>
      {editing && <RamadanDialog period={editing} groups={groups.data ?? []} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function RamadanDialog({ period, groups, onClose }: { period: RamadanPeriod; groups: EmployeeGroup[]; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const [v, setV] = useState({
    start_date: period.start_date,
    end_date: period.end_date,
    dates_confirmed: period.dates_confirmed,
    applies_to: period.applies_to,
    groups: period.groups,
    notes: period.notes,
  });
  const set = <K extends keyof typeof v>(key: K, value: (typeof v)[K]) => setV((x) => ({ ...x, [key]: value }));
  const save = useMutation({
    mutationFn: () =>
      attendance.saveRamadan(period.id, {
        ...v,
        groups: v.applies_to === "groups" ? v.groups : [],
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ramadan"] });
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={t("attendanceSettings.ramadan.edit", { year: period.hijri_year })}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <DateInput label={t("attendanceSettings.ramadan.start")} name="start_date" hijri value={v.start_date} onChange={(d) => set("start_date", d ?? "")} error={errors.fields.start_date} required />
        <DateInput label={t("attendanceSettings.ramadan.end")} name="end_date" hijri value={v.end_date} min={v.start_date} onChange={(d) => set("end_date", d ?? "")} error={errors.fields.end_date} required />
        <CheckField className="sm:col-span-2" label={t("attendanceSettings.ramadan.confirmDates")} checked={v.dates_confirmed} onChange={(e) => set("dates_confirmed", e.target.checked)} />
        <FormSelect
          className="sm:col-span-2"
          label={t("attendanceSettings.ramadan.appliesTo")}
          name="applies_to"
          value={v.applies_to}
          onChange={(e) => set("applies_to", e.target.value as RamadanPeriod["applies_to"])}
          options={(["everyone", "groups"] as const).map((x) => ({ value: x, label: t(`attendanceSettings.ramadan.applies.${x}`) }))}
        />
        {v.applies_to === "groups" && (
          <fieldset className="flex flex-col gap-2 sm:col-span-2">
            <legend className="mb-1 text-sm font-medium text-ink">{t("attendanceSettings.ramadan.groups")}</legend>
            {groups.length === 0 && <p className="text-sm text-muted">{t("attendanceSettings.groups.none")}</p>}
            {groups.map((g) => (
              <CheckField key={g.id} label={`${format.name(g)} · ${t("attendanceSettings.groups.count", { count: g.members.length })}`} checked={v.groups.includes(g.id)} onChange={(e) => set("groups", e.target.checked ? [...v.groups, g.id] : v.groups.filter((x) => x !== g.id))} />
            ))}
            {errors.fields.groups && <p className="text-sm text-danger">{errors.fields.groups}</p>}
          </fieldset>
        )}
        <TextArea className="sm:col-span-2" label={t("attendanceSettings.ramadan.notes")} name="notes" rows={2} value={v.notes} onChange={(e) => set("notes", e.target.value)} />
        {errors.general && <Alert className="sm:col-span-2">{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

// --- employee groups ------------------------------------------------------------------------

function GroupsCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const groups = useQuery({ queryKey: ["employee-groups", ...scope], queryFn: attendance.groups });
  const [editing, setEditing] = useState<EmployeeGroup | "new" | null>(null);
  return (
    <Card
      variant="solid"
      title={t("attendanceSettings.groups.title")}
      subtitle={t("attendanceSettings.groups.hint")}
      action={
        <Button size="sm" variant="accent" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
          {t("attendanceSettings.groups.add")}
        </Button>
      }
    >
      {groups.isSuccess && groups.data.length === 0 ? (
        <p className="text-sm text-muted">{t("attendanceSettings.groups.none")}</p>
      ) : (
        <ul aria-label={t("attendanceSettings.groups.title")} className="flex flex-col divide-y divide-line">
          {(groups.data ?? []).map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="flex min-w-48 flex-col">
                <span className="font-medium text-ink">{format.name(g)}</span>
                {g.description && <span className="text-sm text-muted">{g.description}</span>}
              </span>
              <Pill tone="teal">{t("attendanceSettings.groups.count", { count: g.members.length })}</Pill>
              {!g.is_active && <Pill tone="navy">{t("leaveSettings.off")}</Pill>}
              <IconButton className="ms-auto" size="sm" variant="plain" label={t("common.editNamed", { name: format.name(g) })} icon={<Pencil />} onClick={() => setEditing(g)} />
            </li>
          ))}
        </ul>
      )}
      {editing && <GroupDialog group={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function GroupDialog({ group, onClose }: { group?: EmployeeGroup; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const queryClient = useQueryClient();
  const [v, setV] = useState({ name_ar: group?.name_ar ?? "", name_en: group?.name_en ?? "", description: group?.description ?? "", is_active: group?.is_active ?? true });
  const [members, setMembers] = useState(group?.members ?? []);
  const [search, setSearch] = useState("");
  const found = useQuery({ queryKey: ["employee-groups", "search", search, ...scope], queryFn: () => hr.searchEmployees(search), enabled: search.trim().length > 0, placeholderData: (previous) => previous });
  const set = <K extends keyof typeof v>(key: K, value: (typeof v)[K]) => setV((x) => ({ ...x, [key]: value }));
  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: ["employee-groups"] });
    onClose();
  };
  const save = useMutation({ mutationFn: () => attendance.saveGroup({ ...v, members: members.map((m) => m.id) }, group?.id), onSuccess: done });
  const remove = useMutation({ mutationFn: () => attendance.deleteGroup(group!.id), onSuccess: done });
  const errors = apiErrors(save.error ?? remove.error, t("common.saveFailed"));
  const candidates = (search.trim() ? (found.data?.results ?? []) : []).filter((e) => !members.some((m) => m.id === e.id));
  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={group ? t("attendanceSettings.groups.edit") : t("attendanceSettings.groups.add")}
      footer={
        <>
          {group && (
            <Button variant="outline" className="me-auto" disabled={remove.isPending} onClick={() => remove.mutate()}>
              {t("common.delete")}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!v.name_ar.trim() || save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t("letters.nameAr")} name="name_ar" value={v.name_ar} onChange={(e) => set("name_ar", e.target.value)} error={errors.fields.name_ar} required />
        <TextField label={t("letters.nameEn")} name="name_en" dir="ltr" value={v.name_en} onChange={(e) => set("name_en", e.target.value)} />
        <TextField className="sm:col-span-2" label={t("attendanceSettings.groups.description")} name="description" value={v.description} onChange={(e) => set("description", e.target.value)} />
        <CheckField label={t("leaveSettings.active")} checked={v.is_active} onChange={(e) => set("is_active", e.target.checked)} />
        <fieldset className="flex flex-col gap-3 sm:col-span-2">
          <legend className="mb-1 font-medium text-ink">{t("attendanceSettings.groups.members", { count: members.length })}</legend>
          <ul aria-label={t("attendanceSettings.groups.members", { count: members.length })} className="flex flex-wrap gap-2">
            {members.map((m) => (
              <li key={m.id}>
                <span className="flex h-8 items-center gap-1 rounded-full bg-teal-soft pe-1 ps-3 text-sm text-teal-ink">
                  {format.name(m)} <span className="num text-xs opacity-70">{m.employee_no}</span>
                  <IconButton size="xs" variant="plain" tooltip={false} label={t("attendanceSettings.groups.remove", { name: format.name(m) })} icon={<X />} onClick={() => setMembers(members.filter((x) => x.id !== m.id))} />
                </span>
              </li>
            ))}
          </ul>
          <TextField label={t("attendanceSettings.groups.find")} type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
          {candidates.length > 0 && (
            <ul className="flex max-h-48 flex-col overflow-y-auto rounded-card border border-line">
              {candidates.map((e) => (
                <li key={e.id}>
                  <button type="button" className="flex w-full cursor-pointer items-center justify-between px-4 py-2 text-start text-sm hover:bg-neutral-soft" onClick={() => setMembers([...members, { id: e.id, name_ar: e.name_ar, name_en: e.name_en, employee_no: e.employee_no }])}>
                    <span>{format.name(e)}</span>
                    <span className="num text-muted">{e.employee_no}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {errors.fields.members && <p className="text-sm text-danger">{errors.fields.members}</p>}
        </fieldset>
        {errors.general && <Alert className="sm:col-span-2">{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
