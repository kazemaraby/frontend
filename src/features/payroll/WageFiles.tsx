import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiError } from "@/api";
import { hr } from "@/api/hr";
import { type PayrollAccount, type PayrollRun, wageFiles } from "@/api/payroll";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { Dialog } from "@/design/Dialog";
import { FormSelect, TextField } from "@/design/Field";
import { Money } from "@/design/Money";
import { Pill } from "@/design/Pill";
import { openFile } from "@/features/employees/download";
import { apiErrors } from "@/lib/apiErrors";
import { toISODate } from "@/lib/format";
import { useFormat } from "@/lib/useFormat";

/** A file refused for employees (not for the company's setup): it can be made without them. */
function listedEmployees(error: unknown): boolean {
  return error instanceof ApiError && Boolean(error.body && typeof error.body === "object" && "employees" in (error.body as object));
}

/** Every message of a refused file: the employees to fix, or what the company must set first. */
function listed(error: unknown): string[] | null {
  if (!(error instanceof ApiError) || !error.body || typeof error.body !== "object") return null;
  const body = error.body as Record<string, unknown>;
  const found = [body.employees, body.detail, body.format, body.value_date].flatMap((v) => (Array.isArray(v) ? v.map(String) : typeof v === "string" ? [v] : []));
  return found.length ? found : null;
}

/** The company's payroll bank account (Phase 4 task 14): the WPS file's header — the paying bank, its IBAN and the
 * company's customer number at the bank. */
export function PayrollAccountCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const { can } = useSession();
  const manage = can("payroll.manage_settings");
  const queryClient = useQueryClient();
  const current = useQuery({ queryKey: ["payroll-account", ...scope], queryFn: wageFiles.account });
  const banks = useQuery({ queryKey: ["banks"], queryFn: hr.banks, staleTime: Infinity });
  const [v, setV] = useState<PayrollAccount>({ bank: 0, iban: "", bank_customer_id: "" });
  useEffect(() => {
    if (current.data) setV(current.data);
  }, [current.data]);
  const save = useMutation({ mutationFn: () => wageFiles.saveAccount(v), onSuccess: (data) => queryClient.setQueryData(["payroll-account", ...scope], data) });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Card variant="solid" title={t("wageFiles.accountTitle")} subtitle={t("wageFiles.accountHint")} className="mt-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <FormSelect label={t("wageFiles.bank")} name="bank" value={v.bank ? String(v.bank) : ""} disabled={!manage} placeholder={t("common.choose")} onChange={(e) => setV({ ...v, bank: Number(e.target.value) })} options={(banks.data ?? []).map((b) => ({ value: String(b.id), label: format.name(b) }))} error={errors.fields.bank} />
        <TextField label={t("wageFiles.iban")} name="iban" dir="ltr" value={v.iban} disabled={!manage} onChange={(e) => setV({ ...v, iban: e.target.value })} error={errors.fields.iban} />
        <TextField label={t("wageFiles.customerId")} name="bank_customer_id" dir="ltr" inputMode="numeric" value={v.bank_customer_id} disabled={!manage} hint={t("wageFiles.customerIdHint")} onChange={(e) => setV({ ...v, bank_customer_id: e.target.value })} error={errors.fields.bank_customer_id} />
      </div>
      {save.isSuccess && <Alert tone="info" className="mt-3">{t("wageFiles.saved")}</Alert>}
      {manage && (
        <div className="mt-3 flex justify-end">
          <Button size="sm" disabled={!v.bank || !v.iban || save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </div>
      )}
    </Card>
  );
}

/** The run's files (#93, #102): the WPS wages file for the bank and Mudad, or a bank transfer list — for the whole
 * run or one batch — downloaded through a signed link, and the WPS file sent to Mudad when its API is set up. */
export function WageFilesDialog({ run, onClose }: { run: PayrollRun; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const formats = useQuery({ queryKey: ["file-formats"], queryFn: wageFiles.formats, staleTime: 60_000 });
  const files = useQuery({ queryKey: ["wage-files", run.id], queryFn: () => wageFiles.list(run.id) });
  const mudadReady = formats.data?.find((f) => f.code === "mudad_api")?.ready ?? false;
  const [v, setV] = useState({ format: "wps", batch: "", value_date: toISODate(new Date()), language: "en" as "ar" | "en" });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["wage-files", run.id] });
  const make = useMutation({ mutationFn: (skip: boolean) => wageFiles.make(run.id, { format: v.format, batch: v.batch ? Number(v.batch) : null, value_date: v.value_date, language: v.language, skip_invalid: skip }), onSuccess: refresh });
  const mudad = useMutation({ mutationFn: ({ id, again }: { id: number; again: boolean }) => wageFiles.mudad(run.id, id, again), onSuccess: refresh });
  const open = useMutation({ mutationFn: (id: number) => openFile(() => wageFiles.link(run.id, id)) });
  const errors = apiErrors(make.error ?? mudad.error, t("common.saveFailed"));
  const problems = listed(make.error);
  const columns: Column<NonNullable<typeof files.data>[number]>[] = [
    { id: "ref", header: t("wageFiles.reference"), cell: (f) => <span dir="ltr" className="num text-sm font-semibold">{f.reference}</span> },
    { id: "format", header: t("wageFiles.format"), cell: (f) => <span className="text-sm">{f.format_name}</span> },
    { id: "batch", header: t("batches.name"), cell: (f) => <span className="text-sm">{run.batches.find((b) => b.id === f.batch)?.name ?? t("payroll.allBranches")}</span> },
    { id: "total", header: t("wageFiles.total"), cell: (f) => <span className="flex flex-col"><Money amount={f.total} fractionDigits={[2, 2]} /><span className="num text-xs text-muted">{t("wageFiles.count", { n: format.number(f.count) })}</span></span> },
    { id: "skipped", header: t("wageFiles.skipped"), cell: (f) => (f.skipped.length ? <span title={f.skipped.join("\n")}><Pill tone="amber">{t("wageFiles.leftOut", { n: format.number(f.skipped.length) })}</Pill></span> : <span className="text-muted">—</span>) },
    { id: "mudad", header: t("wageFiles.mudad"), cell: (f) => (f.mudad_status ? <Pill tone={f.mudad_status === "accepted" ? "green" : "amber"}>{f.mudad_status}</Pill> : <span className="text-muted">—</span>) },
    {
      id: "actions",
      header: <span className="sr-only">{t("common.actions")}</span>,
      cell: (f) => (
        <span className="flex gap-1">
          <IconButton size="sm" variant="plain" label={t("wageFiles.download", { name: f.file_name })} icon={<Download />} onClick={() => open.mutate(f.id)} />
          {f.format === "wps" && mudadReady && (
            <IconButton size="sm" variant="plain" label={t(f.mudad_reference ? "wageFiles.mudadStatus" : "wageFiles.sendMudad")} icon={<Send />} disabled={mudad.isPending} onClick={() => mudad.mutate({ id: f.id, again: Boolean(f.mudad_reference) })} />
          )}
        </span>
      ),
    },
  ];
  return (
    <Dialog open size="lg" onClose={onClose} title={t("payroll.wpsFile")}>
      <div className="flex flex-col gap-4">
        {run.stage !== "locked" && run.stage !== "paid" ? (
          <Alert tone="info">{t("wageFiles.afterApproval")}</Alert>
        ) : (
          <div className="grid items-end gap-3 sm:grid-cols-5">
            <FormSelect label={t("wageFiles.format")} name="format" value={v.format} onChange={(e) => setV({ ...v, format: e.target.value })} options={(formats.data ?? []).filter((f) => f.code !== "mudad_api").map((f) => ({ value: f.code, label: f.name }))} />
            <FormSelect label={t("batches.name")} name="batch" value={v.batch} placeholder={t("payroll.allBranches")} onChange={(e) => setV({ ...v, batch: e.target.value })} options={run.batches.map((b) => ({ value: String(b.id), label: b.name }))} />
            <TextField label={t("wageFiles.valueDate")} name="value_date" type="date" value={v.value_date} onChange={(e) => setV({ ...v, value_date: e.target.value })} />
            <FormSelect label={t("wageFiles.language")} name="language" value={v.language} onChange={(e) => setV({ ...v, language: e.target.value as "ar" | "en" })} options={[{ value: "en", label: t("wageFiles.english") }, { value: "ar", label: t("wageFiles.arabic") }]} />
            <Button variant="accent" disabled={make.isPending} onClick={() => make.mutate(false)}>
              {t("wageFiles.make")}
            </Button>
          </div>
        )}
        {!mudadReady && <p className="text-sm text-muted">{t("wageFiles.mudadNotSetUp")}</p>}
        {problems && (
          <Alert>
            <span className="font-semibold">{t("wageFiles.fixFirst")}</span>
            <ul className="mt-1 list-inside list-disc">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            {listedEmployees(make.error) && (
              <Button size="sm" variant="outline" className="mt-2" disabled={make.isPending} onClick={() => make.mutate(true)}>
                {t("wageFiles.makeWithout")}
              </Button>
            )}
          </Alert>
        )}
        {mudad.error && <Alert>{errors.general}</Alert>}
        <DataTable caption={t("wageFiles.title")} columns={columns} rows={files.data ?? []} rowKey={(f) => String(f.id)} loading={files.isPending} empty={t("wageFiles.none")} minWidth={760} />
      </div>
    </Dialog>
  );
}
