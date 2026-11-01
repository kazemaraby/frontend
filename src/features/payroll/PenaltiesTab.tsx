import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type Penalty, type PenaltyRuleRow, penalties, type PenaltyType } from "@/api/payroll";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { Dialog } from "@/design/Dialog";
import { CheckField, FormSelect, TextField } from "@/design/Field";
import { Pill } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

const TYPES: PenaltyType[] = ["warning", "percent", "days", "days_or_hold", "dismissal_award", "dismissal_art80"];
const WITH_VALUE: PenaltyType[] = ["percent", "days", "days_or_hold"];

/** One penalty as words: "إنذار كتابي", "حسم 5%", "حسم يومين"… */
export function usePenaltyText() {
  const { t } = useTranslation();
  const format = useFormat();
  return (p: Penalty) => t(`penalties.types.${p.type}`, { value: format.number(p.value ?? 0), count: p.value ?? 0 });
}

/** The working-hours penalty table (Phase 4 task 6), seeded from the MHRSD model work regulation (decision 4). The
 * account's table applies to every company until a company takes its own copy. The payroll deducts only the wage of
 * the time lost (rows that say so); the penalties are proposed for a disciplinary decision (Art. 71). */
export function PenaltiesTab() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const { can } = useSession();
  const queryClient = useQueryClient();
  const manage = can("payroll.manage_settings");
  const table = useQuery({ queryKey: ["attendance-penalties", ...scope], queryFn: penalties.table });
  const text = usePenaltyText();
  const [editing, setEditing] = useState<PenaltyRuleRow | null>(null);
  const done = (data: unknown) => queryClient.setQueryData(["attendance-penalties", ...scope], data);
  const copy = useMutation({ mutationFn: penalties.copy, onSuccess: done });
  const reset = useMutation({ mutationFn: penalties.reset, onSuccess: done });
  const own = table.data?.level === "company";
  const editable = manage && (own || table.data?.can_change_account);
  const unit = (row: PenaltyRuleRow) => t(row.kind === "absence" ? "penalties.days" : "penalties.minutes");
  const columns: Column<PenaltyRuleRow>[] = [
    { id: "number", header: t("penalties.row"), cell: (r) => <span className="num">{format.number(r.number)}</span>, className: "w-16" },
    {
      id: "violation",
      header: t("penalties.violation"),
      cell: (r) => (
        <span className="flex flex-col gap-1">
          <span className="font-medium">{t(`penalties.kinds.${r.kind}`)}</span>
          <span className="num text-sm text-muted">
            {r.max_value === null ? t("penalties.over", { from: format.number(r.min_value), unit: unit(r) }) : t("penalties.range", { from: format.number(r.min_value), to: format.number(r.max_value), unit: unit(r) })}
          </span>
          {r.delays_others && <Pill tone="amber">{t("penalties.delaysOthers")}</Pill>}
        </span>
      ),
    },
    ...[0, 1, 2, 3].map((i) => ({ id: `p${i}`, header: t(`penalties.times.${i}`), cell: (r: PenaltyRuleRow) => <span className="text-sm">{r.penalties[i] ? text(r.penalties[i]) : "—"}</span> })),
    { id: "time", header: t("penalties.timeLost"), cell: (r) => (r.deduct_time ? <Pill tone="teal">{t("penalties.deducted")}</Pill> : <span className="text-muted">—</span>) },
    ...(editable ? [{ id: "edit", header: <span className="sr-only">{t("common.actions")}</span>, cell: (r: PenaltyRuleRow) => <IconButton size="sm" variant="plain" label={t("penalties.editRow", { row: r.number })} icon={<Pencil />} onClick={() => setEditing(r)} /> }] : []),
  ];
  return (
    <Card
      variant="solid"
      title={t("penalties.title")}
      subtitle={t("penalties.hint")}
      action={
        manage &&
        table.data &&
        (own ? (
          <Button size="sm" variant="outline" disabled={reset.isPending} onClick={() => reset.mutate()}>
            {t("penalties.reset")}
          </Button>
        ) : (
          <Button size="sm" variant="accent" disabled={copy.isPending} onClick={() => copy.mutate()}>
            {t("penalties.copy")}
          </Button>
        ))
      }
    >
      <Alert tone="info" className="mb-4">
        {t(own ? "penalties.levelCompany" : "penalties.levelAccount")} {t("penalties.art71")}
      </Alert>
      <DataTable caption={t("penalties.title")} columns={columns} rows={table.data?.rows ?? []} rowKey={(r) => String(r.id)} loading={table.isPending} minWidth={980} />
      {editing && <RuleDialog row={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function RuleDialog({ row, onClose }: { row: PenaltyRuleRow; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [v, setV] = useState({ min_value: String(row.min_value), max_value: row.max_value === null ? "" : String(row.max_value), penalties: row.penalties.map((p) => ({ ...p })), deduct_time: row.deduct_time, delays_others: row.delays_others });
  const save = useMutation({
    mutationFn: () =>
      penalties.save(row.id, {
        min_value: Number(v.min_value),
        max_value: v.max_value === "" ? null : Number(v.max_value),
        penalties: v.penalties.map((p) => (WITH_VALUE.includes(p.type) ? { type: p.type, value: Number(p.value) } : { type: p.type })),
        deduct_time: v.deduct_time,
        delays_others: v.delays_others,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["attendance-penalties"] });
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const setPenalty = (i: number, patch: Partial<Penalty>) => setV((x) => ({ ...x, penalties: x.penalties.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));
  const unit = t(row.kind === "absence" ? "penalties.days" : "penalties.minutes");
  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={t("penalties.editRow", { row: row.number })}
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
        <p className="font-medium">{t(`penalties.kinds.${row.kind}`)}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={`${t("penalties.from")} (${unit})`} name="min_value" dir="ltr" inputMode="numeric" value={v.min_value} onChange={(e) => setV({ ...v, min_value: e.target.value })} error={errors.fields.min_value} />
          <TextField label={`${t("penalties.to")} (${unit})`} name="max_value" dir="ltr" inputMode="numeric" value={v.max_value} hint={t("penalties.noLimit")} onChange={(e) => setV({ ...v, max_value: e.target.value })} error={errors.fields.max_value} />
        </div>
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-1 font-semibold text-ink">{t("penalties.penaltiesTitle")}</legend>
          {v.penalties.map((p, i) => (
            <div key={i} className="flex gap-2 rounded-card border border-line p-3">
              <FormSelect label={t(`penalties.times.${i}`)} name={`type-${i}`} value={p.type} onChange={(e) => setPenalty(i, { type: e.target.value as PenaltyType })} options={TYPES.map((type) => ({ value: type, label: t(`penalties.typeNames.${type}`) }))} />
              {WITH_VALUE.includes(p.type) && (
                <TextField label={p.type === "percent" ? "%" : t("penalties.days")} name={`value-${i}`} dir="ltr" inputMode="decimal" value={String(p.value ?? "")} onChange={(e) => setPenalty(i, { value: Number(e.target.value) })} className="w-24" />
              )}
            </div>
          ))}
        </fieldset>
        {errors.fields.penalties && <Alert>{errors.fields.penalties}</Alert>}
        <CheckField label={t("penalties.deductTime")} checked={v.deduct_time} onChange={(e) => setV({ ...v, deduct_time: e.target.checked })} />
        <CheckField label={t("penalties.delaysOthersLong")} checked={v.delays_others} onChange={(e) => setV({ ...v, delays_others: e.target.checked })} />
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
