import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import {
  type ComplianceRule,
  complianceSettings,
  type DatedKind,
  type GovernmentFee,
  type NitaqatActivity,
  type NitaqatThreshold,
  type RuleStatus,
} from "@/api/compliance";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { Dialog } from "@/design/Dialog";
import { CheckField, FormSelect, TextField } from "@/design/Field";
import { Pill } from "@/design/Pill";
import { Tabs } from "@/design/Tabs";
import { type SettingsField, SettingsTableCard } from "@/features/setup/SettingsTableCard";
import { Page } from "@/layout/Page";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

const TABS = ["rules", "fees", "nitaqat", "practice"] as const;
type Tab = (typeof TABS)[number];
const BANDS = ["platinum", "high_green", "medium_green", "low_green"] as const;
const PRACTICE: SettingsField[] = [
  { name: "renewal_months", kind: "number" },
  { name: "renewal_notice_days", kind: "number" },
  { name: "exit_reentry_paid_per_year", kind: "number" },
  { name: "exit_reentry_year", kind: "choice", options: ["calendar", "contract"] },
  { name: "portal_files_kept_months", kind: "number" },
  { name: "qiwa_documentation_days", kind: "number" },
  { name: "wps_notice_days", kind: "number" },
  { name: "dependent_fees_paid_by", kind: "choice", options: ["employee", "company"] },
  { name: "escalate_after_days", kind: "number" },
  { name: "risk_weight_critical", kind: "number" },
  { name: "risk_weight_high", kind: "number" },
  { name: "risk_weight_medium", kind: "number" },
  { name: "risk_weight_low", kind: "number" },
];

/** /settings/compliance (Phase 5 task 0): the government's numbers as dated values — Nitaqat counting and WPS rules,
 * fees, the Nitaqat activities and each band's threshold — each with its source and whether it was confirmed; a new
 * value applies from its date (the one before ends the day before), so a past result keeps the numbers of its day.
 * And the company's compliance practice. The tables are the whole account's: changing them needs compliance.manage
 * in every company. */
export default function ComplianceSettingsPage() {
  const { t } = useTranslation();
  const { can, me } = useSession();
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab") as Tab | null;
  const tab: Tab = requested && TABS.includes(requested) ? requested : "rules";
  return (
    <Page
      title={t("complianceSettings.title")}
      tabs={<Tabs label={t("complianceSettings.title")} value={tab} onChange={(next) => setParams(next === "rules" ? {} : { tab: next }, { replace: true })} items={TABS.map((id) => ({ id, label: t(`complianceSettings.tabs.${id}`) }))} />}
    >
      {tab === "rules" && <RulesCard />}
      {tab === "fees" && <FeesCard />}
      {tab === "nitaqat" && <NitaqatCard />}
      {tab === "practice" && (
        <SettingsTableCard
          queryKey="compliance-settings"
          load={complianceSettings.practice}
          save={complianceSettings.savePractice}
          fields={PRACTICE}
          labels="complianceSettings.practice"
          title={t("complianceSettings.practice.title")}
          hint={t("complianceSettings.practice.hint")}
          canAccount={can("compliance.manage") && Boolean(me?.is_tenant_admin || can("core.manage_companies"))}
          canCompany={can("compliance.manage")}
        />
      )}
    </Page>
  );
}

function useTable<T>(kind: DatedKind) {
  const scope = useScopeKey();
  return useQuery({ queryKey: [kind, ...scope], queryFn: () => complianceSettings.table<T>(kind) });
}

function StatusPill({ status }: { status: RuleStatus }) {
  const { t } = useTranslation();
  return <Pill tone={status === "confirmed" ? "green" : "amber"}>{t(`complianceSettings.statuses.${status}`)}</Pill>;
}

function Source({ text }: { text: string }) {
  const parts = text.split(" ; ").filter(Boolean);
  if (!parts.length) return <span className="text-muted">—</span>;
  return (
    <span className="flex flex-col gap-0.5 text-xs">
      {parts.map((part) =>
        part.startsWith("http") ? (
          <a key={part} href={part} target="_blank" rel="noreferrer" dir="ltr" className="truncate text-teal-dark underline">
            {new URL(part).hostname}
          </a>
        ) : (
          <span key={part}>{part}</span>
        ),
      )}
    </span>
  );
}

function Period({ from, to }: { from: string; to: string | null }) {
  const { t } = useTranslation();
  const format = useFormat();
  return (
    <span className="num text-sm">
      {format.date(from)} – {to ? format.date(to) : t("complianceSettings.open")}
    </span>
  );
}

type Editing = { kind: DatedKind; row?: { id: number } & Record<string, unknown>; preset?: Record<string, unknown> };

function RulesCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const table = useTable<ComplianceRule>("compliance-rules");
  const [editing, setEditing] = useState<Editing | null>(null);
  const change = Boolean(table.data?.can_change);
  const columns: Column<ComplianceRule>[] = [
    { id: "rule", header: t("complianceSettings.rule"), cell: (r) => <span className="flex flex-col"><span className="text-sm font-medium">{r.label}</span>{[r.hint, r.note].filter(Boolean).map((text) => <span key={text} className="text-xs text-muted">{text}</span>)}</span> },
    { id: "value", header: t("complianceSettings.value"), cell: (r) => <span className="num font-semibold">{r.unit === "yes_no" ? t(Number(r.value) ? "common.yes" : "common.no") : format.number(Number(r.value), [0, 4])}</span>, className: "w-28" },
    { id: "period", header: t("complianceSettings.period"), cell: (r) => <Period from={r.valid_from} to={r.valid_to} />, className: "w-56" },
    { id: "status", header: t("complianceSettings.status"), cell: (r) => <StatusPill status={r.status} />, className: "w-28" },
    { id: "source", header: t("complianceSettings.source"), cell: (r) => <Source text={r.source} />, className: "w-48" },
    {
      id: "actions",
      header: <span className="sr-only">{t("common.actions")}</span>,
      cell: (r) =>
        change && (
          <span className="flex gap-1">
            <IconButton size="sm" variant="plain" label={t("complianceSettings.edit", { name: r.label })} icon={<Pencil />} onClick={() => setEditing({ kind: "compliance-rules", row: r })} />
            {!r.valid_to && <IconButton size="sm" variant="plain" label={t("complianceSettings.newValue", { name: r.label })} icon={<CalendarPlus />} onClick={() => setEditing({ kind: "compliance-rules", preset: { code: r.code, value: r.value } })} />}
          </span>
        ),
    },
  ];
  return (
    <Card variant="solid" title={t("complianceSettings.rulesTitle")} subtitle={t("complianceSettings.rulesHint")}>
      <Alert tone="warning" className="mb-4">{t("complianceSettings.toConfirm")}</Alert>
      <DataTable caption={t("complianceSettings.rulesTitle")} columns={columns} rows={table.data?.rows ?? []} rowKey={(r) => String(r.id)} loading={table.isPending} minWidth={900} />
      {editing && <DatedDialog editing={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function FeesCard() {
  const { t } = useTranslation();
  const table = useTable<GovernmentFee>("government-fees");
  const [editing, setEditing] = useState<Editing | null>(null);
  const change = Boolean(table.data?.can_change);
  const columns: Column<GovernmentFee>[] = [
    { id: "fee", header: t("complianceSettings.fee"), cell: (r) => <span className="flex flex-col"><span className="text-sm font-medium">{r.label}</span><span className="text-xs text-muted">{[r.condition_label, r.hint, r.note].filter(Boolean).join(" · ")}</span></span> },
    { id: "amount", header: t("complianceSettings.amount"), cell: (r) => <span className="num font-semibold">{r.amount} <span className="text-xs text-muted">{t(`complianceSettings.units.${r.unit}`)}</span></span>, className: "w-40" },
    { id: "period", header: t("complianceSettings.period"), cell: (r) => <Period from={r.valid_from} to={r.valid_to} />, className: "w-56" },
    { id: "status", header: t("complianceSettings.status"), cell: (r) => <StatusPill status={r.status} />, className: "w-28" },
    { id: "source", header: t("complianceSettings.source"), cell: (r) => <Source text={r.source} />, className: "w-48" },
    {
      id: "actions",
      header: <span className="sr-only">{t("common.actions")}</span>,
      cell: (r) =>
        change && (
          <span className="flex gap-1">
            <IconButton size="sm" variant="plain" label={t("complianceSettings.edit", { name: r.label })} icon={<Pencil />} onClick={() => setEditing({ kind: "government-fees", row: r })} />
            {!r.valid_to && <IconButton size="sm" variant="plain" label={t("complianceSettings.newValue", { name: r.label })} icon={<CalendarPlus />} onClick={() => setEditing({ kind: "government-fees", preset: { code: r.code, condition: r.condition, amount: r.amount, unit: r.unit } })} />}
          </span>
        ),
    },
  ];
  return (
    <Card variant="solid" title={t("complianceSettings.feesTitle")} subtitle={t("complianceSettings.feesHint")}>
      <Alert tone="warning" className="mb-4">{t("complianceSettings.toConfirm")}</Alert>
      <DataTable caption={t("complianceSettings.feesTitle")} columns={columns} rows={table.data?.rows ?? []} rowKey={(r) => String(r.id)} loading={table.isPending} minWidth={900} />
      {editing && <DatedDialog editing={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function NitaqatCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const activities = useQuery({ queryKey: ["nitaqat-activities", ...scope], queryFn: complianceSettings.activities });
  const table = useTable<NitaqatThreshold>("nitaqat-thresholds");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [activity, setActivity] = useState<Partial<NitaqatActivity> | null>(null);
  const change = Boolean(table.data?.can_change);
  const name = (id: number) => {
    const found = activities.data?.find((a) => a.id === id);
    return found ? `${found.code} — ${format.name(found)}` : String(id);
  };
  const columns: Column<NitaqatThreshold>[] = [
    { id: "activity", header: t("complianceSettings.activity"), cell: (r) => <span className="text-sm">{name(r.activity)}</span> },
    { id: "band", header: t("complianceSettings.band"), cell: (r) => <span className="text-sm font-medium">{t(`complianceSettings.bands.${r.band}`)}</span>, className: "w-36" },
    { id: "formula", header: t("complianceSettings.formula"), cell: (r) => <span dir="ltr" className="num text-sm">{Number(r.m) ? `${format.number(Number(r.m), [0, 6])} × ln(n) + ${format.number(Number(r.c), [0, 6])}` : format.number(Number(r.c), [0, 6])} %</span>, className: "w-44" },
    { id: "size", header: t("complianceSettings.size"), cell: (r) => <span className="num text-sm">{format.number(r.min_employees)} – {r.max_employees ? format.number(r.max_employees) : "∞"}</span>, className: "w-28" },
    { id: "period", header: t("complianceSettings.period"), cell: (r) => <Period from={r.valid_from} to={r.valid_to} />, className: "w-56" },
    { id: "status", header: t("complianceSettings.status"), cell: (r) => <StatusPill status={r.status} />, className: "w-28" },
    { id: "actions", header: <span className="sr-only">{t("common.actions")}</span>, cell: (r) => change && <IconButton size="sm" variant="plain" label={t("complianceSettings.edit", { name: name(r.activity) })} icon={<Pencil />} onClick={() => setEditing({ kind: "nitaqat-thresholds", row: r })} /> },
  ];
  const activityColumns: Column<NitaqatActivity>[] = [
    { id: "code", header: t("complianceSettings.code"), cell: (a) => <span dir="ltr" className="num font-semibold">{a.code}</span>, className: "w-32" },
    { id: "name", header: t("complianceSettings.name"), cell: (a) => format.name(a) },
    { id: "active", header: t("complianceSettings.active"), cell: (a) => <Pill tone={a.is_active ? "green" : "neutral"}>{t(a.is_active ? "common.yes" : "common.no")}</Pill>, className: "w-24" },
    { id: "actions", header: <span className="sr-only">{t("common.actions")}</span>, cell: (a) => change && <IconButton size="sm" variant="plain" label={t("complianceSettings.edit", { name: a.code })} icon={<Pencil />} onClick={() => setActivity(a)} /> },
  ];
  return (
    <div className="flex flex-col gap-6">
      <Card variant="solid" title={t("complianceSettings.activitiesTitle")} subtitle={t("complianceSettings.activitiesHint")} action={change && <Button size="sm" variant="accent" icon={<Plus className="size-4" />} onClick={() => setActivity({ code: "", name_ar: "", name_en: "", is_active: true })}>{t("complianceSettings.addActivity")}</Button>}>
        <DataTable caption={t("complianceSettings.activitiesTitle")} columns={activityColumns} rows={activities.data ?? []} rowKey={(a) => String(a.id)} loading={activities.isPending} empty={t("complianceSettings.noActivities")} minWidth={520} />
      </Card>
      <Card variant="solid" title={t("complianceSettings.thresholdsTitle")} subtitle={t("complianceSettings.thresholdsHint")} action={change && Boolean(activities.data?.length) && <Button size="sm" variant="accent" icon={<Plus className="size-4" />} onClick={() => setEditing({ kind: "nitaqat-thresholds", preset: { activity: activities.data?.[0]?.id, band: "low_green", m: "0", c: "", min_employees: 1 } })}>{t("complianceSettings.addThreshold")}</Button>}>
        <DataTable caption={t("complianceSettings.thresholdsTitle")} columns={columns} rows={table.data?.rows ?? []} rowKey={(r) => String(r.id)} loading={table.isPending} empty={t("complianceSettings.noThresholds")} minWidth={900} />
      </Card>
      {editing && <DatedDialog editing={editing} activities={activities.data ?? []} onClose={() => setEditing(null)} />}
      {activity && <ActivityDialog activity={activity} onClose={() => setActivity(null)} />}
    </div>
  );
}

/** A dated value: a new one from a date (preset from the current one), or a correction of a row. */
function DatedDialog({ editing, activities = [], onClose }: { editing: Editing; activities?: NitaqatActivity[]; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const { kind, row, preset } = editing;
  const [v, setV] = useState<Record<string, unknown>>(row ? { ...row } : { ...preset, valid_from: "", valid_to: null, source: "", status: "to_confirm", note: "" });
  const save = useMutation({
    mutationFn: () => {
      const body = { ...v, valid_to: v.valid_to || null };
      return row ? complianceSettings.change(kind, row.id, body) : complianceSettings.add(kind, body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [kind] });
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const text = (name: string) => (v[name] === null || v[name] === undefined ? "" : String(v[name]));
  const set = (name: string) => (e: { target: { value: string } }) => setV({ ...v, [name]: e.target.value });
  const amountField = kind === "compliance-rules" ? "value" : kind === "government-fees" ? "amount" : null;
  return (
    <Dialog
      open
      onClose={onClose}
      title={row ? t("complianceSettings.correct") : t("complianceSettings.newPeriod")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!v.valid_from || save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!row && <p className="text-sm text-muted">{t("complianceSettings.newPeriodHint")}</p>}
        {kind === "nitaqat-thresholds" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormSelect label={t("complianceSettings.activity")} name="activity" value={text("activity")} onChange={(e) => setV({ ...v, activity: Number(e.target.value) })} options={activities.map((a) => ({ value: String(a.id), label: `${a.code} — ${format.name(a)}` }))} error={errors.fields.activity} />
            <FormSelect label={t("complianceSettings.band")} name="band" value={text("band")} onChange={set("band")} options={BANDS.map((b) => ({ value: b, label: t(`complianceSettings.bands.${b}`) }))} error={errors.fields.band} />
            <TextField label="m" name="m" dir="ltr" inputMode="decimal" value={text("m")} onChange={set("m")} hint={t("complianceSettings.mHint")} error={errors.fields.m} />
            <TextField label="c" name="c" dir="ltr" inputMode="decimal" value={text("c")} onChange={set("c")} hint={t("complianceSettings.cHint")} error={errors.fields.c} />
            <TextField label={t("complianceSettings.minEmployees")} name="min_employees" dir="ltr" inputMode="numeric" value={text("min_employees")} onChange={set("min_employees")} error={errors.fields.min_employees} />
            <TextField label={t("complianceSettings.maxEmployees")} name="max_employees" dir="ltr" inputMode="numeric" value={text("max_employees")} onChange={(e) => setV({ ...v, max_employees: e.target.value || null })} error={errors.fields.max_employees} />
          </div>
        )}
        {amountField && <TextField label={t(`complianceSettings.${amountField === "value" ? "value" : "amount"}`)} name={amountField} dir="ltr" inputMode="decimal" value={text(amountField)} onChange={set(amountField)} error={errors.fields[amountField]} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("complianceSettings.validFrom")} name="valid_from" type="date" value={text("valid_from")} onChange={set("valid_from")} error={errors.fields.valid_from} />
          <TextField label={t("complianceSettings.validTo")} name="valid_to" type="date" value={text("valid_to")} onChange={set("valid_to")} hint={t("complianceSettings.validToHint")} error={errors.fields.valid_to} />
        </div>
        <TextField label={t("complianceSettings.source")} name="source" dir="ltr" value={text("source")} onChange={set("source")} hint={t("complianceSettings.sourceHint")} error={errors.fields.source} />
        <TextField label={t("complianceSettings.note")} name="note" value={text("note")} onChange={set("note")} />
        <CheckField label={t("complianceSettings.confirmedCheck")} checked={v.status === "confirmed"} onChange={(e) => setV({ ...v, status: e.target.checked ? "confirmed" : "to_confirm" })} />
        {(errors.fields.detail || errors.fields.code || errors.general) && <Alert>{errors.fields.detail ?? errors.fields.code ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

function ActivityDialog({ activity, onClose }: { activity: Partial<NitaqatActivity>; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [v, setV] = useState(activity);
  const save = useMutation({
    mutationFn: () => complianceSettings.saveActivity({ code: v.code, name_ar: v.name_ar, name_en: v.name_en, is_active: v.is_active }, activity.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["nitaqat-activities"] });
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      onClose={onClose}
      title={activity.id ? t("complianceSettings.edit", { name: activity.code }) : t("complianceSettings.addActivity")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!v.code?.trim() || !v.name_ar?.trim() || save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField label={t("complianceSettings.code")} name="code" dir="ltr" value={v.code ?? ""} onChange={(e) => setV({ ...v, code: e.target.value })} error={errors.fields.code} />
        <TextField label={t("complianceSettings.nameAr")} name="name_ar" value={v.name_ar ?? ""} onChange={(e) => setV({ ...v, name_ar: e.target.value })} error={errors.fields.name_ar} />
        <TextField label={t("complianceSettings.nameEn")} name="name_en" dir="ltr" value={v.name_en ?? ""} onChange={(e) => setV({ ...v, name_en: e.target.value })} />
        <CheckField label={t("complianceSettings.active")} checked={Boolean(v.is_active)} onChange={(e) => setV({ ...v, is_active: e.target.checked })} />
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
