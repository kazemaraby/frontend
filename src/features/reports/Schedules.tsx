import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { ExportFormat } from "@/api/index";
import { type Frequency, type Schedule, type ScheduleBody, schedulesApi, exportsApi } from "@/api/reports";
import { useScopeKey } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { Dialog } from "@/design/Dialog";
import { CheckField, FormSelect, TextField } from "@/design/Field";
import { Pill, type PillTone } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

const STATUS_TONES: Record<string, PillTone> = { sent: "green", no_access: "salmon", failed: "salmon" };
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

/** Scheduled reports (task 17, #137): the user's own. Each run makes every reader's copy with their own permissions
 * and e-mails a link that expires; the owner must still be allowed to run the report on the day. */
export function SchedulesCard() {
  const { t } = useTranslation();
  const scope = useScopeKey();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ["report-schedules", ...scope], queryFn: schedulesApi.list });
  const [editing, setEditing] = useState<Schedule | "new" | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["report-schedules"] });
  const remove = useMutation({ mutationFn: (id: number) => schedulesApi.remove(id), onSuccess: refresh });
  const runNow = useMutation({ mutationFn: (id: number) => schedulesApi.runNow(id), onSuccess: refresh });
  const format = useFormat();
  const columns: Column<Schedule>[] = [
    { id: "name", header: t("schedules.name"), cell: (s) => <span className="flex flex-col"><span className="font-semibold text-ink">{s.name}</span><span className="text-sm text-muted">{s.info.report}</span></span> },
    { id: "when", header: t("schedules.when"), cell: (s) => <span className="text-sm">{when(t, s)} · {t(`schedules.formats.${s.format}`)}</span> },
    { id: "to", header: t("schedules.recipients"), cell: (s) => <span className="text-sm">{s.info.recipients.length ? s.info.recipients.map((r) => format.name(r)).join("\u060C ") : t("schedules.onlyMe")}</span> },
    { id: "last", header: t("schedules.last"), cell: (s) => (s.last_run_on ? <span className="flex flex-col gap-1"><span className="num text-sm">{format.date(s.last_run_on)}</span>{s.last_status && <Pill tone={STATUS_TONES[s.last_status] ?? "neutral"}>{t(`schedules.statuses.${s.last_status}`)}</Pill>}</span> : <span className="text-muted">—</span>) },
    { id: "state", header: t("schedules.state"), cell: (s) => <Pill tone={s.is_active ? "green" : "neutral"}>{s.is_active ? t("schedules.active") : t("schedules.paused")}</Pill> },
    { id: "now", header: t("schedules.runNow"), cell: (s) => <Button size="sm" variant="outline" disabled={runNow.isPending} onClick={() => runNow.mutate(s.id)}>{t("schedules.runNow")}</Button> },
  ];
  return (
    <Card title={t("schedules.title")} subtitle={t("schedules.subtitle")} action={<Button variant="accent" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>{t("schedules.add")}</Button>}>
      {runNow.data && <Alert tone="info" className="mb-3">{t("schedules.sentTo", { count: runNow.data.deliveries.filter((d) => d.status === "sent").length })}</Alert>}
      {(runNow.error || remove.error) && <Alert className="mb-3">{apiErrors(runNow.error ?? remove.error, t("common.saveFailed")).general}</Alert>}
      <DataTable caption={t("schedules.title")} columns={columns} rows={list.data?.results ?? []} rowKey={(s) => String(s.id)} rowLabel={(s) => s.name} loading={list.isPending} empty={t("schedules.empty")} onEdit={(s) => setEditing(s)} onDelete={(s) => remove.mutate(s.id)} />
      {editing !== null && <ScheduleDialog row={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function when(t: (key: string, values?: Record<string, unknown>) => string, s: Schedule) {
  if (s.frequency === "weekly") return t("schedules.weeklyOn", { day: t(`schedules.weekdays.${s.weekday}`) });
  if (s.frequency === "monthly") return t("schedules.monthlyOn", { day: s.day_of_month });
  return t("schedules.frequencies.daily");
}

function ScheduleDialog({ row, onClose }: { row: Schedule | null; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const queryClient = useQueryClient();
  const catalog = useQuery({ queryKey: ["reports-catalog", ...scope], queryFn: exportsApi.catalog });
  const [v, setV] = useState<ScheduleBody>(row ?? { name: "", report: "", params: {}, format: "xlsx", frequency: "weekly", weekday: 6, day_of_month: 1, recipients: [], is_active: true });
  const entry = catalog.data?.find((e) => e.code === v.report);
  const people = useQuery({ queryKey: ["report-recipients", v.report, ...scope], queryFn: () => schedulesApi.recipients(v.report), enabled: !!v.report });
  const save = useMutation({
    mutationFn: () => schedulesApi.save({ ...v, id: row?.id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["report-schedules"] });
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const groups = [...new Set((catalog.data ?? []).map((e) => e.group))];
  const toggle = (id: number) => setV({ ...v, recipients: v.recipients.includes(id) ? v.recipients.filter((r) => r !== id) : [...v.recipients, id] });
  return (
    <Dialog open onClose={onClose} size="lg" title={row ? t("schedules.edit") : t("schedules.add")} footer={<Button variant="accent" disabled={save.isPending || !v.name.trim() || !v.report} onClick={() => save.mutate()}>{t("common.save")}</Button>}>
      <div className="flex flex-col gap-4">
        <TextField label={t("schedules.name")} name="name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} error={errors.fields.name} />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">{t("schedules.report")}</span>
          <select name="report" className="h-12 rounded-full border border-line bg-white px-5 text-ink" value={v.report} onChange={(e) => setV({ ...v, report: e.target.value, params: {}, recipients: [] })}>
            <option value="">{t("common.choose")}</option>
            {groups.map((group) => (
              <optgroup key={group} label={group}>
                {(catalog.data ?? []).filter((e) => e.group === group).map((e) => <option key={e.code} value={e.code}>{e.title}</option>)}
              </optgroup>
            ))}
          </select>
          {errors.fields.report && <span className="text-sm text-danger">{errors.fields.report}</span>}
        </label>
        {entry && Object.entries(entry.options).map(([name, choices]) => (
          <FormSelect key={name} label={t(`schedules.options.${name}`)} name={`option_${name}`} value={v.params[name] ?? choices[0]?.value ?? ""} onChange={(e) => setV({ ...v, params: { ...v.params, [name]: e.target.value } })} options={choices} />
        ))}
        <div className="grid gap-4 sm:grid-cols-3">
          <FormSelect label={t("schedules.frequency")} name="frequency" value={v.frequency} onChange={(e) => setV({ ...v, frequency: e.target.value as Frequency })} options={(["daily", "weekly", "monthly"] as const).map((f) => ({ value: f, label: t(`schedules.frequencies.${f}`) }))} />
          {v.frequency === "weekly" && <FormSelect label={t("schedules.weekday")} name="weekday" value={String(v.weekday)} onChange={(e) => setV({ ...v, weekday: Number(e.target.value) })} options={WEEKDAYS.map((d) => ({ value: String(d), label: t(`schedules.weekdays.${d}`) }))} />}
          {v.frequency === "monthly" && <FormSelect label={t("schedules.dayOfMonth")} name="day_of_month" value={String(v.day_of_month)} onChange={(e) => setV({ ...v, day_of_month: Number(e.target.value) })} options={Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: format.number(i + 1) }))} />}
          <FormSelect label={t("schedules.format")} name="format" value={v.format} onChange={(e) => setV({ ...v, format: e.target.value as ExportFormat })} options={(["xlsx", "pdf"] as const).map((f) => ({ value: f, label: t(`schedules.formats.${f}`) }))} />
        </div>
        {v.report && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-ink">{t("schedules.recipients")}</legend>
            <p className="text-sm text-muted">{t("schedules.recipientsHint")}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(people.data ?? []).map((p) => <CheckField key={p.id} label={`${format.name(p)} (${p.email})`} checked={v.recipients.includes(p.id)} onChange={() => toggle(p.id)} />)}
            </div>
          </fieldset>
        )}
        <CheckField label={t("schedules.active")} checked={v.is_active} onChange={(e) => setV({ ...v, is_active: e.target.checked })} />
        {(errors.fields.detail || errors.general) && <Alert>{errors.fields.detail ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
