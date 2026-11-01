import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type WpsMonthRow, type WpsResult, wpsApi, type WpsStatus } from "@/api/compliance";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { DateInput } from "@/design/DateInput";
import { Dialog } from "@/design/Dialog";
import { FormSelect, TextField } from "@/design/Field";
import { Pill, type PillTone } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

const STATUS_TONES: Record<WpsStatus, PillTone> = { upcoming: "neutral", due: "amber", uploaded: "green", late: "salmon", no_payroll: "neutral" };
const RESULTS: Exclude<WpsResult, "">[] = ["accepted", "partial", "rejected"];

/** Mudad / WPS tracking (Phase 5 task 8, #109): the last twelve months per establishment — our WPS file (made, sent
 * to Mudad), the upload recorded by hand otherwise, Mudad's result and percentage, ours, the deadline and the
 * threshold. */
export function WpsTab() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const { can } = useSession();
  const grid = useQuery({ queryKey: ["wps", ...scope], queryFn: () => wpsApi.grid() });
  const [editing, setEditing] = useState<WpsMonthRow | null>(null);
  const pct = (v: string | null) => (v != null ? `${format.number(v, [0, 2])}%` : "—");
  const columns: Column<WpsMonthRow>[] = [
    {
      id: "month",
      header: t("wpsTracking.month"),
      cell: (r) => (
        <span className="flex flex-col">
          <span className="font-medium">{format.date(r.month, "monthYear")}</span>
          <bdi dir="ltr" className="num text-xs text-muted">{r.number || t("establishments.noNumber")}</bdi>
        </span>
      ),
      className: "w-40",
    },
    {
      id: "status",
      header: t("wpsTracking.status"),
      cell: (r) => (
        <span className="flex flex-col items-start gap-1">
          <Pill tone={STATUS_TONES[r.status]}>{t(`wpsTracking.statuses.${r.status}`)}</Pill>
          {r.below && <Pill tone="salmon">{t("wpsTracking.below", { threshold: format.number(r.threshold ?? 0) })}</Pill>}
        </span>
      ),
      className: "w-40",
    },
    { id: "deadline", header: t("wpsTracking.deadline"), cell: (r) => <span className="num text-sm">{r.deadline ? format.date(r.deadline) : "—"}</span>, className: "w-36" },
    {
      id: "file",
      header: t("wpsTracking.ourFile"),
      cell: (r) => (
        <span className="text-sm">
          {r.files ? (r.sent ? t("wpsTracking.sent", { status: r.mudad_status || "—" }) : t("wpsTracking.made", { count: r.files })) : <span className="text-muted">{t("wpsTracking.noFile")}</span>}
        </span>
      ),
    },
    {
      id: "upload",
      header: t("wpsTracking.upload"),
      cell: (r) =>
        r.uploaded_on ? (
          <span className="flex flex-col text-sm">
            <span className="num">{format.date(r.uploaded_on)}</span>
            {r.mudad_reference && <bdi dir="ltr" className="num text-xs text-muted">{r.mudad_reference}</bdi>}
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
      className: "w-36",
    },
    {
      id: "mudad",
      header: t("wpsTracking.mudad"),
      cell: (r) => (
        <span className="flex flex-col text-sm">
          <span>{r.result ? t(`wpsTracking.results.${r.result}`) : "—"}</span>
          {r.mudad_percent != null && <span className="num">{pct(r.mudad_percent)}</span>}
        </span>
      ),
      className: "w-32",
    },
    {
      id: "ours",
      header: t("wpsTracking.ours"),
      cell: (r) => (
        <span className="flex flex-col text-sm">
          <span className="num">{r.status === "no_payroll" ? "—" : pct(r.our_percent)}</span>
          {r.expected > 0 && r.status !== "no_payroll" && <span className="num whitespace-nowrap text-xs text-muted">{t("wpsTracking.paidOf", { paid: format.number(r.paid), expected: format.number(r.expected) })}</span>}
        </span>
      ),
      className: "w-32",
    },
    {
      id: "actions",
      header: <span className="sr-only">{t("common.actions")}</span>,
      cell: (r) =>
        can("compliance.manage") && r.status !== "upcoming" && (
          <IconButton size="sm" variant="plain" label={t("wpsTracking.record", { month: format.date(r.month, "monthYear"), number: r.number || t("establishments.noNumber") })} icon={<Pencil />} onClick={() => setEditing(r)} />
        ),
    },
  ];
  const errors = apiErrors(grid.error, t("common.loadFailed"));
  return (
    <Card variant="solid" title={t("wpsTracking.title")} subtitle={t("wpsTracking.hint")}>
      {grid.isError && <Alert className="mb-4">{errors.general}</Alert>}
      <DataTable caption={t("wpsTracking.title")} columns={columns} rows={grid.data?.rows ?? []} rowKey={(r) => `${r.establishment}-${r.month}`} loading={grid.isPending} minWidth={1000} />
      {editing && <RecordDialog row={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function RecordDialog({ row, onClose }: { row: WpsMonthRow; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const [v, setV] = useState({ uploaded_on: row.uploaded_on ?? "", mudad_reference: row.mudad_reference, result: row.result, mudad_percent: row.mudad_percent ?? "", note: row.note });
  const save = useMutation({
    mutationFn: () =>
      wpsApi.record(row.establishment, row.month.slice(0, 7), {
        uploaded_on: v.uploaded_on || null,
        mudad_reference: v.mudad_reference,
        result: v.result,
        mudad_percent: v.mudad_percent || null,
        note: v.note,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["wps"] });
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("wpsTracking.record", { month: format.date(row.month, "monthYear"), number: row.number || t("establishments.noNumber") })}
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
        <p className="text-sm text-muted">{t("wpsTracking.recordHint")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <DateInput label={t("wpsTracking.uploadedOn")} name="uploaded_on" value={v.uploaded_on} onChange={(value) => setV({ ...v, uploaded_on: value ?? "" })} error={errors.fields.uploaded_on} />
          <TextField label={t("wpsTracking.reference")} name="mudad_reference" dir="ltr" value={v.mudad_reference} onChange={(e) => setV({ ...v, mudad_reference: e.target.value })} error={errors.fields.mudad_reference} />
          <FormSelect label={t("wpsTracking.result")} name="result" value={v.result} onChange={(e) => setV({ ...v, result: e.target.value as WpsResult })} options={[{ value: "", label: "—" }, ...RESULTS.map((r) => ({ value: r, label: t(`wpsTracking.results.${r}`) }))]} />
          <TextField label={t("wpsTracking.percent")} name="mudad_percent" type="number" min={0} max={100} inputMode="decimal" dir="ltr" value={v.mudad_percent} onChange={(e) => setV({ ...v, mudad_percent: e.target.value })} error={errors.fields.mudad_percent} />
        </div>
        <TextField label={t("wpsTracking.note")} name="note" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} />
        {(errors.fields.detail || errors.general) && <Alert>{errors.fields.detail ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
