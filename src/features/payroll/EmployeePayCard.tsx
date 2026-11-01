import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type Employee, holds } from "@/api";
import { components, type EmployeeComponent, employeePay, payslips, structures } from "@/api/payroll";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { Dialog } from "@/design/Dialog";
import { FormSelect, TextField } from "@/design/Field";
import { Money } from "@/design/Money";
import { Pill } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { toISODate } from "@/lib/format";
import { useFormat } from "@/lib/useFormat";

import { AdvancesCard } from "./AdvancesCard";
import { CostSplitCard } from "./CostSplitCard";
import { PayslipList } from "./MyPayslipsPage";
import { EmployeeGosiCard } from "./EmployeeGosiCard";
import { EosbCard } from "./EosbCard";
import { LeaveEncashmentCard } from "./LeaveEncashmentCard";
import { PayCalculationCard } from "./PayCalculationCard";

const KIND_TONES = { earning: "green", deduction: "salmon", employer_cost: "navy" } as const;

/** The employee's monthly components (Phase 4 task 3) in their file's salary tab: the structure in use and where it
 * comes from, each part of the month (split where the package, job or branch changes) with its fixed, percent and
 * formula amounts, and the employee's own recurring amounts. Attendance, inputs and deductions come with the run. */
export function EmployeePayCard({ employee }: { employee: Employee }) {
  const { t } = useTranslation();
  const { hasModule } = useSession();
  const format = useFormat();
  const scope = useScopeKey();
  const queryClient = useQueryClient();
  const change = holds(employee, "employees.change_salary");
  const [month, setMonth] = useState(() => toISODate(new Date()).slice(0, 7));
  const first = new Date(`${month}-01T00:00:00`);
  const pay = useQuery({ queryKey: ["employee-pay", employee.id, month], queryFn: () => employeePay.get(employee.id, month) });
  const own = useQuery({ queryKey: ["employee-components", employee.id], queryFn: () => employeePay.components(employee.id) });
  const all = useQuery({ queryKey: ["pay-components", ...scope], queryFn: components.list, enabled: change });
  const options = useQuery({ queryKey: ["salary-structures", ...scope], queryFn: structures.list, enabled: change });
  const [adding, setAdding] = useState(false);
  const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: ["employee-pay", employee.id] }), queryClient.invalidateQueries({ queryKey: ["employee-components", employee.id] })]);
  const setStructure = useMutation({ mutationFn: (id: number | null) => employeePay.setStructure(employee.id, id), onSuccess: refresh });
  const removeOwn = useMutation({ mutationFn: employeePay.removeComponent, onSuccess: refresh });
  const move = (step: number) => setMonth(toISODate(new Date(first.getFullYear(), first.getMonth() + step, 1)).slice(0, 7));
  const title = `${format.months()[first.getMonth()]} ${first.getFullYear()}`;
  const componentName = (id: number) => {
    const c = all.data?.find((x) => x.id === id);
    return c ? `${c.code} — ${format.name(c)}` : "";
  };
  const parts = pay.data?.parts ?? [];
  const source = parts[parts.length - 1]?.structure_source;

  return (
    <div className="flex flex-col gap-4">
      <Card
        variant="solid"
        title={t("employeePay.title")}
        subtitle={t("employeePay.hint")}
        action={
          <div className="flex items-center gap-1">
            <IconButton size="sm" variant="plain" label={t("employeeMonth.previous")} icon={<ChevronRight className="ltr:rotate-180" />} onClick={() => move(-1)} />
            <span className="num min-w-32 text-center font-semibold">{title}</span>
            <IconButton size="sm" variant="plain" label={t("employeeMonth.next")} icon={<ChevronLeft className="ltr:rotate-180" />} onClick={() => move(1)} />
          </div>
        }
      >
        {pay.isError && <Alert>{t("common.loadFailed")}</Alert>}
        {change && pay.data && (
          <div className="mb-4 max-w-md">
            <FormSelect
              label={t("employeePay.structure")}
              name="structure"
              value={pay.data.structure_set ? String(pay.data.structure_set) : ""}
              disabled={setStructure.isPending}
              placeholder={t("employeePay.structureAuto")}
              onChange={(e) => setStructure.mutate(e.target.value ? Number(e.target.value) : null)}
              options={(options.data ?? []).filter((s) => s.is_active).map((s) => ({ value: String(s.id), label: format.name(s) }))}
              hint={source ? t(`employeePay.source.${source}`) : undefined}
              error={apiErrors(setStructure.error, t("common.saveFailed")).general}
            />
          </div>
        )}
        <div className="flex flex-col gap-4">
          {parts.map((part) => {
            const net = part.lines.reduce((sum, ln) => sum + (ln.kind === "earning" ? 1 : ln.kind === "deduction" ? -1 : 0) * Number(ln.amount), 0);
            return (
              <section key={part.start} aria-label={format.dateRange(part.start, part.end)} className="rounded-card border border-line p-4">
                <header className="mb-3 flex flex-wrap items-center gap-2">
                  {parts.length > 1 && <span className="num font-semibold">{format.dateRange(part.start, part.end)}</span>}
                  {part.structure && <Pill tone="teal">{format.name(part.structure)}</Pill>}
                  {!change && <span className="text-sm text-muted">{t(`employeePay.source.${part.structure_source}`)}</span>}
                </header>
                {part.errors.map((e) => (
                  <Alert key={e} tone="warning">
                    {e}
                  </Alert>
                ))}
                <table className="w-full text-sm">
                  <caption className="sr-only">{t("employeePay.title")}</caption>
                  <thead className="text-muted">
                    <tr>
                      <th scope="col" className="py-1 text-start font-medium">{t("components.name")}</th>
                      <th scope="col" className="py-1 text-start font-medium">{t("employeePay.how")}</th>
                      <th scope="col" className="py-1 text-end font-medium">{t("employeePay.amount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {part.lines.map((ln) => (
                      <tr key={ln.code} className="border-t border-line">
                        <td className="py-2">
                          <span className="flex items-center gap-2">
                            <Pill tone={KIND_TONES[ln.kind]}>{t(`components.kinds.${ln.kind}`)}</Pill>
                            <span>{format.name(ln)}</span>
                          </span>
                        </td>
                        <td className="py-2 text-muted">
                          {t(`employeePay.hows.${ln.how}`)}
                          {ln.formula && (
                            <span dir="ltr" className="num ms-2 text-xs">
                              {ln.formula}
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-end">
                          <Money amount={ln.amount} currency={part.currency} fractionDigits={[2, 2]} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-line-strong font-semibold">
                      <td className="py-2" colSpan={2}>
                        {t("employeePay.fixedNet")}
                      </td>
                      <td className="py-2 text-end">
                        <Money amount={net.toFixed(2)} currency={part.currency} fractionDigits={[2, 2]} />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </section>
            );
          })}
        </div>
      </Card>
      {pay.data?.calculation && <PayCalculationCard calc={pay.data.calculation} employeeId={employee.id} canFile={holds(employee, "employees.manage_discipline")} />}
      <Card
        variant="solid"
        title={t("employeePay.ownTitle")}
        subtitle={t("employeePay.ownHint")}
        action={change && <Button size="sm" variant="accent" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>{t("employeePay.addOwn")}</Button>}
      >
        {(own.data ?? []).length === 0 ? (
          <p className="text-muted">{t("employeePay.noOwn")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {own.data!.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-card border border-line px-4 py-2">
                <span className="flex-1 font-medium">{componentName(c.component) || `#${c.component}`}</span>
                <Money amount={c.amount} fractionDigits={[2, 2]} />
                <span className="num text-sm text-muted">{c.end_date ? format.dateRange(c.start_date, c.end_date) : t("employeePay.from", { date: format.date(c.start_date) })}</span>
                {c.note && <span className="text-sm text-muted">{c.note}</span>}
                {change && <IconButton size="xs" variant="danger" label={t("common.delete")} icon={<Trash2 />} disabled={removeOwn.isPending} onClick={() => removeOwn.mutate(c.id)} />}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <EmployeeGosiCard employee={employee} />
      <AdvancesCard employee={employee} />
      <CostSplitCard employee={employee} />
      {employee.hire_date && <EosbCard employee={employee} />}
      {employee.hire_date && hasModule("leave") && <LeaveEncashmentCard employee={employee} />}
      <EmployeePayslips employee={employee} />
      {adding && <OwnComponentDialog employee={employee} onClose={() => setAdding(false)} onSaved={refresh} />}
    </div>
  );
}

function OwnComponentDialog({ employee, onClose, onSaved }: { employee: Employee; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const all = useQuery({ queryKey: ["pay-components", ...scope], queryFn: components.list });
  const [v, setV] = useState<Omit<EmployeeComponent, "id">>({ employee: employee.id, component: 0, amount: "", start_date: toISODate(new Date()), end_date: null, note: "" });
  const save = useMutation({
    mutationFn: () => employeePay.addComponent(v),
    onSuccess: async () => {
      await onSaved();
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const usable = (all.data ?? []).filter((c) => c.is_active && c.method === "fixed");
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("employeePay.addOwn")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!v.component || !v.amount || !v.start_date || save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormSelect label={t("employeePay.component")} name="component" value={v.component ? String(v.component) : ""} placeholder={t("components.choose")} onChange={(e) => setV({ ...v, component: Number(e.target.value) })} options={usable.map((c) => ({ value: String(c.id), label: `${c.code} — ${format.name(c)}` }))} error={errors.fields.component} />
        <TextField label={t("employeePay.amount")} name="amount" dir="ltr" inputMode="decimal" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} error={errors.fields.amount} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("employeePay.start")} name="start_date" type="date" value={v.start_date} onChange={(e) => setV({ ...v, start_date: e.target.value })} error={errors.fields.start_date} />
          <TextField label={t("employeePay.end")} name="end_date" type="date" value={v.end_date ?? ""} onChange={(e) => setV({ ...v, end_date: e.target.value || null })} error={errors.fields.end_date} />
        </div>
        <TextField label={t("employeePay.note")} name="note" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} />
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

/** The employee's published payslips in their file (employees.view_salary over them). */
function EmployeePayslips({ employee }: { employee: Employee }) {
  const { t } = useTranslation();
  const list = useQuery({ queryKey: ["payslips", "of", employee.id], queryFn: () => payslips.of(employee.id) });
  return <PayslipList title={t("payslips.ofEmployee")} rows={list.data ?? []} loading={list.isPending} empty={t("payslips.none")} />;
}
