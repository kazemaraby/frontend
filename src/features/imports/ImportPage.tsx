import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { hr, type ImportBatch, type ImportRow } from "@/api/hr";
import { useScopeKey } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { FileDrop } from "@/design/FileDrop";
import { Pill, type PillTone } from "@/design/Pill";
import { Page } from "@/layout/Page";
import { apiErrors } from "@/lib/apiErrors";
import { saveFile } from "@/lib/saveFile";
import { useFormat } from "@/lib/useFormat";
import { checkSpreadsheet } from "@/lib/validators";

const BUSY = new Set(["validating", "importing"]);
const TONES: Record<ImportBatch["status"], PillTone> = {
  validating: "sky",
  ready: "teal",
  invalid: "salmon",
  importing: "sky",
  done: "green",
  failed: "salmon",
};
const ACTIONS: ImportRow["action"][] = ["create", "update", "unchanged", "error"];
const ACTION_TONES: Record<ImportRow["action"], PillTone> = { create: "green", update: "sky", unchanged: "neutral", error: "salmon" };

type Done = { to: string; label: string };
type ScreenProps = { kind: string; title: string; templateNote: string; done: Done };

/** /employees/import — Excel import (#8): template → upload → check (nothing saved) → review → import. */
export default function ImportPage() {
  const { t } = useTranslation();
  return (
    <ImportScreen
      kind="employees"
      title={t("imports.title")}
      templateNote={t("imports.templateNote")}
      done={{ to: "/employees", label: t("imports.openEmployees") }}
    />
  );
}

/** The import flow for one registered kind (apps.imports). */
export function ImportScreen({ kind, title, templateNote, done }: ScreenProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const scopeKey = useScopeKey();
  const [file, setFile] = useState<File | null>(null);
  const [current, setCurrent] = useState<number | null>(null);

  const history = useQuery({ queryKey: ["imports", kind, ...scopeKey], queryFn: () => hr.imports(kind) });
  const batch = useQuery({
    queryKey: ["imports", "batch", current],
    queryFn: () => hr.importBatch(current!),
    enabled: current !== null,
    // The check and the import run in the background: poll until they finish.
    refetchInterval: (query) => (query.state.data && BUSY.has(query.state.data.status) ? 1_000 : false),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["imports"] });
  const finished = batch.data && !BUSY.has(batch.data.status) ? batch.data.status : null;
  useEffect(() => {
    // The history shows the batch's status too: refresh it when a check or an import finishes.
    if (finished) void queryClient.invalidateQueries({ queryKey: ["imports", kind, ...scopeKey] });
  }, [finished, queryClient, scopeKey, kind]);
  const template = useMutation({ mutationFn: async () => saveFile(await hr.importTemplate(kind)) });
  const upload = useMutation({
    mutationFn: () => hr.uploadImport(file!, kind),
    onSuccess: (created) => {
      setCurrent(created.id);
      setFile(null);
      void refresh();
    },
  });
  const confirm = useMutation({ mutationFn: (id: number) => hr.confirmImport(id), onSuccess: refresh });
  const report = useMutation({ mutationFn: async (id: number) => saveFile(await hr.importReport(id)) });
  const problem = apiErrors(template.error ?? upload.error ?? confirm.error ?? report.error, t("common.saveFailed"));

  const data = batch.data;
  return (
    <Page title={title}>
      <div className="flex flex-col gap-4">
        <Card variant="solid" title={t("imports.steps.template")} subtitle={templateNote}>
          <Button variant="outline" icon={<Download className="size-[18px]" />} disabled={template.isPending} onClick={() => template.mutate()}>
            {t("imports.downloadTemplate")}
          </Button>
        </Card>

        <Card variant="solid" title={t("imports.steps.upload")} subtitle={t("imports.uploadNote")}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <FileDrop
              label={t("imports.file")}
              file={file}
              onChange={setFile}
              accept=".xlsx"
              check={checkSpreadsheet}
              limits={t("imports.limits")}
              error={problem.fields.file}
              className="flex-1"
            />
            <Button icon={<Upload className="size-[18px]" />} disabled={!file || upload.isPending} onClick={() => upload.mutate()}>
              {t("imports.check")}
            </Button>
          </div>
        </Card>

        {problem.general && <Alert>{problem.general}</Alert>}
        {data && <Result batch={data} done={done} onConfirm={() => confirm.mutate(data.id)} onReport={() => report.mutate(data.id)} busy={confirm.isPending} />}

        <Card variant="solid" title={t("imports.history")}>
          {history.data?.results.length ? (
            <ul className="flex flex-col divide-y divide-line">
              {history.data.results.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <FileSpreadsheet aria-hidden="true" className="size-5 text-teal-dark" />
                  <button type="button" className="cursor-pointer font-medium text-ink hover:underline" onClick={() => setCurrent(b.id)}>
                    {b.file_name}
                  </button>
                  <Pill tone={TONES[b.status]}>{t(`imports.status.${b.status}`)}</Pill>
                  <span className="num text-muted">
                    {format.date(new Date(b.created_at))} · {b.created_by ? format.name(b.created_by) : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{t("imports.noHistory")}</p>
          )}
        </Card>
      </div>
    </Page>
  );
}

function Result({ batch, done, onConfirm, onReport, busy }: { batch: ImportBatch; done: Done; onConfirm: () => void; onReport: () => void; busy: boolean }) {
  const { t } = useTranslation();
  const format = useFormat();
  const errors = (batch.report ?? []).filter((r) => r.action === "error");
  const columns: Column<ImportRow>[] = [
    { id: "row", header: t("imports.row"), cell: (r) => <span className="num">{format.number(r.row)}</span>, className: "w-20" },
    { id: "key", header: t("imports.key"), cell: (r) => <span className="num font-semibold">{r.key || "—"}</span>, className: "w-36" },
    {
      id: "errors",
      header: t("imports.errors"),
      cell: (r) => (
        <ul className="flex flex-col gap-0.5 py-2 text-sm">
          {Object.entries(r.errors).map(([column, message]) => (
            <li key={column}>
              <span className="font-medium">{t(`employee.fields.${column}`, { defaultValue: column })}:</span> {message}
            </li>
          ))}
        </ul>
      ),
    },
  ];
  return (
    <Card
      variant="solid"
      title={batch.file_name}
      subtitle={t("imports.rowsCount", { count: batch.rows, rows: format.number(batch.rows) })}
      action={<Pill tone={TONES[batch.status]}>{t(`imports.status.${batch.status}`)}</Pill>}
    >
      <div aria-live="polite" className="flex flex-col gap-4">
        {BUSY.has(batch.status) && <p className="text-muted">{t(`imports.busy.${batch.status}`)}</p>}
        {batch.error && <Alert>{batch.error}</Alert>}
        {!BUSY.has(batch.status) && batch.rows > 0 && (
          <div className="flex flex-wrap gap-2">
            {ACTIONS.filter((a) => (batch.summary[a] ?? 0) > 0).map((a) => (
              <Pill key={a} tone={ACTION_TONES[a]} size="md">
                {t(`imports.actions.${a}`, { count: batch.summary[a] ?? 0, n: format.number(batch.summary[a] ?? 0) })}
              </Pill>
            ))}
          </div>
        )}
        {errors.length > 0 && (
          <DataTable
            caption={t("imports.errors")}
            columns={columns}
            rows={errors.slice(0, 100)}
            rowKey={(r) => String(r.row)}
            rowLabel={(r) => String(r.row)}
            minWidth={640}
          />
        )}
        {batch.status === "done" && (
          <Alert tone="info">
            {t("imports.done")}{" "}
            <Link to={done.to} className="font-semibold underline">
              {done.label}
            </Link>
          </Alert>
        )}
        <div className="flex flex-wrap justify-end gap-2.5">
          {batch.rows > 0 && !BUSY.has(batch.status) && (
            <Button variant="outline" icon={<Download className="size-4" />} onClick={onReport}>
              {t("imports.downloadReport")}
            </Button>
          )}
          {batch.status === "ready" && (
            <Button variant="accent" disabled={busy} onClick={onConfirm}>
              {t("imports.confirm", { count: (batch.summary.create ?? 0) + (batch.summary.update ?? 0) })}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
