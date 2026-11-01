import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { endpoints } from "@/api/index";
import { type BudgetBody, type HeadcountBudget, recruitment } from "@/api/recruitment";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { Dialog } from "@/design/Dialog";
import { FormSelect, TextField } from "@/design/Field";
import { Money } from "@/design/Money";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

/** The headcount budget (#114): positions per department and year, optionally a monthly basic + housing line, and
 * their use now (people in the department + what open requisitions ask for). HR (recruitment.manage_budget)
 * changes it; money needs salary access. */
export function BudgetsCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const { can } = useSession();
  const scope = useScopeKey();
  const queryClient = useQueryClient();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [editing, setEditing] = useState<HeadcountBudget | "new" | null>(null);
  const manage = can("recruitment.manage_budget");
  const money = can("employees.view_salary");
  const list = useQuery({ queryKey: ["headcount-budgets", year, ...scope], queryFn: () => recruitment.budgets(year) });
  const remove = useMutation({
    mutationFn: (row: HeadcountBudget) => recruitment.deleteBudget(row.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["headcount-budgets"] }),
  });
  const columns: Column<HeadcountBudget>[] = [
    { id: "department", header: t("recruitment.requisition.department"), cell: (b) => <span className="font-semibold text-ink">{format.name(b.department_name)}</span> },
    { id: "positions", header: t("recruitment.budgets.positions"), cell: (b) => <span className="num">{format.number(b.positions)}</span> },
    { id: "headcount", header: t("recruitment.budgets.headcount"), cell: (b) => <span className="num">{format.number(b.use.headcount ?? 0)}</span> },
    { id: "committed", header: t("recruitment.budgets.committed"), cell: (b) => <span className="num">{format.number(b.use.committed ?? 0)}</span> },
    {
      id: "available",
      header: t("recruitment.budgets.available"),
      cell: (b) => <span className={`num font-semibold ${(b.use.available ?? 0) < 0 ? "text-danger" : "text-ink"}`}>{format.number(b.use.available ?? 0)}</span>,
    },
    ...(money
      ? [
          {
            id: "salaries",
            header: t("recruitment.budgets.salaries"),
            cell: (b: HeadcountBudget) =>
              b.monthly_salaries ? (
                <span className="flex flex-col">
                  <Money amount={b.monthly_salaries} />
                  {b.use.salaries_used && (
                    <span className="text-sm text-muted">
                      {t("recruitment.budgets.salariesUsed")} <Money amount={b.use.salaries_used} />
                    </span>
                  )}
                </span>
              ) : (
                "—"
              ),
          },
        ]
      : []),
  ];
  return (
    <Card
      title={t("recruitment.budgets.title")}
      subtitle={t("recruitment.budgets.subtitle")}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <FormSelect label={t("recruitment.budgets.year")} name="year" className="w-32" value={String(year)} onChange={(e) => setYear(Number(e.target.value))} options={[thisYear - 1, thisYear, thisYear + 1].map((y) => ({ value: String(y), label: String(y) }))} />
          {manage && (
            <Button variant="accent" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
              {t("recruitment.budgets.add")}
            </Button>
          )}
        </div>
      }
    >
      <DataTable
        caption={t("recruitment.budgets.title")}
        columns={columns}
        rows={list.data?.results ?? []}
        rowKey={(b) => String(b.id)}
        rowLabel={(b) => format.name(b.department_name)}
        loading={list.isPending}
        minWidth={720}
        empty={t("recruitment.budgets.empty")}
        onEdit={manage ? (b) => setEditing(b) : undefined}
        onDelete={manage ? (b) => remove.mutate(b) : undefined}
      />
      {remove.isError && <Alert className="mt-3">{apiErrors(remove.error, t("common.saveFailed")).general}</Alert>}
      {editing !== null && <BudgetDialog row={editing === "new" ? null : editing} year={year} money={money} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function BudgetDialog({ row, year, money, onClose }: { row: HeadcountBudget | null; year: number; money: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const departments = useQuery({ queryKey: ["departments"], queryFn: endpoints.departments });
  const [v, setV] = useState<BudgetBody>(
    row ? { department: row.department, year: row.year, positions: row.positions, monthly_salaries: row.monthly_salaries ?? "", note: row.note } : { department: null, year, positions: 1, monthly_salaries: "", note: "" },
  );
  const save = useMutation({
    mutationFn: () => {
      const body: BudgetBody = { ...v, monthly_salaries: v.monthly_salaries || null };
      if (!money) delete body.monthly_salaries;
      return row ? recruitment.updateBudget(row.id, body) : recruitment.createBudget(body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["headcount-budgets"] });
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      onClose={onClose}
      title={row ? t("recruitment.budgets.edit") : t("recruitment.budgets.add")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="accent" disabled={save.isPending || !v.department} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormSelect label={t("recruitment.requisition.department")} name="department" placeholder={t("common.choose")} value={v.department ?? ""} onChange={(e) => setV({ ...v, department: e.target.value ? Number(e.target.value) : null })} options={(departments.data?.results ?? []).map((d) => ({ value: String(d.id), label: format.name(d) }))} error={errors.fields.department} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("recruitment.budgets.year")} name="year" type="number" dir="ltr" value={String(v.year)} onChange={(e) => setV({ ...v, year: Number(e.target.value) })} error={errors.fields.year} />
          <TextField label={t("recruitment.budgets.positions")} name="positions" type="number" min={0} dir="ltr" value={String(v.positions)} onChange={(e) => setV({ ...v, positions: Math.max(0, Number(e.target.value) || 0) })} error={errors.fields.positions} />
        </div>
        {money && <TextField label={t("recruitment.budgets.salaries")} hint={t("recruitment.budgets.salariesHint")} name="monthly_salaries" inputMode="decimal" dir="ltr" value={v.monthly_salaries ?? ""} onChange={(e) => setV({ ...v, monthly_salaries: e.target.value })} error={errors.fields.monthly_salaries} />}
        <TextField label={t("recruitment.budgets.note")} name="note" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} />
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
