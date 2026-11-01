import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type Employee, holds } from "@/api";
import { type EmployeeDocument, type ExpiryStatus, hr } from "@/api/hr";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { Pill, type PillTone } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

import { DocumentDialog } from "../dialogs/DocumentDialog";
import { openFile } from "../download";
import type { MasterData } from "../masterData";

export const EXPIRY_TONES: Record<ExpiryStatus, PillTone> = { valid: "green", expiring: "amber", expired: "salmon", no_expiry: "neutral" };

export function ExpiryChip({ document }: { document: EmployeeDocument }) {
  const { t } = useTranslation();
  const format = useFormat();
  const days = document.days_to_expiry;
  return (
    <Pill tone={EXPIRY_TONES[document.expiry_status]}>
      {document.expiry_status === "expiring" && days !== null
        ? t("documents.expiresIn", { count: days, days: format.number(days) })
        : t(`documents.expiry.${document.expiry_status}`)}
    </Pill>
  );
}

export function DocumentsTab({ employee, master }: { employee: Employee; master: MasterData }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const documents = useQuery({ queryKey: ["employee", employee.id, "documents"], queryFn: () => hr.documents(employee.id) });
  const dependents = useQuery({
    queryKey: ["employee", employee.id, "dependents"],
    queryFn: () => hr.dependents(employee.id),
    enabled: holds(employee, "employees.view_personal"),
  });
  const manage = holds(employee, "employees.manage_documents");
  const remove = useMutation({
    mutationFn: (d: EmployeeDocument) => hr.deleteDocument(d.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employee", employee.id, "documents"] }),
  });
  const view = useMutation({ mutationFn: (d: EmployeeDocument) => openFile(() => hr.documentLink(d.id)) });
  const problem = apiErrors(remove.error ?? view.error, t("common.loadFailed")).general;
  const holder = new Map((dependents.data ?? []).map((d) => [d.id, format.name(d)]));
  const date = (d: string | null) => (d ? `${format.date(d)} · ${format.hijri(d)}` : "—");

  const columns: Column<EmployeeDocument>[] = [
    {
      id: "type",
      header: t("documents.type"),
      cell: (d) => (
        <span className="block">
          <span className="block font-medium">{master.name.documentType(d.document_type)}</span>
          {d.dependent && <span className="block text-sm text-muted">{holder.get(d.dependent) ?? t("documents.dependent")}</span>}
        </span>
      ),
    },
    { id: "number", header: t("documents.number"), cell: (d) => <span className="num" dir="ltr">{d.number || "—"}</span> },
    { id: "expiry", header: t("documents.expiryDate"), cell: (d) => <span className="num text-sm">{date(d.expiry_date)}</span> },
    { id: "status", header: t("documents.status"), cell: (d) => <ExpiryChip document={d} /> },
    {
      id: "file",
      header: <span className="sr-only">{t("documents.file")}</span>,
      className: "w-16",
      cell: (d) =>
        d.has_file ? (
          <IconButton size="sm" variant="plain" icon={<Eye />} label={t("documents.viewNamed", { name: d.file_name })} onClick={() => view.mutate(d)} />
        ) : null,
    },
  ];

  return (
    <Card
      variant="solid"
      title={t("documents.title")}
      action={
        manage ? (
          <Button size="sm" variant="accent" icon={<Plus className="size-4" />} onClick={() => setUploading(true)}>
            {t("documents.upload")}
          </Button>
        ) : undefined
      }
    >
      {problem && <Alert className="mb-3">{problem}</Alert>}
      <DataTable
        caption={t("documents.title")}
        columns={columns}
        rows={documents.data ?? []}
        rowKey={(d) => String(d.id)}
        rowLabel={(d) => master.name.documentType(d.document_type)}
        loading={documents.isPending}
        onDelete={manage ? (d) => remove.mutate(d) : undefined}
        minWidth={720}
        empty={t("documents.none")}
      />
      {uploading && (
        <DocumentDialog
          employee={employee.id}
          types={master.documentTypes}
          dependents={dependents.data ?? []}
          onClose={() => setUploading(false)}
        />
      )}
    </Card>
  );
}
