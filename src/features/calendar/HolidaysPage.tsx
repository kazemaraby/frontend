import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Pencil, Plus, Power, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { hr } from "@/api/hr";
import { calendar, type Holiday, type HolidayKind, type HolidayRule, type Weekday } from "@/api/calendar";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { DateInput } from "@/design/DateInput";
import { Dialog } from "@/design/Dialog";
import { CheckField, FormSelect, TextField } from "@/design/Field";
import { Pill } from "@/design/Pill";
import { Tabs } from "@/design/Tabs";
import NoAccess from "@/features/misc/NoAccessPage";
import { Page } from "@/layout/Page";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

type Tab = "holidays" | "rules" | "weekend";
const KINDS: HolidayKind[] = ["eid_al_fitr", "eid_al_adha", "national_day", "founding_day", "other"];
const WEEK: Weekday[] = [7, 1, 2, 3, 4, 5, 6]; // shown Sunday first

/** /settings/holidays — public holidays per year, the rules that make them, and the work week (#70).
 * Shared (all-companies) rows need leave.manage_calendar over every company; the API enforces it. */
export default function HolidaysPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "holidays";
  const access = useQuery({ queryKey: ["calendar", "access"], queryFn: calendar.access });
  if (!can("leave.manage_calendar")) return <NoAccess />;
  const shared = Boolean(access.data?.shared);
  return (
    <Page
      title={t("holidays.title")}
      tabs={
        <Tabs
          label={t("holidays.title")}
          value={tab}
          onChange={(next) => setParams({ tab: next }, { replace: true })}
          items={(["holidays", "rules", "weekend"] as const).map((id) => ({ id, label: t(`holidays.tabs.${id}`) }))}
        />
      }
    >
      {tab === "holidays" && <HolidaysTab shared={shared} />}
      {tab === "rules" && <RulesTab shared={shared} />}
      {tab === "weekend" && <WeekendTab shared={shared} />}
    </Page>
  );
}

const ScopePill = ({ scope }: { scope: "company" | "tenant" }) => {
  const { t } = useTranslation();
  return <Pill tone={scope === "company" ? "lavender" : "neutral"}>{t(`holidays.scope.${scope}`)}</Pill>;
};

// --- holidays of a year ---------------------------------------------------------------------------

function HolidaysTab({ shared }: { shared: boolean }) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const queryClient = useQueryClient();
  const { company } = useSession();
  const [year, setYear] = useState(new Date().getFullYear());
  const [editing, setEditing] = useState<Holiday | "new" | null>(null);
  const rows = useQuery({ queryKey: ["calendar", "holidays", year, ...scope], queryFn: () => calendar.holidays(year, true) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["calendar"] });
  const generate = useMutation({ mutationFn: () => calendar.generate(year), onSuccess: refresh });
  const toggle = useMutation({
    mutationFn: async (h: Holiday) => {
      if (h.is_active) await calendar.deleteHoliday(h.id); // a rule's holiday is switched off, a hand-made one removed
      else await calendar.updateHoliday(h.id, { is_active: true });
    },
    onSuccess: refresh,
  });
  const editable = (h: Holiday) => h.scope === "company" || shared;
  const branchName = (id: number) => format.name(company?.branches.find((b) => b.id === id) ?? { name_ar: `#${id}`, name_en: "" });
  const Prev = format.dir === "rtl" ? ChevronRight : ChevronLeft;
  const Next = format.dir === "rtl" ? ChevronLeft : ChevronRight;

  const columns: Column<Holiday>[] = [
    {
      id: "name",
      header: t("holidays.columns.name"),
      cell: (h) => (
        <span className="flex flex-col">
          <span className="font-medium">{format.name(h)}</span>
          {h.note && <span className="text-sm text-muted">{h.note}</span>}
        </span>
      ),
    },
    {
      id: "dates",
      header: t("holidays.columns.dates"),
      cell: (h) => (
        <span className="num flex flex-col">
          <span>{format.dateRange(h.start_date, h.end_date)}</span>
          <span className="text-xs text-muted">
            {format.hijri(h.start_date)}
            {h.days > 1 ? ` – ${format.hijri(h.end_date)}` : ""}
          </span>
        </span>
      ),
    },
    { id: "days", header: t("holidays.columns.days"), cell: (h) => <span className="num">{format.number(h.days)}</span> },
    {
      id: "applies",
      header: t("holidays.columns.appliesTo"),
      cell: (h) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <ScopePill scope={h.scope} />
          {h.branches.map((id) => <Pill key={id} tone="sky">{branchName(id)}</Pill>)}
          {h.country && <span className="text-xs text-muted">{h.country}</span>}
        </span>
      ),
    },
    {
      id: "state",
      header: t("holidays.columns.state"),
      cell: (h) => (h.is_active ? <Pill tone="green">{t("holidays.on")}</Pill> : <Pill tone="navy">{t("holidays.off")}</Pill>),
    },
    {
      id: "actions",
      header: <span className="sr-only">{t("common.actions")}</span>,
      cell: (h) =>
        editable(h) && (
          <span className="flex justify-end gap-1">
            <IconButton size="sm" variant="plain" label={t("common.editNamed", { name: format.name(h) })} icon={<Pencil />} onClick={() => setEditing(h)} />
            <IconButton
              size="sm"
              variant={h.is_active ? "danger" : "plain"}
              label={h.is_active ? t("holidays.switchOff", { name: format.name(h) }) : t("holidays.switchOn", { name: format.name(h) })}
              icon={<Power />}
              onClick={() => toggle.mutate(h)}
            />
          </span>
        ),
    },
  ];

  return (
    <Card
      variant="solid"
      title={
        <span className="flex items-center gap-2">
          <IconButton size="xs" variant="soft" label={t("holidays.previousYear")} icon={<Prev />} onClick={() => setYear(year - 1)} tooltip={false} />
          <span className="num">{year}</span>
          <IconButton size="xs" variant="soft" label={t("holidays.nextYear")} icon={<Next />} onClick={() => setYear(year + 1)} tooltip={false} />
        </span>
      }
      subtitle={t("holidays.yearHint")}
      action={
        <>
          <Button size="sm" variant="outline" icon={<RefreshCw className="size-4" />} disabled={generate.isPending} onClick={() => generate.mutate()}>
            {t("holidays.generate")}
          </Button>
          <Button size="sm" variant="accent" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
            {t("holidays.add")}
          </Button>
        </>
      }
    >
      {generate.data && <Alert tone="info" className="mb-3">{t("holidays.generated", { count: generate.data.created })}</Alert>}
      {(generate.error || toggle.error) && <Alert className="mb-3">{apiErrors(generate.error ?? toggle.error, t("common.saveFailed")).general}</Alert>}
      <DataTable
        caption={t("holidays.tabs.holidays")}
        columns={columns}
        rows={rows.data?.results ?? []}
        rowKey={(h) => String(h.id)}
        loading={rows.isPending}
        empty={t("holidays.none")}
        minWidth={820}
      />
      {editing && <HolidayDialog holiday={editing === "new" ? undefined : editing} year={year} shared={shared} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function HolidayDialog({ holiday, year, shared, onClose }: { holiday?: Holiday; year: number; shared: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const { company } = useSession();
  const [values, setValues] = useState({
    name_ar: holiday?.name_ar ?? "",
    name_en: holiday?.name_en ?? "",
    kind: holiday?.kind ?? ("other" as HolidayKind),
    start_date: holiday?.start_date ?? `${year}-01-01`,
    end_date: holiday?.end_date ?? `${year}-01-01`,
    scope: holiday?.scope ?? ("company" as "company" | "tenant"),
    branches: holiday?.branches ?? [],
    is_active: holiday?.is_active ?? true,
    note: holiday?.note ?? "",
  });
  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => setValues((v) => ({ ...v, [key]: value }));
  const save = useMutation({
    mutationFn: () => {
      const body = { ...values, branches: values.scope === "company" ? values.branches : [] };
      return holiday ? calendar.updateHoliday(holiday.id, body) : calendar.createHoliday(body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["calendar"] });
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={holiday ? t("holidays.edit") : t("holidays.add")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={save.isPending || !values.name_ar.trim()} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {holiday?.rule && <Alert tone="info">{t("holidays.fromRule")}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("master.name_ar")} name="name_ar" value={values.name_ar} onChange={(e) => set("name_ar", e.target.value)} error={errors.fields.name_ar} required />
          <TextField label={t("master.name_en")} name="name_en" dir="ltr" value={values.name_en} onChange={(e) => set("name_en", e.target.value)} />
          <DateInput label={t("holidays.from")} name="start_date" hijri value={values.start_date} onChange={(d) => set("start_date", d ?? "")} error={errors.fields.start_date} required />
          <DateInput label={t("holidays.to")} name="end_date" hijri value={values.end_date} min={values.start_date} onChange={(d) => set("end_date", d ?? "")} error={errors.fields.end_date} required />
          <FormSelect label={t("holidays.kind")} value={values.kind} onChange={(e) => set("kind", e.target.value as HolidayKind)} options={KINDS.map((k) => ({ value: k, label: t(`holidays.kinds.${k}`) }))} />
          <FormSelect
            label={t("holidays.appliesTo")}
            value={values.scope}
            disabled={Boolean(holiday) || !shared}
            onChange={(e) => set("scope", e.target.value as "company" | "tenant")}
            options={(["company", "tenant"] as const).map((s) => ({ value: s, label: t(`holidays.scope.${s}`) }))}
            error={errors.fields.scope}
          />
        </div>
        {values.scope === "company" && (company?.branches.length ?? 0) > 1 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-ink">{t("holidays.onlyBranches")}</legend>
            {company!.branches.map((b) => (
              <CheckField
                key={b.id}
                label={format.name(b)}
                checked={values.branches.includes(b.id)}
                onChange={(e) => set("branches", e.target.checked ? [...values.branches, b.id] : values.branches.filter((x) => x !== b.id))}
              />
            ))}
            {errors.fields.branches && <p className="text-sm text-danger">{errors.fields.branches}</p>}
          </fieldset>
        )}
        <TextField label={t("holidays.note")} value={values.note} onChange={(e) => set("note", e.target.value)} />
        {holiday && <CheckField label={t("holidays.on")} checked={values.is_active} onChange={(e) => set("is_active", e.target.checked)} />}
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

// --- rules ----------------------------------------------------------------------------------------

function RulesTab({ shared }: { shared: boolean }) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const [editing, setEditing] = useState<HolidayRule | "new" | null>(null);
  const rows = useQuery({ queryKey: ["calendar", "rules", ...scope], queryFn: calendar.rules });
  const when = (r: HolidayRule) =>
    r.calendar === "hijri"
      ? t("holidays.rules.hijriDay", { day: format.number(r.day), month: t(`holidays.hijriMonths.${r.month}`) })
      : format.date(`2028-${String(r.month).padStart(2, "0")}-${String(r.day).padStart(2, "0")}`, "dayMonth");
  const columns: Column<HolidayRule>[] = [
    { id: "name", header: t("holidays.columns.name"), cell: (r) => <span className="font-medium">{format.name(r)}</span> },
    { id: "when", header: t("holidays.rules.when"), cell: (r) => <span className="num">{when(r)}</span> },
    { id: "days", header: t("holidays.columns.days"), cell: (r) => <span className="num">{format.number(r.length_days)}</span> },
    { id: "scope", header: t("holidays.columns.appliesTo"), cell: (r) => <ScopePill scope={r.scope} /> },
    { id: "source", header: t("holidays.rules.source"), cell: (r) => <span className="text-sm text-muted">{r.source}</span> },
    {
      id: "actions",
      header: <span className="sr-only">{t("common.actions")}</span>,
      cell: (r) =>
        (r.scope === "company" || shared) && (
          <IconButton size="sm" variant="plain" label={t("common.editNamed", { name: format.name(r) })} icon={<Pencil />} onClick={() => setEditing(r)} />
        ),
    },
  ];
  return (
    <Card
      variant="solid"
      title={t("holidays.tabs.rules")}
      subtitle={t("holidays.rules.hint")}
      action={
        <Button size="sm" variant="accent" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
          {t("holidays.rules.add")}
        </Button>
      }
    >
      <DataTable caption={t("holidays.tabs.rules")} columns={columns} rows={rows.data?.results ?? []} rowKey={(r) => String(r.id)} loading={rows.isPending} empty={t("holidays.none")} minWidth={820} />
      {editing && <RuleDialog rule={editing === "new" ? undefined : editing} shared={shared} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function RuleDialog({ rule, shared, onClose }: { rule?: HolidayRule; shared: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const [values, setValues] = useState({
    name_ar: rule?.name_ar ?? "",
    name_en: rule?.name_en ?? "",
    kind: rule?.kind ?? ("other" as HolidayKind),
    calendar: rule?.calendar ?? ("gregorian" as "gregorian" | "hijri"),
    month: String(rule?.month ?? 1),
    day: String(rule?.day ?? 1),
    length_days: String(rule?.length_days ?? 1),
    is_active: rule?.is_active ?? true,
    source: rule?.source ?? "",
    scope: rule?.scope ?? ("company" as "company" | "tenant"),
  });
  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => setValues((v) => ({ ...v, [key]: value }));
  const save = useMutation({
    mutationFn: () => {
      const body = { ...values, month: Number(values.month), day: Number(values.day), length_days: Number(values.length_days) };
      return rule ? calendar.updateRule(rule.id, body) : calendar.createRule(body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["calendar"] });
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: values.calendar === "hijri" ? t(`holidays.hijriMonths.${i + 1}`) : format.months()[i],
  }));
  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={rule ? t("holidays.rules.edit") : t("holidays.rules.add")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={save.isPending || !values.name_ar.trim()} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Alert tone="info">{t("holidays.rules.editNote")}</Alert>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("master.name_ar")} value={values.name_ar} onChange={(e) => set("name_ar", e.target.value)} error={errors.fields.name_ar} required />
          <TextField label={t("master.name_en")} dir="ltr" value={values.name_en} onChange={(e) => set("name_en", e.target.value)} />
          <FormSelect label={t("holidays.rules.calendar")} value={values.calendar} onChange={(e) => set("calendar", e.target.value as "gregorian" | "hijri")} options={(["gregorian", "hijri"] as const).map((c) => ({ value: c, label: t(`holidays.rules.calendars.${c}`) }))} />
          <FormSelect label={t("holidays.kind")} value={values.kind} onChange={(e) => set("kind", e.target.value as HolidayKind)} options={KINDS.map((k) => ({ value: k, label: t(`holidays.kinds.${k}`) }))} />
          <FormSelect label={t("holidays.rules.month")} value={values.month} onChange={(e) => set("month", e.target.value)} options={months} error={errors.fields.month} />
          <TextField label={t("holidays.rules.day")} inputMode="numeric" dir="ltr" value={values.day} onChange={(e) => set("day", e.target.value)} hint={values.calendar === "hijri" ? t("holidays.rules.hijriHint") : undefined} error={errors.fields.day} />
          <TextField label={t("holidays.columns.days")} inputMode="numeric" dir="ltr" value={values.length_days} onChange={(e) => set("length_days", e.target.value)} error={errors.fields.length_days} />
          <FormSelect label={t("holidays.appliesTo")} value={values.scope} disabled={Boolean(rule) || !shared} onChange={(e) => set("scope", e.target.value as "company" | "tenant")} options={(["company", "tenant"] as const).map((s) => ({ value: s, label: t(`holidays.scope.${s}`) }))} />
        </div>
        <TextField label={t("holidays.rules.source")} value={values.source} onChange={(e) => set("source", e.target.value)} />
        <CheckField label={t("holidays.on")} checked={values.is_active} onChange={(e) => set("is_active", e.target.checked)} />
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

// --- work week ------------------------------------------------------------------------------------

function DayPicker({ label, value, onChange }: { label: string; value: number[]; onChange: (days: number[]) => void }) {
  const { t } = useTranslation();
  return (
    <fieldset>
      <legend className="sr-only">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {WEEK.map((day) => {
          const on = value.includes(day);
          return (
            <label key={day} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${on ? "border-navy bg-navy text-white" : "border-line bg-white text-ink"}`}>
              <input type="checkbox" className="sr-only" checked={on} onChange={(e) => onChange(e.target.checked ? [...value, day].sort() : value.filter((d) => d !== day))} />
              {t(`holidays.weekdays.${day}`)}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function WeekendTab({ shared }: { shared: boolean }) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const queryClient = useQueryClient();
  const { can } = useSession();
  const settings = useQuery({ queryKey: ["calendar", "settings", ...scope], queryFn: calendar.settings });
  const branches = useQuery({ queryKey: ["branches", "weekend", ...scope], queryFn: hr.branches });
  const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: ["calendar"] }), queryClient.invalidateQueries({ queryKey: ["branches"] })]);
  const saveLevel = useMutation({
    mutationFn: ({ level, days }: { level: "account" | "company"; days: Weekday[] | null }) => calendar.updateSettings(level, days),
    onSuccess: refresh,
  });
  const saveBranch = useMutation({ mutationFn: ({ id, days }: { id: number; days: number[] | null }) => hr.updateBranch(id, { weekend_days: days }), onSuccess: refresh });
  const error = saveLevel.error ?? saveBranch.error;
  const data = settings.data;
  const names = (days: number[]) => (days.length ? new Intl.ListFormat(format.lang).format(WEEK.filter((d) => days.includes(d)).map((d) => t(`holidays.weekdays.${d}`))) : t("holidays.weekend.none"));
  if (!data) return <Card><p className="text-muted">{t("common.loading")}</p></Card>;
  const companyDays = data.company.weekend_days;
  return (
    <div className="flex flex-col gap-4">
      {error && <Alert>{apiErrors(error, t("common.saveFailed")).general ?? Object.values(apiErrors(error, "").fields)[0]}</Alert>}
      <Card variant="solid" title={t("holidays.weekend.account")} subtitle={t("holidays.weekend.accountHint")}>
        {shared ? (
          <DayPicker label={t("holidays.weekend.account")} value={data.account.weekend_days} onChange={(days) => saveLevel.mutate({ level: "account", days: days as Weekday[] })} />
        ) : (
          <p>{names(data.account.weekend_days)}</p>
        )}
      </Card>
      <Card variant="solid" title={t("holidays.weekend.company")} subtitle={t("holidays.weekend.companyHint")}>
        <CheckField label={t("holidays.weekend.sameAsAccount")} checked={companyDays === null} onChange={(e) => saveLevel.mutate({ level: "company", days: e.target.checked ? null : data.account.weekend_days })} />
        {companyDays !== null && (
          <div className="mt-3">
            <DayPicker label={t("holidays.weekend.company")} value={companyDays} onChange={(days) => saveLevel.mutate({ level: "company", days: days as Weekday[] })} />
          </div>
        )}
      </Card>
      <Card variant="solid" title={t("holidays.weekend.branches")} subtitle={t("holidays.weekend.branchesHint")}>
        <ul className="flex flex-col divide-y divide-line">
          {(branches.data?.results ?? []).map((b) => (
            <li key={b.id} className="flex flex-col gap-2 py-3">
              <p className="font-medium">{format.name(b)}</p>
              {can("core.manage_org") ? (
                <>
                  <CheckField label={t("holidays.weekend.sameAsCompany")} checked={b.weekend_days === null} onChange={(e) => saveBranch.mutate({ id: b.id, days: e.target.checked ? null : data.effective.weekend_days })} />
                  {b.weekend_days !== null && <DayPicker label={format.name(b)} value={b.weekend_days} onChange={(days) => saveBranch.mutate({ id: b.id, days })} />}
                </>
              ) : (
                <p className="text-sm text-muted">{names(b.weekend_days ?? data.effective.weekend_days)}</p>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
