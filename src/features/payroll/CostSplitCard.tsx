import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Employee } from "@/api";
import { accounting } from "@/api/payroll";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { FormSelect, TextField } from "@/design/Field";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

type Row = { cost_center: string; percent: string };

/** The employee's own cost center split (#103, Phase 4 task 20) in their salary tab: percents adding up to 100.
 * Empty: their department's, else their branch's, else the company's default cost center. */
export function CostSplitCard({ employee }: { employee: Employee }) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const { can } = useSession();
  const manage = can("payroll.manage_settings");
  const queryClient = useQueryClient();
  const centers = useQuery({ queryKey: ["cost-centers", ...scope], queryFn: accounting.centers });
  const allocations = useQuery({ queryKey: ["cost-allocations", ...scope], queryFn: accounting.allocations });
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    if (allocations.data) setRows((allocations.data.employee[String(employee.id)] ?? []).map((r) => ({ cost_center: String(r.cost_center), percent: r.percent })));
  }, [allocations.data, employee.id]);
  const save = useMutation({
    mutationFn: () => accounting.allocate("employee", employee.id, rows.map((r) => ({ cost_center: Number(r.cost_center), percent: r.percent }))),
    onSuccess: (data) => queryClient.setQueryData(["cost-allocations", ...scope], data),
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const total = rows.reduce((sum, r) => sum + (Number(r.percent) || 0), 0);
  const options = (centers.data ?? []).filter((c) => c.is_active).map((c) => ({ value: String(c.id), label: `${c.code} — ${format.name(c)}` }));
  if (!centers.data?.length) return null;
  return (
    <Card variant="solid" title={t("accounting.splitTitle")} subtitle={t("accounting.splitHint")}>
      <div className="flex flex-col gap-3">
        {rows.length === 0 && <p className="text-sm text-muted">{t("accounting.followDefault")}</p>}
        {rows.map((row, i) => (
          <div key={i} className="grid items-end gap-3 sm:grid-cols-[1fr_8rem_auto]">
            <FormSelect label={t("accounting.fields.cost_center")} name={`center-${i}`} value={row.cost_center} disabled={!manage} placeholder={t("common.choose")} onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, cost_center: e.target.value } : r)))} options={options} />
            <TextField label={t("accounting.percent")} name={`percent-${i}`} dir="ltr" inputMode="decimal" value={row.percent} disabled={!manage} onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, percent: e.target.value } : r)))} />
            {manage && <IconButton size="sm" variant="plain" label={t("accounting.removeRow")} icon={<Trash2 />} onClick={() => setRows(rows.filter((_r, j) => j !== i))} />}
          </div>
        ))}
        {rows.length > 0 && <p className={`num text-sm ${total === 100 ? "text-muted" : "text-danger"}`}>{t("accounting.total", { n: format.number(total, [0, 2]) })}</p>}
        {(errors.fields.rows || errors.general) && <Alert>{errors.fields.rows ?? errors.general}</Alert>}
        {manage && (
          <div className="flex justify-between gap-2">
            <Button size="sm" variant="outline" icon={<Plus className="size-4" />} onClick={() => setRows([...rows, { cost_center: "", percent: rows.length ? String(Math.max(0, 100 - total)) : "100" }])}>
              {t("accounting.addRow")}
            </Button>
            <Button size="sm" disabled={save.isPending || (rows.length > 0 && (total !== 100 || rows.some((r) => !r.cost_center)))} onClick={() => save.mutate()}>
              {t("common.save")}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
