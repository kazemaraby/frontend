import { useQuery } from "@tanstack/react-query";
import { PencilLine } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { endpoints, type RequestFilters, type WorkflowRequest } from "@/api";
import { useScopeKey } from "@/auth/session";
import { Button } from "@/design/Button";
import { type Column, DataTable } from "@/design/DataTable";
import { Pagination } from "@/design/Pagination";
import { StatusChip } from "@/design/Pill";
import { KIND_OF_TYPE, useComposer } from "@/features/selfservice/composer";
import { useFormat } from "@/lib/useFormat";

import { RequestFilterBar } from "./RequestFilters";

const PAGE_SIZE = 25;

/** The user's requests of every type, with filters and pages. A returned request offers "edit and resubmit"
 * right in its row; the title opens the detail. */
export function MyRequests({ onOpen }: { onOpen: (id: number) => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const composer = useComposer();
  const [filters, setFilters] = useState<RequestFilters>({ page: 1 });
  const mine = useQuery({
    queryKey: ["requests", "mine", filters, ...scope],
    queryFn: () => endpoints.myRequests(filters),
    placeholderData: (previous) => previous,
  });
  const editable = (r: WorkflowRequest) => {
    const kind = KIND_OF_TYPE[r.request_type];
    return r.status === "returned" && r.can_cancel && kind && composer.kinds.includes(kind) ? kind : null;
  };
  const columns: Column<WorkflowRequest>[] = [
    {
      id: "request",
      header: t("approvals.columns.request"),
      cell: (r) => (
        <button type="button" onClick={() => onOpen(r.id)} className="cursor-pointer text-start">
          <span className="block font-semibold text-ink hover:underline">{format.pick({ ar: r.title_ar, en: r.title_en })}</span>
          <span className="block text-sm text-muted">{format.pick(r.type_name)}</span>
        </button>
      ),
    },
    { id: "submitted", header: t("approvals.columns.submitted"), cell: (r) => <span className="num text-muted">{format.relative(r.submitted_at)}</span> },
    {
      id: "status",
      header: t("approvals.columns.status"),
      cell: (r) => (
        <span className="flex flex-wrap items-center gap-2">
          <StatusChip status={r.status} label={t(`requestStatus.${r.status}`)} />
          {r.current_step && <span className="text-sm text-muted">{format.pick(r.current_step)}</span>}
        </span>
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">{t("common.actions")}</span>,
      cell: (r) => {
        const kind = editable(r);
        return kind ? (
          <span className="flex justify-end">
            <Button size="sm" variant="outline" icon={<PencilLine className="size-4" />} onClick={() => composer.open(kind, r.object_id)}>
              {t("approvals.editAndResubmit")}
            </Button>
          </span>
        ) : null;
      },
    },
  ];
  const total = mine.data?.count ?? 0;
  const filtered = Boolean(filters.search || filters.type || filters.status);
  return (
    <>
      <RequestFilterBar value={filters} onChange={setFilters} statuses />
      <DataTable
        caption={t("approvals.tabs.mine")}
        columns={columns}
        rows={mine.data?.results ?? []}
        rowKey={(r) => String(r.id)}
        loading={mine.isPending}
        empty={filtered ? t("approvals.noMatch") : t("approvals.emptyMine")}
        minWidth={760}
      />
      {total > PAGE_SIZE && <Pagination page={filters.page ?? 1} pageCount={Math.ceil(total / PAGE_SIZE)} onPageChange={(page) => setFilters({ ...filters, page })} />}
    </>
  );
}
