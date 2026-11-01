import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { gosi, type GosiRateRow } from "@/api/payroll";
import { useScopeKey } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { Dialog } from "@/design/Dialog";
import { TextField } from "@/design/Field";
import { Pill } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

/** GOSI rates (Phase 4 task 7): each branch's employee and employer percent, by nationality, first registration
 * (the 2024 Social Insurance Law) and the date it applies from. Shared by every company of the account. */
export function GosiRatesTab() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const table = useQuery({ queryKey: ["gosi-rates", ...scope], queryFn: gosi.rates });
  const [editing, setEditing] = useState<GosiRateRow | null>(null);
  const columns: Column<GosiRateRow>[] = [
    { id: "branch", header: t("gosi.branch"), cell: (r) => <span className="font-medium">{t(`gosi.branches.${r.branch}`)}</span> },
    { id: "who", header: t("gosi.who"), cell: (r) => <Pill tone={r.saudi ? "green" : "sky"}>{t(r.saudi ? "gosi.saudis" : "gosi.nonSaudis")}</Pill> },
    {
      id: "cohort",
      header: t("gosi.cohort"),
      cell: (r) => (
        <span className="num text-sm">
          {r.registered_from ? t("gosi.registeredFrom", { date: format.date(r.registered_from) }) : r.registered_until ? t("gosi.registeredUntil", { date: format.date(r.registered_until) }) : t("gosi.everyone")}
        </span>
      ),
    },
    { id: "from", header: t("gosi.effectiveFrom"), cell: (r) => <span className="num">{format.date(r.effective_from)}</span> },
    { id: "ee", header: t("gosi.employee"), cell: (r) => <span className="num">{format.number(r.employee_percent, [0, 2])}%</span> },
    { id: "er", header: t("gosi.employer"), cell: (r) => <span className="num">{format.number(r.employer_percent, [0, 2])}%</span> },
    { id: "source", header: t("gosi.source"), cell: (r) => <span className="text-xs text-muted">{r.source}</span> },
    ...(table.data?.can_change ? [{ id: "edit", header: <span className="sr-only">{t("common.actions")}</span>, cell: (r: GosiRateRow) => <IconButton size="sm" variant="plain" label={t("gosi.editRate")} icon={<Pencil />} onClick={() => setEditing(r)} /> }] : []),
  ];
  return (
    <Card variant="solid" title={t("gosi.ratesTitle")} subtitle={t("gosi.ratesHint")}>
      <Alert tone="warning" className="mb-4">
        {t("gosi.toConfirm")}
      </Alert>
      <DataTable caption={t("gosi.ratesTitle")} columns={columns} rows={table.data?.rows ?? []} rowKey={(r) => String(r.id)} loading={table.isPending} minWidth={900} />
      {editing && <RateDialog rate={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function RateDialog({ rate, onClose }: { rate: GosiRateRow; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [v, setV] = useState({ employee_percent: rate.employee_percent, employer_percent: rate.employer_percent, effective_from: rate.effective_from, source: rate.source });
  const save = useMutation({
    mutationFn: () => gosi.saveRate(rate.id, v),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["gosi-rates"] });
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      onClose={onClose}
      title={`${t(`gosi.branches.${rate.branch}`)} · ${t(rate.saudi ? "gosi.saudis" : "gosi.nonSaudis")}`}
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
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={`${t("gosi.employee")} (%)`} name="employee_percent" dir="ltr" inputMode="decimal" value={v.employee_percent} onChange={(e) => setV({ ...v, employee_percent: e.target.value })} error={errors.fields.employee_percent} />
          <TextField label={`${t("gosi.employer")} (%)`} name="employer_percent" dir="ltr" inputMode="decimal" value={v.employer_percent} onChange={(e) => setV({ ...v, employer_percent: e.target.value })} error={errors.fields.employer_percent} />
        </div>
        <TextField label={t("gosi.effectiveFrom")} name="effective_from" type="date" value={v.effective_from} onChange={(e) => setV({ ...v, effective_from: e.target.value })} error={errors.fields.effective_from} />
        <TextField label={t("gosi.source")} name="source" value={v.source} onChange={(e) => setV({ ...v, source: e.target.value })} />
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
