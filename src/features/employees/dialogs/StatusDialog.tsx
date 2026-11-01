import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { Employee } from "@/api";
import { hr, type StatusOption } from "@/api/hr";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { DateInput } from "@/design/DateInput";
import { Dialog } from "@/design/Dialog";
import { FormSelect, TextArea } from "@/design/Field";
import { StatusChip } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";

/** Change the employee's status. The options (and what each needs) come from GET /employees/{id}/status, so
 * the dialog only offers what the lifecycle allows for this employee and user. */
export function StatusDialog({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const info = useQuery({ queryKey: ["employee", employee.id, "status"], queryFn: () => hr.status(employee.id) });
  const [to, setTo] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const option: StatusOption | undefined = info.data?.options.find((o) => o.to === to);
  const set = (name: string) => (value: string | null) => setValues((v) => ({ ...v, [name]: value ?? "" }));

  const change = useMutation({
    mutationFn: () => {
      const body: Record<string, string> = { to };
      for (const [key, value] of Object.entries(values)) if (value) body[key] = value;
      return hr.changeStatus(employee.id, body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["employee", employee.id] });
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      onClose();
    },
  });
  const errors = apiErrors(change.error, t("common.saveFailed"));
  const missing = !option || (option.reasons.length > 0 && !values.reason) || (option.needs_note && !values.note?.trim());

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("employee.status.title")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={missing || change.isPending} onClick={() => change.mutate()}>
            {t("approvals.sendForApproval")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="flex items-center gap-2 text-sm text-muted">
          {t("employee.status.current")} <StatusChip status={employee.status} />
        </p>
        {info.data?.pending_request && (
          <Alert tone={info.data.pending_request.status === "returned" ? "warning" : "info"}>
            {t(info.data.pending_request.status === "returned" ? "pendingApprovals.returnedStatus" : "pendingApprovals.waitingStatus", {
              to: t(`status.${info.data.pending_request.to}`),
            })}
            {info.data.pending_request.comment ? ` “${info.data.pending_request.comment}”` : ""}
          </Alert>
        )}
        {(info.data?.options.length ?? 0) > 0 && <p className="text-sm text-muted">{t("pendingApprovals.statusNote")}</p>}
        {info.isPending ? (
          <p className="text-muted">{t("common.loading")}</p>
        ) : !info.data?.options.length ? (
          !info.data?.pending_request && <Alert tone="info">{t("employee.status.none")}</Alert>
        ) : (
          <FormSelect
            label={t("employee.status.choose")}
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setValues({});
              change.reset();
            }}
            placeholder={t("common.choose")}
            options={info.data.options.map((o) => ({ value: o.to, label: t(`employee.status.actions.${o.action}`) }))}
          />
        )}
        {option && option.reasons.length > 0 && (
          <FormSelect
            label={t("employee.status.reason")}
            value={values.reason ?? ""}
            onChange={(e) => set("reason")(e.target.value)}
            placeholder={t("common.choose")}
            options={option.reasons.map((r) => ({ value: r, label: t(`employee.reasons.${r}`) }))}
            error={errors.fields.reason}
          />
        )}
        {option?.needs_hire_date && (
          <DateInput
            label={t("employee.fields.hire_date")}
            value={values.hire_date || null}
            onChange={set("hire_date")}
            hint={option.needs_contract ? t("employee.status.hireHint") : undefined}
            error={errors.fields.hire_date}
          />
        )}
        {option?.needs_termination_date && (
          <DateInput
            label={t("employee.fields.termination_date")}
            value={values.termination_date || null}
            onChange={set("termination_date")}
            error={errors.fields.termination_date}
          />
        )}
        {option?.action === "suspend" && (
          <DateInput label={t("employee.status.until")} value={values.until || null} onChange={set("until")} error={errors.fields.until} />
        )}
        {option && (
          <TextArea
            label={option.needs_note ? t("employee.status.note") : t("employee.status.noteOptional")}
            value={values.note ?? ""}
            onChange={(e) => set("note")(e.target.value)}
            required={option.needs_note}
            error={errors.fields.note}
          />
        )}
        {(errors.fields.contract || errors.fields.date_of_birth || errors.general) && (
          <Alert>{errors.fields.contract ?? errors.fields.date_of_birth ?? errors.general}</Alert>
        )}
      </div>
    </Dialog>
  );
}
