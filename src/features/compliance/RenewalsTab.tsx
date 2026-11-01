import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, CircleSlash, FileDown, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type ForecastCell, type RenewalRow, renewalsApi, type RenewalStatus } from "@/api/compliance";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable, PersonCell } from "@/design/DataTable";
import { DateInput } from "@/design/DateInput";
import { Dialog } from "@/design/Dialog";
import { TextArea, TextField } from "@/design/Field";
import { Money } from "@/design/Money";
import { Pill, type PillTone } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { saveFile } from "@/lib/saveFile";
import { useFormat } from "@/lib/useFormat";

import { FilterChip } from "./QiwaTab";

const STATUSES: RenewalStatus[] = ["overdue", "due", "upcoming", "paid", "not_renewing"];
const TONES: Record<RenewalStatus, PillTone> = { overdue: "salmon", due: "amber", upcoming: "neutral", paid: "green", renewed: "teal", not_renewing: "lavender" };

/** Iqama and work-permit renewals (Phase 5 task 11, #112): each non-Saudi's current renewal with its fees from the
 * dated fees (the levy by the establishment's Saudis and non-Saudis, exemptions), recorded as paid or not renewing;
 * and the cost of the next twelve months. */
export function RenewalsTab() {
  return (
    <div className="flex flex-col gap-6">
      <ScheduleCard />
      <ForecastCard />
    </div>
  );
}

function ScheduleCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const { can } = useSession();
  const [status, setStatus] = useState<RenewalStatus | "">("");
  const list = useQuery({ queryKey: ["renewals", status, ...scope], queryFn: () => renewalsApi.schedule(status || undefined) });
  const [acting, setActing] = useState<{ row: RenewalRow; action: "paid" | "not_renewing" } | null>(null);
  const queryClient = useQueryClient();
  const reopen = useMutation({ mutationFn: (row: RenewalRow) => renewalsApi.act(row.id, { action: "reopen" }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["renewals"] }) });
  const money = (v: string | null) => (v == null ? <span className="text-muted">—</span> : <Money amount={v} />);
  const columns: Column<RenewalRow>[] = [
    { id: "who", header: t("compliance.employee"), cell: (r) => <PersonCell name={format.name(r.employee)} subtitle={r.employee.employee_no} /> },
    {
      id: "due",
      header: t("renewals.dueOn"),
      cell: (r) => (
        <span className="flex flex-col">
          <span className="num whitespace-nowrap text-sm">{format.date(r.due_on)}</span>
          <span className="num whitespace-nowrap text-xs text-muted">{format.hijri(r.due_on)}</span>
        </span>
      ),
      className: "w-40",
    },
    {
      id: "status",
      header: t("renewals.status"),
      cell: (r) => (
        <span className="flex flex-col items-start gap-1">
          <Pill tone={TONES[r.status]}>{t(`renewals.statuses.${r.status}`)}</Pill>
          {r.note && <span className="text-xs text-muted">{r.note}</span>}
        </span>
      ),
      className: "w-40",
    },
    {
      id: "fees",
      header: t("renewals.fees", { months: format.number(list.data?.rows[0]?.months ?? 12) }),
      cell: (r) => (
        <span className="flex flex-col text-sm">
          <span className="flex flex-wrap items-center gap-x-2">
            {t("renewals.levy")} {money(r.fees.levy)}
            {r.fees.exemption && <Pill tone="teal">{t(`renewals.exemptions.${r.fees.exemption}`)}</Pill>}
          </span>
          <span className="flex items-center gap-x-2">{t("renewals.iqama")} {money(r.fees.iqama)}</span>
          {r.fees.dependents_count > 0 && (
            <span className="flex flex-wrap items-center gap-x-2">
              {t("renewals.dependents", { count: r.fees.dependents_count })} {money(r.fees.dependents)}
              <span className="text-xs text-muted">{t(`renewals.paidBy.${r.fees.dependents_paid_by}`)}</span>
            </span>
          )}
        </span>
      ),
    },
    { id: "total", header: t("renewals.companyPays"), cell: (r) => <span className="font-medium">{money(r.fees.company_total)}</span>, className: "w-36" },
    {
      id: "actions",
      header: <span className="sr-only">{t("common.actions")}</span>,
      cell: (r) =>
        can("compliance.manage") && (
          <span className="flex gap-1">
            {r.status === "paid" || r.status === "not_renewing" ? (
              <IconButton size="sm" variant="plain" label={t("renewals.reopen", { name: format.name(r.employee) })} icon={<RotateCcw />} onClick={() => reopen.mutate(r)} />
            ) : (
              <>
                <IconButton size="sm" variant="plain" label={t("renewals.markPaid", { name: format.name(r.employee) })} icon={<CircleCheck />} onClick={() => setActing({ row: r, action: "paid" })} />
                <IconButton size="sm" variant="plain" label={t("renewals.markNotRenewing", { name: format.name(r.employee) })} icon={<CircleSlash />} onClick={() => setActing({ row: r, action: "not_renewing" })} />
              </>
            )}
          </span>
        ),
    },
  ];
  const counts = list.data?.counts ?? {};
  return (
    <Card variant="solid" title={t("renewals.title")} subtitle={t("renewals.hint")}>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label={t("qiwa.filter")}>
        <FilterChip active={status === ""} onClick={() => setStatus("")} label={t("qiwa.all")} />
        {STATUSES.filter((s) => counts[s]).map((s) => (
          <FilterChip key={s} active={status === s} onClick={() => setStatus(s)} label={`${t(`renewals.statuses.${s}`)} · ${format.number(counts[s]!)}`} />
        ))}
      </div>
      {(list.isError || reopen.isError) && <Alert className="mb-3">{apiErrors(list.error ?? reopen.error, t("common.loadFailed")).general}</Alert>}
      <DataTable caption={t("renewals.title")} columns={columns} rows={list.data?.rows ?? []} rowKey={(r) => String(r.id)} loading={list.isPending} empty={t("renewals.none")} minWidth={980} />
      {acting && <ActDialog row={acting.row} action={acting.action} onClose={() => setActing(null)} />}
    </Card>
  );
}

function ActDialog({ row, action, onClose }: { row: RenewalRow; action: "paid" | "not_renewing"; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const [v, setV] = useState({ paid_on: new Date().toLocaleDateString("en-CA"), amount_paid: row.fees.company_total, note: "" });
  const save = useMutation({
    mutationFn: () => renewalsApi.act(row.id, action === "paid" ? { action, ...v } : { action, note: v.note }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["renewals"] });
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const title = t(action === "paid" ? "renewals.markPaid" : "renewals.markNotRenewing", { name: format.name(row.employee) });
  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={save.isPending || (action === "not_renewing" && !v.note.trim())} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {action === "paid" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <DateInput label={t("renewals.paidOn")} name="paid_on" value={v.paid_on || null} onChange={(d) => setV({ ...v, paid_on: d ?? "" })} error={errors.fields.paid_on} />
            <TextField label={t("renewals.amountPaid")} name="amount_paid" type="number" min={0} inputMode="decimal" dir="ltr" value={v.amount_paid} onChange={(e) => setV({ ...v, amount_paid: e.target.value })} />
          </div>
        )}
        <TextArea label={t(action === "paid" ? "renewals.note" : "renewals.why")} name="note" rows={2} value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} error={errors.fields.note} />
        {(errors.fields.detail || errors.general) && <Alert>{errors.fields.detail ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

function ForecastCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const { can } = useSession();
  const forecast = useQuery({ queryKey: ["renewals-forecast", ...scope], queryFn: () => renewalsApi.forecast(12) });
  const exporting = useMutation({ mutationFn: async () => saveFile(await renewalsApi.exportForecast(12)) });
  const columns: Column<ForecastCell>[] = [
    { id: "month", header: t("renewals.month"), cell: (c) => <span className="font-medium">{format.date(c.month, "monthYear")}</span>, className: "w-36" },
    { id: "establishment", header: t("establishments.establishment"), cell: (c) => <bdi dir="ltr" className="num text-sm">{c.establishment || t("establishments.noNumber")}</bdi>, className: "w-32" },
    { id: "renewals", header: t("renewals.count"), cell: (c) => <span className="num">{format.number(c.renewals)}</span>, className: "w-24" },
    { id: "levy", header: t("renewals.levy"), cell: (c) => <Money amount={c.levy} /> },
    { id: "iqama", header: t("renewals.iqama"), cell: (c) => <Money amount={c.iqama} /> },
    { id: "dependents", header: t("renewals.dependentsFees"), cell: (c) => <Money amount={c.dependents} /> },
    { id: "total", header: t("renewals.companyPays"), cell: (c) => <span className="font-medium"><Money amount={c.company_total} /></span> },
  ];
  const data = forecast.data;
  return (
    <Card
      variant="solid"
      title={t("renewals.forecastTitle")}
      subtitle={t("renewals.forecastHint", { period: format.number(data?.period ?? 12) })}
      action={
        can("compliance.export") && (
          <Button size="sm" variant="outline" icon={<FileDown className="size-4" />} disabled={exporting.isPending || !data?.lines.length} onClick={() => exporting.mutate()}>
            {t("saudization.export")}
          </Button>
        )
      }
    >
      {(forecast.isError || exporting.isError) && <Alert className="mb-3">{apiErrors(forecast.error ?? exporting.error, t("common.loadFailed")).general}</Alert>}
      <DataTable caption={t("renewals.forecastTitle")} columns={columns} rows={data?.rows ?? []} rowKey={(c) => `${c.month}-${c.establishment}`} loading={forecast.isPending} empty={t("renewals.noneComing")} minWidth={900} />
      {data && data.rows.length > 0 && (
        <p className="num mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm font-medium">
          <span>{t("renewals.total", { count: data.totals.renewals })}</span>
          <span className="flex items-center gap-2">
            {t("renewals.companyPays")} <Money amount={data.totals.company_total} />
          </span>
        </p>
      )}
    </Card>
  );
}
