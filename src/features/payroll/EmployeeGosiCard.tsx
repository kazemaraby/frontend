import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { type Employee, holds } from "@/api";
import { type EmployeeGosi, gosi } from "@/api/payroll";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { CheckField, FormSelect, TextField } from "@/design/Field";
import { Money } from "@/design/Money";
import { Pill } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { toISODate } from "@/lib/format";
import { useFormat } from "@/lib/useFormat";

/** The employee's GOSI file (Phase 4 task 7): first registration (it decides the rates under the 2024 law), this
 * employer's registration, an exemption, housing in kind, and the contribution wages reported to GOSI. */
export function EmployeeGosiCard({ employee }: { employee: Employee }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const change = holds(employee, "employees.change_salary");
  const key = ["employee-gosi", employee.id];
  const file = useQuery({ queryKey: key, queryFn: () => gosi.employee(employee.id) });
  const [v, setV] = useState<Partial<EmployeeGosi>>({});
  useEffect(() => {
    if (file.data) setV({ first_registered: file.data.first_registered, registered_on: file.data.registered_on, gosi_number: file.data.gosi_number, exemption: file.data.exemption, housing_in_kind: file.data.housing_in_kind, note: file.data.note });
  }, [file.data]);
  const [wage, setWage] = useState({ effective_from: toISODate(new Date()).slice(0, 8) + "01", wage: "", note: "" });
  const refresh = (data: EmployeeGosi) => {
    queryClient.setQueryData(key, data);
    return queryClient.invalidateQueries({ queryKey: ["employee-pay", employee.id] });
  };
  const save = useMutation({ mutationFn: () => gosi.saveEmployee(employee.id, v), onSuccess: refresh });
  const add = useMutation({ mutationFn: () => gosi.addWage(employee.id, wage), onSuccess: async (data) => { await refresh(data); setWage({ ...wage, wage: "", note: "" }); } });
  const remove = useMutation({ mutationFn: (id: number) => gosi.removeWage(employee.id, id), onSuccess: () => file.refetch().then((r) => r.data && refresh(r.data)) });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const wageErrors = apiErrors(add.error, t("common.saveFailed"));
  if (!file.data) return null;
  const data = file.data;
  return (
    <Card variant="solid" title={t("gosi.fileTitle")} subtitle={t("gosi.fileHint")}>
      <div className="mb-4 flex flex-wrap gap-2">
        <Pill tone={data.saudi ? "green" : "sky"}>{t(data.saudi ? "gosi.saudi" : "gosi.nonSaudi")}</Pill>
        {data.saudi && <Pill tone="lavender">{t(`gosi.cohorts.${data.cohort}`)}</Pill>}
        {data.gcc && <Pill tone="amber">{t("gosi.gccNational")}</Pill>}
        {data.rates.map((r) => (
          <Pill key={r.branch} tone="neutral">
            {t(`gosi.branches.${r.branch}`)}: {format.number(r.employee_percent, [0, 2])}% / {format.number(r.employer_percent, [0, 2])}%
          </Pill>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label={t("gosi.firstRegistered")} name="first_registered" type="date" value={v.first_registered ?? ""} disabled={!change} hint={t("gosi.firstRegisteredHint")} onChange={(e) => setV({ ...v, first_registered: e.target.value || null })} error={errors.fields.first_registered} />
        <TextField label={t("gosi.registeredOn")} name="registered_on" type="date" value={v.registered_on ?? ""} disabled={!change} onChange={(e) => setV({ ...v, registered_on: e.target.value || null })} />
        <TextField label={t("gosi.number")} name="gosi_number" dir="ltr" value={v.gosi_number ?? ""} disabled={!change} onChange={(e) => setV({ ...v, gosi_number: e.target.value })} error={errors.fields.gosi_number} />
        <FormSelect label={t("gosi.exemption")} name="exemption" value={v.exemption ?? ""} disabled={!change} onChange={(e) => setV({ ...v, exemption: e.target.value as EmployeeGosi["exemption"] })} options={(["", "gcc", "other"] as const).map((x) => ({ value: x, label: t(`gosi.exemptions.${x || "none"}`) }))} />
        <TextField label={t("gosi.note")} name="note" value={v.note ?? ""} disabled={!change} onChange={(e) => setV({ ...v, note: e.target.value })} />
        <div className="flex items-end pb-2">
          <CheckField label={t("gosi.housingInKind")} checked={Boolean(v.housing_in_kind)} disabled={!change} onChange={(e) => setV({ ...v, housing_in_kind: e.target.checked })} />
        </div>
      </div>
      {errors.general && <Alert className="mt-2">{errors.general}</Alert>}
      {change && (
        <div className="mt-3 flex justify-end">
          <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </div>
      )}
      <h3 className="mt-6 font-semibold text-ink">{t("gosi.wagesTitle")}</h3>
      <p className="mb-2 text-sm text-muted">{t("gosi.wagesHint")}</p>
      {data.wages.length === 0 ? (
        <p className="text-muted">{t("gosi.noWages")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.wages.map((w) => (
            <li key={w.id} className="flex flex-wrap items-center gap-3 rounded-card border border-line px-4 py-2">
              <span className="num">{t("employeePay.from", { date: format.date(w.effective_from) })}</span>
              <Money amount={w.wage} fractionDigits={[2, 2]} className="font-semibold" />
              {w.note && <span className="text-sm text-muted">{w.note}</span>}
              {change && <IconButton size="xs" variant="danger" className="ms-auto" label={t("common.delete")} icon={<Trash2 />} disabled={remove.isPending} onClick={() => remove.mutate(w.id)} />}
            </li>
          ))}
        </ul>
      )}
      {change && (
        <div className="mt-3 grid items-end gap-3 sm:grid-cols-4">
          <TextField label={t("gosi.wageFrom")} name="wage_from" type="date" value={wage.effective_from} onChange={(e) => setWage({ ...wage, effective_from: e.target.value })} error={wageErrors.fields.effective_from} />
          <TextField label={t("gosi.wage")} name="wage" dir="ltr" inputMode="decimal" value={wage.wage} onChange={(e) => setWage({ ...wage, wage: e.target.value })} error={wageErrors.fields.wage} />
          <TextField label={t("gosi.note")} name="wage_note" value={wage.note} onChange={(e) => setWage({ ...wage, note: e.target.value })} />
          <Button variant="accent" icon={<Plus className="size-4" />} disabled={!wage.wage || add.isPending} onClick={() => add.mutate()}>
            {t("gosi.addWage")}
          </Button>
        </div>
      )}
    </Card>
  );
}
