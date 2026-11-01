import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, Upload } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";

import {
  type Band,
  type Entitlement,
  leave,
  type LeaveCategory,
  type LeaveColor,
  type LeavePolicy,
  type LeaveSettings,
  type LeaveType,
  type SelfServiceSettings,
  type Tier,
} from "@/api/leave";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { Dialog } from "@/design/Dialog";
import { CheckField, FormSelect, TextField } from "@/design/Field";
import { Pill } from "@/design/Pill";
import { Tabs } from "@/design/Tabs";
import NoAccess from "@/features/misc/NoAccessPage";
import { Page } from "@/layout/Page";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

type Tab = "types" | "year" | "limits";
const ENTITLEMENTS: Entitlement[] = ["per_year", "per_occasion", "per_service", "unlimited"];
const CATEGORIES: LeaveCategory[] = ["annual", "sick", "maternity", "paternity", "marriage", "bereavement", "hajj", "exam", "iddah", "unpaid", "other"];
const COLORS: LeaveColor[] = ["teal", "pink", "lavender", "orange", "sky", "amber", "green", "neutral"];

/** /settings/leave — leave types and their policies (#67), the leave year, and self-service limits (decision 11).
 * The account's policy applies to every company; a company may have its own instead. */
export default function LeaveSettingsPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "types";
  const access = useQuery({ queryKey: ["leave", "access"], queryFn: leave.access });
  if (!can("leave.manage_types")) return <NoAccess />;
  const shared = Boolean(access.data?.shared);
  return (
    <Page
      title={t("leaveSettings.title")}
      tabs={
        <Tabs
          label={t("leaveSettings.title")}
          value={tab}
          onChange={(next) => setParams({ tab: next }, { replace: true })}
          items={(["types", "year", "limits"] as const).map((id) => ({ id, label: t(`leaveSettings.tabs.${id}`) }))}
        />
      }
    >
      {tab === "types" && <TypesTab shared={shared} />}
      {tab === "year" && <LeaveYearTab shared={shared} />}
      {tab === "limits" && <LimitsTab shared={shared} />}
    </Page>
  );
}

/** "21 days a year · 30 from 5 years" in the active language. */
function useSummary() {
  const { t } = useTranslation();
  const format = useFormat();
  const days = (value: string | number | null) => (value === null ? "—" : format.number(Number(value)));
  return (p: LeavePolicy) => {
    const parts: string[] = [];
    if (p.entitlement === "per_year") {
      if (p.bands.length) {
        parts.push(p.bands.map((b, i) => (i === 0 ? t("leaveSettings.summary.perYear", { days: days(b.days) }) : t("leaveSettings.summary.band", { days: days(b.days), years: days(b.min_service_years) }))).join(" · "));
      } else parts.push(t("leaveSettings.summary.perYear", { days: days(p.days) }));
    } else if (p.entitlement === "per_occasion") {
      parts.push(p.days ? t("leaveSettings.summary.perOccasion", { days: days(p.days) }) : t("leaveSettings.summary.actualDays"));
    } else if (p.entitlement === "per_service") {
      parts.push(t("leaveSettings.summary.perService", { days: days(p.days), times: p.max_times ?? "∞" }));
    } else parts.push(t("leaveSettings.summary.unlimited"));
    if (p.tiers.length) parts.push(p.tiers.map((tier) => `${format.number(tier.days)} @ ${format.number(Number(tier.pay_percent))}%`).join(" · "));
    return parts.join(" — ");
  };
}

// --- types and policies ---------------------------------------------------------------------------

function TypesTab({ shared }: { shared: boolean }) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const queryClient = useQueryClient();
  const summary = useSummary();
  const { can } = useSession();
  const [editingPolicy, setEditingPolicy] = useState<LeaveType | null>(null);
  const [editingType, setEditingType] = useState<LeaveType | "new" | null>(null);
  const types = useQuery({ queryKey: ["leave", "types", ...scope], queryFn: () => leave.types() });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["leave"] });
  const own = useMutation({ mutationFn: (type: LeaveType) => leave.ownPolicy(type.id), onSuccess: refresh });
  const revert = useMutation({ mutationFn: (type: LeaveType) => leave.deletePolicy(type.policy!.id), onSuccess: refresh });
  const error = own.error ?? revert.error;

  const columns: Column<LeaveType>[] = [
    {
      id: "name",
      header: t("leaveSettings.columns.type"),
      cell: (type) => (
        <span className="flex flex-wrap items-center gap-2">
          <Pill tone={type.color}>{format.name(type)}</Pill>
          {type.gender && <span className="text-xs text-muted">{t(`leaveSettings.gender.${type.gender}`)}</span>}
          {!type.is_active && <Pill tone="navy">{t("leaveSettings.off")}</Pill>}
        </span>
      ),
    },
    { id: "rule", header: t("leaveSettings.columns.entitlement"), cell: (type) => <span className="num text-sm">{type.policy ? summary(type.policy) : "—"}</span> },
    {
      id: "count",
      header: t("leaveSettings.columns.counting"),
      cell: (type) =>
        type.policy && (
          <span className="text-sm">
            {t(`leaveSettings.count.${type.policy.count_mode}`)}
            {!type.policy.paid && <span className="text-muted"> · {t("leaveSettings.unpaid")}</span>}
          </span>
        ),
    },
    {
      id: "scope",
      header: t("leaveSettings.columns.policy"),
      cell: (type) =>
        type.policy_scope && (
          <span className="flex flex-wrap items-center gap-2">
            <Pill tone={type.policy_scope === "company" ? "lavender" : "neutral"}>{t(`leaveSettings.scope.${type.policy_scope}`)}</Pill>
            {type.policy_scope === "tenant" ? (
              <Button size="sm" variant="ghost" disabled={own.isPending} onClick={() => own.mutate(type)}>
                {t("leaveSettings.ownPolicy")}
              </Button>
            ) : (
              <Button size="sm" variant="ghost" disabled={revert.isPending} onClick={() => revert.mutate(type)}>
                {t("leaveSettings.backToAccount")}
              </Button>
            )}
          </span>
        ),
    },
    {
      id: "actions",
      header: <span className="sr-only">{t("common.actions")}</span>,
      cell: (type) => (
        <span className="flex justify-end gap-1">
          {type.policy && (type.policy_scope === "company" || shared) && (
            <IconButton size="sm" variant="plain" label={t("leaveSettings.editPolicy", { name: format.name(type) })} icon={<Pencil />} onClick={() => setEditingPolicy(type)} />
          )}
          {shared && (
            <Button size="sm" variant="ghost" onClick={() => setEditingType(type)}>
              {t("leaveSettings.editType")}
            </Button>
          )}
        </span>
      ),
    },
  ];

  return (
    <Card
      variant="solid"
      title={t("leaveSettings.tabs.types")}
      subtitle={t("leaveSettings.typesHint")}
      action={
        <>
          {can("leave.manage_balances") && (
            <Link to="/settings/leave/import" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong bg-white px-4 text-sm text-ink hover:bg-neutral-soft">
              <Upload aria-hidden="true" className="size-4" />
              {t("leaveTab.import.open")}
            </Link>
          )}
          {shared && (
            <Button size="sm" variant="accent" icon={<Plus className="size-4" />} onClick={() => setEditingType("new")}>
              {t("leaveSettings.addType")}
            </Button>
          )}
        </>
      }
    >
      {error && <Alert className="mb-3">{apiErrors(error, t("common.saveFailed")).general ?? t("common.saveFailed")}</Alert>}
      <DataTable caption={t("leaveSettings.tabs.types")} columns={columns} rows={types.data ?? []} rowKey={(type) => String(type.id)} loading={types.isPending} empty={t("leaveSettings.none")} minWidth={960} />
      {editingPolicy?.policy && <PolicyDialog type={editingPolicy} policy={editingPolicy.policy} onClose={() => setEditingPolicy(null)} />}
      {editingType && <TypeDialog type={editingType === "new" ? undefined : editingType} onClose={() => setEditingType(null)} />}
    </Card>
  );
}

const asText = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));
const asNumber = (v: string) => (v.trim() === "" ? null : Number(v));
const asDecimal = (v: string) => (v.trim() === "" ? null : v.trim());

function PolicyDialog({ type, policy, onClose }: { type: LeaveType; policy: LeavePolicy; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const [p, setP] = useState(() => ({
    entitlement: policy.entitlement,
    days: asText(policy.days),
    count_mode: policy.count_mode,
    holidays_extend: policy.holidays_extend,
    paid: policy.paid,
    tier_window_days: asText(policy.tier_window_days),
    min_service_days: asText(policy.min_service_days),
    max_times: asText(policy.max_times),
    max_days_per_request: asText(policy.max_days_per_request),
    within_days_of_event: asText(policy.within_days_of_event),
    min_notice_days: asText(policy.min_notice_days),
    requires_attachment: policy.requires_attachment,
    carry_forward_max_days: asText(policy.carry_forward_max_days),
    service_suspends_after_days: asText(policy.service_suspends_after_days),
    source: policy.source,
  }));
  const [bands, setBands] = useState<Band[]>(policy.bands);
  const [tiers, setTiers] = useState<Tier[]>(policy.tiers);
  const set = <K extends keyof typeof p>(key: K, value: (typeof p)[K]) => setP((v) => ({ ...v, [key]: value }));
  const save = useMutation({
    mutationFn: () =>
      leave.updatePolicy(policy.id, {
        ...p,
        days: asDecimal(p.days),
        tier_window_days: asNumber(p.tier_window_days),
        min_service_days: asNumber(p.min_service_days),
        max_times: asNumber(p.max_times),
        max_days_per_request: asNumber(p.max_days_per_request),
        within_days_of_event: asNumber(p.within_days_of_event),
        min_notice_days: asNumber(p.min_notice_days),
        carry_forward_max_days: asDecimal(p.carry_forward_max_days),
        service_suspends_after_days: asNumber(p.service_suspends_after_days),
        bands: p.entitlement === "per_year" ? bands : [],
        tiers: p.tier_window_days.trim() ? tiers : [],
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["leave"] });
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const number = (key: keyof typeof p, label: string, hint?: string) => (
    <TextField label={label} inputMode="decimal" dir="ltr" value={String(p[key])} onChange={(e) => set(key, e.target.value as never)} hint={hint} error={errors.fields[key]} />
  );

  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={t("leaveSettings.policyTitle", { name: format.name(type) })}
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
      <div className="flex flex-col gap-4">
        <Alert tone="info">{t(policy.scope === "company" ? "leaveSettings.companyPolicyNote" : "leaveSettings.accountPolicyNote")}</Alert>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormSelect label={t("leaveSettings.fields.entitlement")} name="entitlement" value={p.entitlement} onChange={(e) => set("entitlement", e.target.value as Entitlement)} options={ENTITLEMENTS.map((v) => ({ value: v, label: t(`leaveSettings.entitlements.${v}`) }))} />
          {p.entitlement !== "unlimited" && number("days", t("leaveSettings.fields.days"), p.entitlement === "per_occasion" ? t("leaveSettings.fields.daysOccasionHint") : undefined)}
          <FormSelect label={t("leaveSettings.fields.count")} name="count_mode" value={p.count_mode} onChange={(e) => set("count_mode", e.target.value as "calendar" | "working")} options={(["calendar", "working"] as const).map((v) => ({ value: v, label: t(`leaveSettings.count.${v}`) }))} />
        </div>
        <div className="flex flex-col gap-2">
          <CheckField label={t("leaveSettings.fields.holidaysExtend")} checked={p.holidays_extend} onChange={(e) => set("holidays_extend", e.target.checked)} />
          <CheckField label={t("leaveSettings.fields.paid")} checked={p.paid} onChange={(e) => set("paid", e.target.checked)} />
          <CheckField label={t("leaveSettings.fields.attachment")} checked={p.requires_attachment} onChange={(e) => set("requires_attachment", e.target.checked)} />
        </div>

        {p.entitlement === "per_year" && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-ink">{t("leaveSettings.bands.title")}</legend>
            {bands.map((band, i) => (
              <div key={i} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <TextField label={t("leaveSettings.bands.years")} inputMode="decimal" dir="ltr" value={band.min_service_years} onChange={(e) => setBands(bands.map((b, j) => (j === i ? { ...b, min_service_years: e.target.value } : b)))} />
                <TextField label={t("leaveSettings.bands.days")} inputMode="decimal" dir="ltr" value={band.days} onChange={(e) => setBands(bands.map((b, j) => (j === i ? { ...b, days: e.target.value } : b)))} />
                <IconButton size="sm" variant="danger" label={t("leaveSettings.remove")} icon={<Trash2 />} onClick={() => setBands(bands.filter((_b, j) => j !== i))} />
              </div>
            ))}
            {errors.fields.bands && <p className="text-sm text-danger">{errors.fields.bands}</p>}
            <div>
              <Button size="sm" variant="outline" icon={<Plus className="size-4" />} onClick={() => setBands([...bands, { min_service_years: bands.length ? "" : "0", days: "" }])}>
                {t("leaveSettings.bands.add")}
              </Button>
            </div>
          </fieldset>
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-ink">{t("leaveSettings.tiers.title")}</legend>
          {number("tier_window_days", t("leaveSettings.fields.tierWindow"), t("leaveSettings.fields.tierWindowHint"))}
          {p.tier_window_days.trim() !== "" && (
            <>
              {tiers.map((tier, i) => (
                <div key={i} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <TextField label={t("leaveSettings.tiers.days")} inputMode="numeric" dir="ltr" value={String(tier.days)} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, days: Number(e.target.value) } : x)))} />
                  <TextField label={t("leaveSettings.tiers.pay")} inputMode="decimal" dir="ltr" value={tier.pay_percent} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, pay_percent: e.target.value } : x)))} />
                  <IconButton size="sm" variant="danger" label={t("leaveSettings.remove")} icon={<Trash2 />} onClick={() => setTiers(tiers.filter((_x, j) => j !== i))} />
                </div>
              ))}
              {errors.fields.tiers && <p className="text-sm text-danger">{errors.fields.tiers}</p>}
              <div>
                <Button size="sm" variant="outline" icon={<Plus className="size-4" />} onClick={() => setTiers([...tiers, { days: 30, pay_percent: "100" }])}>
                  {t("leaveSettings.tiers.add")}
                </Button>
              </div>
            </>
          )}
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-1 text-sm font-medium text-ink">{t("leaveSettings.limits")}</legend>
          {number("min_service_days", t("leaveSettings.fields.minService"))}
          {number("max_times", t("leaveSettings.fields.maxTimes"))}
          {number("max_days_per_request", t("leaveSettings.fields.maxPerRequest"))}
          {number("within_days_of_event", t("leaveSettings.fields.withinEvent"))}
          {number("min_notice_days", t("leaveSettings.fields.notice"))}
          {number("carry_forward_max_days", t("leaveSettings.fields.carryForward"), t("leaveSettings.fields.carryForwardHint"))}
          {number("service_suspends_after_days", t("leaveSettings.fields.serviceSuspends"))}
        </fieldset>
        <TextField label={t("leaveSettings.fields.source")} value={p.source} onChange={(e) => set("source", e.target.value)} />
        {errors.general && <Alert>{errors.general}</Alert>}
        {Object.keys(errors.fields).length > 0 && !errors.general && <Alert>{Object.values(errors.fields)[0]}</Alert>}
      </div>
    </Dialog>
  );
}

function TypeDialog({ type, onClose }: { type?: LeaveType; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [v, setV] = useState({
    code: type?.code ?? "",
    category: type?.category ?? ("other" as LeaveCategory),
    name_ar: type?.name_ar ?? "",
    name_en: type?.name_en ?? "",
    gender: type?.gender ?? ("" as LeaveType["gender"]),
    color: type?.color ?? ("teal" as LeaveColor),
    sort_order: String(type?.sort_order ?? 100),
    is_active: type?.is_active ?? true,
  });
  const set = <K extends keyof typeof v>(key: K, value: (typeof v)[K]) => setV((x) => ({ ...x, [key]: value }));
  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: ["leave"] });
    onClose();
  };
  const save = useMutation({
    mutationFn: () => {
      const body = { ...v, sort_order: Number(v.sort_order) };
      return type ? leave.updateType(type.id, body) : leave.createType(body);
    },
    onSuccess: done,
  });
  const remove = useMutation({ mutationFn: () => leave.deleteType(type!.id), onSuccess: done });
  const errors = apiErrors(save.error ?? remove.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      onClose={onClose}
      title={type ? t("leaveSettings.editType") : t("leaveSettings.addType")}
      footer={
        <>
          {type && !type.is_system && (
            <Button variant="outline" className="me-auto" disabled={remove.isPending} onClick={() => remove.mutate()}>
              {t("common.delete")}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={save.isPending || !v.name_ar.trim() || !v.code.trim()} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t("master.name_ar")} name="name_ar" value={v.name_ar} onChange={(e) => set("name_ar", e.target.value)} error={errors.fields.name_ar} required />
        <TextField label={t("master.name_en")} dir="ltr" value={v.name_en} onChange={(e) => set("name_en", e.target.value)} />
        <TextField label={t("master.code")} name="code" dir="ltr" value={v.code} disabled={type?.is_system} onChange={(e) => set("code", e.target.value)} error={errors.fields.code} required />
        <FormSelect label={t("leaveSettings.fields.category")} value={v.category} disabled={type?.is_system} onChange={(e) => set("category", e.target.value as LeaveCategory)} options={CATEGORIES.map((c) => ({ value: c, label: t(`leaveSettings.categories.${c}`) }))} />
        <FormSelect label={t("leaveSettings.fields.for")} value={v.gender} onChange={(e) => set("gender", e.target.value as LeaveType["gender"])} options={(["", "female", "male"] as const).map((g) => ({ value: g, label: t(`leaveSettings.gender.${g || "any"}`) }))} />
        <FormSelect label={t("leaveSettings.fields.color")} value={v.color} onChange={(e) => set("color", e.target.value as LeaveColor)} options={COLORS.map((c) => ({ value: c, label: t(`leaveSettings.colors.${c}`) }))} />
        <TextField label={t("leaveSettings.fields.order")} inputMode="numeric" dir="ltr" value={v.sort_order} onChange={(e) => set("sort_order", e.target.value)} />
        <CheckField label={t("leaveSettings.active")} checked={v.is_active} onChange={(e) => set("is_active", e.target.checked)} className="self-end pb-3" />
        {errors.general && <Alert className="sm:col-span-2">{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

// --- leave year and limits ------------------------------------------------------------------------

function LevelCard<T extends object>({
  title,
  hint,
  level,
  values,
  inherited,
  editable,
  render,
  onSave,
  saving,
}: {
  title: string;
  hint: string;
  level: "account" | "company";
  values: { [K in keyof T]: T[K] | null };
  inherited: T;
  editable: boolean;
  render: (value: { [K in keyof T]: T[K] | null }, change: (next: { [K in keyof T]: T[K] | null }) => void) => ReactNode;
  onSave: (values: { [K in keyof T]: T[K] | null }) => void;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(values);
  const inheriting = level === "company" && Object.values(draft).every((x) => x === null);
  return (
    <Card variant="solid" title={title} subtitle={hint}>
      {level === "company" && (
        <CheckField
          label={t("leaveSettings.sameAsAccount")}
          checked={inheriting}
          disabled={!editable}
          onChange={(e) => setDraft(e.target.checked ? (Object.fromEntries(Object.keys(draft).map((k) => [k, null])) as typeof draft) : ({ ...inherited } as typeof draft))}
        />
      )}
      {!inheriting && <fieldset disabled={!editable} className="mt-3">{render(draft, setDraft)}</fieldset>}
      {editable && (
        <div className="mt-4">
          <Button size="sm" disabled={saving} onClick={() => onSave(draft)}>
            {t("common.save")}
          </Button>
        </div>
      )}
    </Card>
  );
}

function LeaveYearTab({ shared }: { shared: boolean }) {
  const { t } = useTranslation();
  const scope = useScopeKey();
  const queryClient = useQueryClient();
  const data = useQuery({ queryKey: ["leave", "settings", ...scope], queryFn: leave.settings });
  const save = useMutation({
    mutationFn: ({ level, values }: { level: "account" | "company"; values: Partial<{ leave_year_start: LeaveSettings["leave_year_start"] | null }> }) => leave.updateSettings(level, values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leave", "settings"] }),
  });
  if (!data.data) return <Card><p className="text-muted">{t("common.loading")}</p></Card>;
  const render = (value: { leave_year_start: LeaveSettings["leave_year_start"] | null }, change: (next: typeof value) => void) => (
    <FormSelect
      label={t("leaveSettings.year.start")}
      name="leave_year_start"
      value={value.leave_year_start ?? ""}
      onChange={(e) => change({ leave_year_start: e.target.value as LeaveSettings["leave_year_start"] })}
      options={(["hire_anniversary", "calendar_year"] as const).map((v) => ({ value: v, label: t(`leaveSettings.year.${v}`) }))}
    />
  );
  return (
    <div className="flex flex-col gap-4">
      {save.error && <Alert>{apiErrors(save.error, t("common.saveFailed")).general}</Alert>}
      <LevelCard key={`a-${data.dataUpdatedAt}`} title={t("leaveSettings.account")} hint={t("leaveSettings.year.hint")} level="account" values={data.data.account} inherited={data.data.account} editable={shared} render={render} onSave={(values) => save.mutate({ level: "account", values })} saving={save.isPending} />
      <LevelCard key={`c-${data.dataUpdatedAt}`} title={t("leaveSettings.company")} hint={t("leaveSettings.companyHint")} level="company" values={data.data.company} inherited={data.data.effective} editable render={render} onSave={(values) => save.mutate({ level: "company", values })} saving={save.isPending} />
    </div>
  );
}

function LimitsTab({ shared }: { shared: boolean }) {
  const { t } = useTranslation();
  const scope = useScopeKey();
  const queryClient = useQueryClient();
  const data = useQuery({ queryKey: ["leave", "selfservice", ...scope], queryFn: leave.selfService });
  const save = useMutation({
    mutationFn: ({ level, values }: { level: "account" | "company"; values: Partial<Record<keyof SelfServiceSettings, string | number | null>> }) =>
      leave.updateSelfService(level, values as never),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leave", "selfservice"] }),
  });
  if (!data.data) return <Card><p className="text-muted">{t("common.loading")}</p></Card>;
  const FIELDS: (keyof SelfServiceSettings)[] = ["permissions_per_month", "permission_hours_per_month", "permission_max_hours", "remote_days_per_month", "expense_max_age_days"];
  const render = (value: { [K in keyof SelfServiceSettings]: SelfServiceSettings[K] | null }, change: (next: typeof value) => void) => (
    <div className="grid gap-4 sm:grid-cols-2">
      {FIELDS.map((name) => (
        <TextField key={name} label={t(`leaveSettings.limitFields.${name}`)} name={name} inputMode="decimal" dir="ltr" value={asText(value[name])} onChange={(e) => change({ ...value, [name]: e.target.value })} />
      ))}
    </div>
  );
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <div className="flex flex-col gap-4">
      <Alert tone="info">{t("leaveSettings.limitsNote")}</Alert>
      {save.error && <Alert>{errors.general ?? Object.values(errors.fields)[0]}</Alert>}
      <LevelCard key={`a-${data.dataUpdatedAt}`} title={t("leaveSettings.account")} hint={t("leaveSettings.accountHint")} level="account" values={data.data.account} inherited={data.data.account} editable={shared} render={render} onSave={(values) => save.mutate({ level: "account", values })} saving={save.isPending} />
      <LevelCard key={`c-${data.dataUpdatedAt}`} title={t("leaveSettings.company")} hint={t("leaveSettings.companyHint")} level="company" values={data.data.company} inherited={data.data.effective} editable render={render} onSave={(values) => save.mutate({ level: "company", values })} saving={save.isPending} />
    </div>
  );
}
