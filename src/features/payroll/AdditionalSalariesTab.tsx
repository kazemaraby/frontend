import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { hr } from "@/api/hr";
import { additional, type AdditionalInput, type AdditionalSalary, components } from "@/api/payroll";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable, PersonCell } from "@/design/DataTable";
import { Dialog } from "@/design/Dialog";
import { FormSelect, TextField } from "@/design/Field";
import { Money } from "@/design/Money";
import { Pill } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

const KIND_TONES = { earning: "green", deduction: "salmon", employer_cost: "navy" } as const;

/** Additional salaries (#96, Phase 4 task 8): the month's one-off amounts per employee — a bonus, a commission, a
 * one-off deduction — on the monthly-input components; entered here or imported from Excel. */
export function AdditionalSalariesTab({ month }: { month: string }) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const { can } = useSession();
  const manage = can("payroll.manage");
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ["additional-salaries", month, ...scope], queryFn: () => additional.list(month) });
  const [editing, setEditing] = useState<AdditionalSalary | "new" | null>(null);
  const remove = useMutation({ mutationFn: additional.remove, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["additional-salaries"] }) });
  const rows = list.data ?? [];
  const sum = (kind: string) => rows.filter((r) => r.component_info.kind === kind).reduce((s, r) => s + Number(r.amount), 0).toFixed(2);
  const columns: Column<AdditionalSalary>[] = [
    { id: "no", header: t("payroll.columns.number"), cell: (r) => <span className="num font-semibold">{r.employee_info.employee_no}</span>, className: "w-32" },
    { id: "name", header: t("payroll.columns.name"), cell: (r) => <PersonCell name={format.name(r.employee_info)} /> },
    {
      id: "component",
      header: t("components.name"),
      cell: (r) => (
        <span className="flex flex-wrap items-center gap-2">
          <Pill tone={KIND_TONES[r.component_info.kind]}>{t(`components.kinds.${r.component_info.kind}`)}</Pill>
          <span>{format.name(r.component_info)}</span>
          {r.component_info.in_gosi_wage && <Pill tone="teal">{t("components.short.in_gosi_wage")}</Pill>}
          {r.component_info.in_eosb_wage && <Pill tone="teal">{t("components.short.in_eosb_wage")}</Pill>}
        </span>
      ),
    },
    { id: "amount", header: t("employeePay.amount"), cell: (r) => <Money amount={r.amount} fractionDigits={[2, 2]} className={r.component_info.kind === "deduction" ? "text-danger" : "font-semibold"} /> },
    { id: "note", header: t("gosi.note"), cell: (r) => <span className="text-sm text-muted">{r.note || "—"}</span> },
    ...(manage
      ? [
          {
            id: "actions",
            header: <span className="sr-only">{t("common.actions")}</span>,
            cell: (r: AdditionalSalary) => (
              <span className="flex gap-1">
                <IconButton size="sm" variant="plain" label={t("common.editNamed", { name: format.name(r.employee_info) })} icon={<Pencil />} onClick={() => setEditing(r)} />
                <IconButton size="sm" variant="danger" label={t("common.delete")} icon={<Trash2 />} disabled={remove.isPending} onClick={() => remove.mutate(r.id)} />
              </span>
            ),
          },
        ]
      : []),
  ];
  return (
    <Card
      title={t("additional.title")}
      subtitle={t("additional.hint")}
      action={
        manage && (
          <span className="flex flex-wrap gap-2">
            <Link to="/payroll/import-additional" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong bg-white px-4 text-sm text-ink hover:bg-neutral-soft">
              <FileSpreadsheet className="size-4" /> {t("additional.import")}
            </Link>
            <Button size="sm" variant="accent" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
              {t("additional.add")}
            </Button>
          </span>
        )
      }
    >
      <div className="mb-4 flex flex-wrap gap-6 text-sm">
        <span>
          {t("additional.earnings")} <Money amount={sum("earning")} fractionDigits={[2, 2]} className="font-semibold" />
        </span>
        <span>
          {t("additional.deductions")} <Money amount={sum("deduction")} fractionDigits={[2, 2]} className="font-semibold text-danger" />
        </span>
      </div>
      <DataTable caption={t("additional.title")} columns={columns} rows={rows} rowKey={(r) => String(r.id)} loading={list.isPending} empty={t("additional.none")} minWidth={900} />
      {editing && <AdditionalDialog month={month} row={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function AdditionalDialog({ month, row, onClose }: { month: string; row?: AdditionalSalary; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const queryClient = useQueryClient();
  const all = useQuery({ queryKey: ["pay-components", ...scope], queryFn: components.list });
  const [search, setSearch] = useState("");
  const people = useQuery({ queryKey: ["employees", "search", search, ...scope], queryFn: () => hr.searchEmployees(search), enabled: !row, placeholderData: (p) => p });
  const [v, setV] = useState<AdditionalInput>(row ? { employee: row.employee, component: row.component, month: row.month, amount: row.amount, note: row.note } : { employee: 0, component: 0, month, amount: "", note: "" });
  const save = useMutation({
    mutationFn: () => additional.save(v, row?.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["additional-salaries"] });
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const usable = (all.data ?? []).filter((c) => c.method === "monthly_input" && c.is_active);
  return (
    <Dialog
      open
      onClose={onClose}
      title={row ? t("common.editNamed", { name: format.name(row.employee_info) }) : t("additional.add")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!v.employee || !v.component || !v.amount || save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!row && (
          <>
            <TextField label={t("additional.findEmployee")} type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
            <FormSelect label={t("additional.employee")} name="employee" value={v.employee ? String(v.employee) : ""} placeholder={t("components.choose")} onChange={(e) => setV({ ...v, employee: Number(e.target.value) })} options={(people.data?.results ?? []).map((e) => ({ value: String(e.id), label: `${format.name(e)} · ${e.employee_no}` }))} error={errors.fields.employee} />
          </>
        )}
        <FormSelect label={t("components.name")} name="component" value={v.component ? String(v.component) : ""} placeholder={t("components.choose")} onChange={(e) => setV({ ...v, component: Number(e.target.value) })} options={usable.map((c) => ({ value: String(c.id), label: `${format.name(c)} (${t(`components.kinds.${c.kind}`)})` }))} error={errors.fields.component} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("additional.month")} name="month" type="month" value={v.month} onChange={(e) => setV({ ...v, month: e.target.value })} error={errors.fields.month} />
          <TextField label={t("employeePay.amount")} name="amount" dir="ltr" inputMode="decimal" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} error={errors.fields.amount} />
        </div>
        <TextField label={t("gosi.note")} name="note" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} />
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
