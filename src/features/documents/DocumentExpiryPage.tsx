import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { type EmployeeDocument, hr } from "@/api/hr";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Card, CardLink } from "@/design/Card";
import { type Column, DataTable, PersonCell } from "@/design/DataTable";
import { Select } from "@/design/Field";
import { Pagination } from "@/design/Pagination";
import { Tabs } from "@/design/Tabs";
import { useMasterData } from "@/features/employees/masterData";
import { ExpiryChip } from "@/features/employees/profile/DocumentsTab";
import { Page } from "@/layout/Page";
import { useFormat } from "@/lib/useFormat";
import { ExportButtons } from "@/features/reports/ExportButtons";

const PAGE_SIZE = 10;
const WINDOWS = ["30", "60", "90", "180"] as const;
const CATEGORIES = ["identity", "travel", "employment", "education", "license", "insurance", "medical", "other"];

/** /documents — document expiry report (#134): expired documents and those expiring within N days (latest of each
 * type per person), in the user's data scope, exportable to Excel. */
export default function DocumentExpiryPage() {
  const { t } = useTranslation();
  const format = useFormat();
  const navigate = useNavigate();
  const { can } = useSession();
  const scopeKey = useScopeKey();
  const master = useMasterData();
  const [view, setView] = useState<"window" | "expired">("window");
  const [within, setWithin] = useState<string>("60");
  const [category, setCategory] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);

  const criteria =
    view === "expired"
      ? { status: "expired", current: 1, category, document_type: type }
      : { expiring_within: within, category, document_type: type };
  const query = { ...criteria, page, page_size: PAGE_SIZE };
  const documents = useQuery({
    queryKey: ["documents", "report", ...scopeKey, query],
    queryFn: () => hr.documentReport(query),
    placeholderData: keepPreviousData,
  });
  const reset = <V,>(set: (v: V) => void) => (v: V) => {
    set(v);
    setPage(1);
  };
  const date = (d: string | null) => (d ? `${format.date(d)} · ${format.hijri(d)}` : "—");

  const columns: Column<EmployeeDocument>[] = [
    {
      id: "employee",
      header: t("reports.documents.employee"),
      cell: (d) => (
        <PersonCell
          name={format.name(d.employee_info)}
          subtitle={d.dependent_name ? t("reports.documents.forDependent", { name: format.pick(d.dependent_name) }) : d.employee_info.employee_no}
        />
      ),
    },
    { id: "type", header: t("documents.type"), cell: (d) => master.name.documentType(d.document_type) },
    { id: "number", header: t("documents.number"), cell: (d) => <span className="num" dir="ltr">{d.number || "—"}</span> },
    { id: "expiry", header: t("documents.expiryDate"), cell: (d) => <span className="num text-sm">{date(d.expiry_date)}</span> },
    { id: "status", header: t("documents.status"), cell: (d) => <ExpiryChip document={d} /> },
    {
      id: "open",
      header: <span className="sr-only">{t("common.actions")}</span>,
      className: "w-28 text-end",
      cell: (d) => (
        <CardLink onClick={() => navigate(`/employees/${d.employee_info.id}?tab=documents`)}>{t("employees.viewFile")}</CardLink>
      ),
    },
  ];
  const total = documents.data?.count ?? 0;

  return (
    <Page
      title={t("reports.documents.title")}
      tabs={
        <Tabs
          label={t("reports.documents.title")}
          value={view}
          onChange={reset(setView)}
          items={[
            { id: "window", label: t("reports.documents.expiring") },
            { id: "expired", label: t("reports.documents.expired") },
          ]}
        />
      }
      actions={
        can("employees.export") && (
          <ExportButtons download={(as) => hr.exportDocuments(criteria, as)} />
        )
      }
    >
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          {view === "window" && (
            <Select
              label={t("reports.documents.window")}
              value={within}
              onChange={(e) => reset(setWithin)(e.target.value)}
              options={WINDOWS.map((w) => ({ value: w, label: t("reports.documents.withinDays", { days: w }) }))}
              className="flex-1 sm:flex-none [&_select]:border-white [&_select]:shadow-soft"
            />
          )}
          <Select
            label={t("reports.documents.allCategories")}
            value={category}
            onChange={(e) => reset(setCategory)(e.target.value)}
            options={[{ value: "", label: t("reports.documents.allCategories") }, ...CATEGORIES.map((c) => ({ value: c, label: t(`reports.documents.categories.${c}`) }))]}
            className="flex-1 sm:flex-none [&_select]:border-white [&_select]:shadow-soft"
          />
          <Select
            label={t("reports.documents.allTypes")}
            value={type}
            onChange={(e) => reset(setType)(e.target.value)}
            options={[
              { value: "", label: t("reports.documents.allTypes") },
              ...master.documentTypes.filter((d) => d.has_expiry).map((d) => ({ value: d.code, label: format.name(d) })),
            ]}
            className="flex-1 sm:flex-none [&_select]:border-white [&_select]:shadow-soft"
          />
        </div>
        {view === "window" && <p className="mb-3 text-sm text-muted">{t("reports.documents.windowNote", { days: within })}</p>}
        {documents.isError ? (
          <Alert>{t("common.loadFailed")}</Alert>
        ) : (
          <DataTable
            caption={t("reports.documents.title")}
            columns={columns}
            rows={documents.data?.results ?? []}
            rowKey={(d) => String(d.id)}
            rowLabel={(d) => format.name(d.employee_info)}
            loading={documents.isPending}
            minWidth={900}
            empty={t("reports.documents.none")}
          />
        )}
        <Pagination
          page={page}
          pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
          onPageChange={setPage}
          summary={t("reports.documents.count", { count: total, total: format.number(total) })}
        />
      </Card>
    </Page>
  );
}
