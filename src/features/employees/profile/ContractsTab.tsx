import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type Employee, holds } from "@/api";
import { type Contract, formData, hr, type ProbationDecision } from "@/api/hr";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { DateInput } from "@/design/DateInput";
import { DetailList } from "@/design/DetailList";
import { Dialog } from "@/design/Dialog";
import { FormSelect, TextArea, TextField } from "@/design/Field";
import { Money } from "@/design/Money";
import { Pill, type PillTone } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

import { UploadDialog } from "../dialogs/UploadDialog";
import { openFile } from "../download";
import type { MasterData } from "../masterData";

const TONES: Record<Contract["status"], PillTone> = {
  draft: "amber",
  active: "green",
  renewed: "teal",
  expired: "neutral",
  terminated: "salmon",
  cancelled: "neutral",
};
const PACKAGE = ["basic_salary", "housing_allowance", "transport_allowance", "other_allowances"] as const;

type Mode = { kind: "new" } | { kind: "renew"; of: Contract };

export function ContractsTab({ employee, master }: { employee: Employee; master: MasterData }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const contracts = useQuery({ queryKey: ["employee", employee.id, "contracts"], queryFn: () => hr.contracts(employee.id) });
  const [editing, setEditing] = useState<Mode | null>(null);
  const [probation, setProbation] = useState<Contract | null>(null);
  const [upload, setUpload] = useState<Contract | null>(null);
  const manage = holds(employee, "employees.manage_contracts");
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["employee", employee.id] });

  const act = useMutation({
    mutationFn: async ({ action, contract }: { action: "activate" | "delete"; contract: Contract }) => {
      if (action === "activate") await hr.activateContract(contract.id);
      else await hr.deleteContract(contract.id);
    },
    onSuccess: refresh,
  });
  const actError = apiErrors(act.error, t("common.saveFailed"));

  return (
    <div className="flex flex-col gap-4">
      {manage && (
        <div className="flex justify-end">
          <Button variant="accent" icon={<Plus className="size-[18px]" />} onClick={() => setEditing({ kind: "new" })}>
            {t("contracts.new")}
          </Button>
        </div>
      )}
      {actError.general && <Alert>{actError.general}</Alert>}
      {contracts.isPending && <p className="text-muted">{t("common.loading")}</p>}
      {contracts.data?.length === 0 && <Alert tone="info">{t("contracts.none")}</Alert>}
      {contracts.data?.map((contract) => (
        <ContractCard
          key={contract.id}
          contract={contract}
          master={master}
          manage={manage}
          manageDocuments={manage && holds(employee, "employees.manage_documents")}
          confirmed={Boolean(employee.confirmation_date)}
          onActivate={() => act.mutate({ action: "activate", contract })}
          onDelete={() => act.mutate({ action: "delete", contract })}
          onRenew={() => setEditing({ kind: "renew", of: contract })}
          onProbation={() => setProbation(contract)}
          onUpload={() => setUpload(contract)}
          busy={act.isPending}
        />
      ))}
      {editing && <ContractDialog employee={employee} master={master} mode={editing} onClose={() => setEditing(null)} onSaved={refresh} />}
      {probation && <ProbationDialog contract={probation} onClose={() => setProbation(null)} onSaved={refresh} />}
      {upload && (
        <UploadDialog
          title={t("contracts.uploadCopy")}
          current={upload.file_name}
          upload={async (file) => {
            await hr.updateContract(upload.id, formData({ file }));
            await refresh();
          }}
          onClose={() => setUpload(null)}
        />
      )}
    </div>
  );
}

function ContractCard({
  contract,
  master,
  manage,
  manageDocuments,
  confirmed,
  onActivate,
  onDelete,
  onRenew,
  onProbation,
  onUpload,
  busy,
}: {
  contract: Contract;
  master: MasterData;
  manage: boolean;
  manageDocuments: boolean;
  /** Probation already decided (confirmed): no decision button. */
  confirmed: boolean;
  onActivate: () => void;
  onDelete: () => void;
  onRenew: () => void;
  onProbation: () => void;
  onUpload: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const date = (d: string | null) => (d ? `${format.date(d)} · ${format.hijri(d)}` : "");
  const running = contract.status === "active" || contract.status === "renewed";
  const items = [
    { label: t("contracts.type"), value: master.name.contractType(contract.contract_type) },
    { label: t("contracts.number"), value: contract.contract_no },
    { label: t("contracts.start"), value: date(contract.start_date) },
    { label: t("contracts.end"), value: contract.end_date ? date(contract.end_date) : t("contracts.openEnded") },
    { label: t("contracts.signedOn"), value: contract.signed_on ? format.date(contract.signed_on) : "" },
    {
      label: t("contracts.probation"),
      value: contract.probation_end
        ? t("contracts.probationUntil", { days: contract.probation_days, date: format.date(contract.probation_end) })
        : t("contracts.noProbation"),
    },
    ...(contract.ended_on ? [{ label: t("contracts.endedOn"), value: format.date(contract.ended_on) }] : []),
    ...PACKAGE.filter((f) => f in contract).map((f) => ({
      label: t(`employee.fields.${f}`),
      value: contract[f] ? <Money amount={contract[f]!} /> : "",
    })),
  ];
  return (
    <Card
      variant="solid"
      title={
        <span className="flex flex-wrap items-center gap-2">
          {master.name.contractType(contract.contract_type) || t("contracts.contract")}
          <Pill tone={TONES[contract.status]}>{t(`contracts.status.${contract.status}`)}</Pill>
        </span>
      }
      subtitle={contract.renewal_of ? t("contracts.isRenewal") : undefined}
    >
      <DetailList items={items} />
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {contract.has_file && (
          <Button size="sm" variant="outline" icon={<FileText className="size-4" />} onClick={() => openFile(() => hr.contractLink(contract.id))}>
            {t("contracts.viewCopy")}
          </Button>
        )}
        {manageDocuments && contract.status !== "cancelled" && (
          <Button size="sm" variant="outline" onClick={onUpload}>
            {contract.has_file ? t("contracts.replaceCopy") : t("contracts.uploadCopy")}
          </Button>
        )}
        {manage && contract.status === "draft" && (
          <>
            <Button size="sm" variant="outline" disabled={busy} onClick={onDelete}>
              {t("common.delete")}
            </Button>
            <Button size="sm" disabled={busy} onClick={onActivate}>
              {t("contracts.activate")}
            </Button>
          </>
        )}
        {manage && running && contract.probation_end && !confirmed && (
          <Button size="sm" variant="outline" onClick={onProbation}>
            {t("contracts.probationDecision")}
          </Button>
        )}
        {manage && (contract.status === "active" || contract.status === "expired") && contract.end_date && !contract.renewal && (
          <Button size="sm" onClick={onRenew}>
            {t("contracts.renew")}
          </Button>
        )}
      </div>
    </Card>
  );
}

function ContractDialog({
  employee,
  master,
  mode,
  onClose,
  onSaved,
}: {
  employee: Employee;
  master: MasterData;
  mode: Mode;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const renewing = mode.kind === "renew" ? mode.of : null;
  const [values, setValues] = useState<Record<string, string>>(() =>
    renewing
      ? { contract_type: String(renewing.contract_type) }
      : {
          contract_type: "",
          start_date: employee.hire_date ?? "",
          ...Object.fromEntries(PACKAGE.map((f) => [f, employee[f] ?? ""])),
        },
  );
  const set = (key: string) => (value: string | null) => setValues((v) => ({ ...v, [key]: value ?? "" }));
  const type = master.contractTypes.find((c) => String(c.id) === values.contract_type);
  const salary = holds(employee, "employees.change_salary");

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(values)) {
        if (value === "") continue;
        if (!salary && (PACKAGE as readonly string[]).includes(key)) continue;
        body[key] = ["contract_type", "probation_days", "employer_notice_days", "employee_notice_days"].includes(key) ? Number(value) : value;
      }
      const contract = body as Partial<Contract>;
      return renewing ? hr.renewContract(renewing.id, contract) : hr.createContract({ ...contract, employee: employee.id });
    },
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const e = errors.fields;
  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={renewing ? t("contracts.renewTitle") : t("contracts.new")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!values.contract_type || save.isPending} onClick={() => save.mutate()}>
            {t("contracts.saveDraft")}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormSelect
          label={t("contracts.type")}
          value={values.contract_type}
          onChange={(ev) => set("contract_type")(ev.target.value)}
          placeholder={t("common.choose")}
          options={master.options.contractTypes}
          error={e.contract_type}
        />
        <TextField label={t("contracts.number")} dir="ltr" value={values.contract_no ?? ""} onChange={(ev) => set("contract_no")(ev.target.value)} error={e.contract_no} />
        <DateInput
          label={t("contracts.start")}
          hijri
          value={values.start_date || null}
          onChange={set("start_date")}
          hint={renewing ? t("contracts.renewStartHint") : undefined}
          error={e.start_date ?? e.start_date_hijri}
        />
        {type?.has_end_date !== false && (
          <DateInput label={t("contracts.end")} hijri value={values.end_date || null} onChange={set("end_date")} error={e.end_date ?? e.end_date_hijri} />
        )}
        {!renewing && (
          <TextField
            label={t("contracts.probationDays")}
            inputMode="numeric"
            dir="ltr"
            value={values.probation_days ?? ""}
            onChange={(ev) => set("probation_days")(ev.target.value)}
            error={e.probation_days}
            hint={t("contracts.probationHint")}
          />
        )}
        {type && !type.has_end_date && (
          <>
            <TextField label={t("contracts.employerNotice")} inputMode="numeric" dir="ltr" value={values.employer_notice_days ?? ""} onChange={(ev) => set("employer_notice_days")(ev.target.value)} error={e.employer_notice_days} />
            <TextField label={t("contracts.employeeNotice")} inputMode="numeric" dir="ltr" value={values.employee_notice_days ?? ""} onChange={(ev) => set("employee_notice_days")(ev.target.value)} error={e.employee_notice_days} />
          </>
        )}
        {salary &&
          PACKAGE.map((f) => (
            <TextField key={f} label={t(`employee.fields.${f}`)} inputMode="decimal" dir="ltr" value={values[f] ?? ""} onChange={(ev) => set(f)(ev.target.value)} error={e[f]} />
          ))}
      </div>
      <p className="mt-4 text-sm text-muted">{t("contracts.draftNote")}</p>
      {errors.general && <Alert className="mt-4">{errors.general}</Alert>}
    </Dialog>
  );
}

function ProbationDialog({ contract, onClose, onSaved }: { contract: Contract; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const reviews = useQuery({ queryKey: ["contract", contract.id, "probation"], queryFn: () => hr.probationReviews(contract.id) });
  const [decision, setDecision] = useState<ProbationDecision>("confirm");
  const [notes, setNotes] = useState("");
  const [newEnd, setNewEnd] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => hr.reviewProbation(contract.id, { decision, notes, ...(decision === "extend" && newEnd ? { new_end_date: newEnd } : {}) }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const waiting = contract.probation_request;
  const decided = reviews.data?.some((r) => r.decision !== "extend") || waiting?.status === "pending";
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("contracts.probationDecision")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          {!decided && (
            <Button disabled={save.isPending || (decision === "extend" && !newEnd)} onClick={() => save.mutate()}>
              {t("approvals.sendForApproval")}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t("contracts.probationEnds", { date: format.date(contract.probation_end!) })}</p>
        {reviews.data?.map((r) => (
          <Alert key={r.id} tone="info">
            {t(`contracts.decisions.${r.decision}`)} · {format.date(r.review_date)}
            {r.notes ? ` · ${r.notes}` : ""}
          </Alert>
        ))}
        {waiting && (
          <Alert tone={waiting.status === "returned" ? "warning" : "info"}>
            {t(waiting.status === "returned" ? "pendingApprovals.returnedDecision" : "pendingApprovals.waitingDecision", {
              decision: t(`contracts.decisions.${waiting.decision}`),
            })}
            {waiting.comment ? ` “${waiting.comment}”` : ""}
          </Alert>
        )}
        {!decided && (
          <>
            <p className="text-sm text-muted">{t("pendingApprovals.decisionNote")}</p>
            <FormSelect
              label={t("contracts.decision")}
              value={decision}
              onChange={(e) => setDecision(e.target.value as ProbationDecision)}
              options={(["confirm", "extend", "end"] as const).map((d) => ({ value: d, label: t(`contracts.decisions.${d}`) }))}
            />
            {decision === "extend" && (
              <DateInput label={t("contracts.newProbationEnd")} value={newEnd} onChange={setNewEnd} error={errors.fields.new_end_date} />
            )}
            {decision === "end" && <Alert tone="warning">{t("contracts.endWarning")}</Alert>}
            <TextArea label={t("contracts.notes")} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </>
        )}
        {(errors.general || errors.fields.review_date) && <Alert>{errors.fields.review_date ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
