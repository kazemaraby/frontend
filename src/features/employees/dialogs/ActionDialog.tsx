import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type Employee, holds } from "@/api";
import { ACTION_FIELDS, type ActionField, type ActionType, hr } from "@/api/hr";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { DateInput } from "@/design/DateInput";
import { Dialog } from "@/design/Dialog";
import { FormSelect, TextArea, TextField } from "@/design/Field";
import { Money } from "@/design/Money";
import { apiErrors } from "@/lib/apiErrors";
import { toISODate } from "@/lib/format";
import { useFormat } from "@/lib/useFormat";

import type { MasterData } from "../masterData";

const TYPES = Object.keys(ACTION_FIELDS) as ActionType[];
const MONEY = new Set<ActionField>(["basic_salary", "housing_allowance", "transport_allowance", "other_allowances"]);

/** Record a promotion / transfer / salary change / title change and apply it (or schedule it for a future
 * date). Shows each field the type may change as "current → new" and a preview of what will change. */
export function ActionDialog({ employee, master, onClose }: { employee: Employee; master: MasterData; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const [type, setType] = useState<ActionType>("promotion");
  const [date, setDate] = useState<string | null>(toISODate(new Date()));
  const [reason, setReason] = useState("");
  const [to, setTo] = useState<Partial<Record<ActionField, string>>>({});
  const managers = useQuery({
    queryKey: ["employees", "managers", employee.company],
    queryFn: () => hr.searchEmployees(""),
    enabled: type === "transfer",
  });

  const salaryAllowed = holds(employee, "employees.change_salary") && "basic_salary" in employee;
  const fields = ACTION_FIELDS[type].filter((f) => !MONEY.has(f) || salaryAllowed);
  const current = (field: ActionField) => {
    const value = employee[field as keyof Employee];
    return value === null || value === undefined ? "" : String(value);
  };
  const changes = fields.filter((f) => to[f] !== undefined && to[f] !== "" && to[f] !== current(f));

  const options: Partial<Record<ActionField, { value: string; label: string }[]>> = {
    job_title: master.options.jobTitles,
    grade: master.options.grades,
    branch: master.options.branches,
    department: master.options.departments,
    manager: (managers.data?.results ?? [])
      .filter((e) => e.id !== employee.id)
      .map((e) => ({ value: String(e.id), label: `${format.name(e)} · ${e.employee_no}` })),
  };
  const show = (field: ActionField, value: string) => {
    if (!value) return "—";
    if (MONEY.has(field)) return <Money amount={value} />;
    if (field === "manager") return options.manager?.find((o) => o.value === value)?.label ?? `#${value}`;
    return options[field]?.find((o) => o.value === value)?.label ?? value;
  };

  const save = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { employee: employee.id, action_type: type, effective_date: date, reason };
      for (const field of changes) body[`to_${field}`] = MONEY.has(field) ? to[field] : Number(to[field]);
      const action = await hr.createAction(body);
      try {
        return await hr.submitAction(action.id);
      } catch (error) {
        await hr.deleteAction(action.id).catch(() => undefined); // don't leave a draft behind for a retry to duplicate
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["employee", employee.id] });
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const Arrow = format.dir === "rtl" ? ArrowLeft : ArrowRight;
  const future = date !== null && date > toISODate(new Date());

  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={t("employee.actions.new")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!changes.length || !date || save.isPending} onClick={() => save.mutate()}>
            {t("approvals.sendForApproval")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormSelect
            label={t("employee.actions.type")}
            value={type}
            onChange={(e) => {
              setType(e.target.value as ActionType);
              setTo({});
              save.reset();
            }}
            options={TYPES.map((v) => ({ value: v, label: t(`employee.actions.types.${v}`) }))}
          />
          <DateInput label={t("employee.actions.effectiveDate")} value={date} onChange={setDate} error={errors.fields.effective_date} />
        </div>
        <div className="flex flex-col gap-3">
          {fields.map((field) => (
            // One group per field, so "new value" is announced with the field it belongs to.
            <fieldset key={field} className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
              <legend className="mb-1 text-sm font-semibold text-ink sm:col-span-3">{t(`employee.fields.${field}`)}</legend>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">{t("employee.actions.currentValue")}</span>
                <span className="num flex h-12 items-center rounded-full bg-neutral-soft px-5 text-muted">{show(field, current(field))}</span>
              </div>
              <Arrow aria-hidden="true" className="mb-3.5 hidden size-5 text-muted sm:block" />
              {MONEY.has(field) ? (
                <TextField
                  label={t("employee.actions.newValue")}
                  inputMode="decimal"
                  dir="ltr"
                  value={to[field] ?? ""}
                  onChange={(e) => setTo((v) => ({ ...v, [field]: e.target.value }))}
                  error={errors.fields[`to_${field}`]}
                />
              ) : (
                <FormSelect
                  label={t("employee.actions.newValue")}
                  value={to[field] ?? ""}
                  onChange={(e) => setTo((v) => ({ ...v, [field]: e.target.value }))}
                  placeholder={t("employee.actions.noChange")}
                  options={options[field] ?? []}
                  error={errors.fields[`to_${field}`]}
                />
              )}
            </fieldset>
          ))}
        </div>
        <TextArea label={t("employee.actions.reason")} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        {changes.length > 0 && (
          <Alert tone="info">
            {t(future ? "employee.actions.previewFuture" : "employee.actions.preview", {
              date: date ? format.date(date) : "",
              fields: changes.map((f) => t(`employee.fields.${f}`)).join(t("common.listSeparator")),
            })}
          </Alert>
        )}
        {(errors.general || errors.fields.changed_fields) && <Alert>{errors.fields.changed_fields ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
