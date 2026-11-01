import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { punches, type SyncRunRow } from "@/api/attendance";
import { useScopeKey } from "@/auth/session";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { Dialog } from "@/design/Dialog";
import { FormSelect } from "@/design/Field";
import { Pagination } from "@/design/Pagination";
import { Pill } from "@/design/Pill";
import { useFormat } from "@/lib/useFormat";

export const RUN_TONES = { ok: "green", failed: "salmon", running: "amber" } as const;

/** The sync log (Phase 3 task 12): every read of the company's connections and every batch from an agent — when,
 * what came (new, repeats, not linked), and why a read failed or which punches were refused. */
export function SyncLogCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const [filters, setFilters] = useState({ connector: "", status: "", trigger: "" });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<SyncRunRow | null>(null);
  const connectors = useQuery({ queryKey: ["connectors", ...scope], queryFn: punches.connectors });
  const list = useQuery({
    queryKey: ["sync-runs", filters, page, ...scope],
    queryFn: () =>
      punches.syncLog({
        connector: filters.connector ? Number(filters.connector) : undefined,
        status: filters.status || undefined,
        trigger: filters.trigger || undefined,
        page,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
  const set = (key: keyof typeof filters, value: string) => {
    setFilters({ ...filters, [key]: value });
    setPage(1);
  };
  const columns: Column<SyncRunRow>[] = [
    { id: "when", header: t("syncLog.when"), cell: (r) => <span className="num">{format.relative(r.started_at)}</span> },
    {
      id: "connector",
      header: t("syncLog.connection"),
      cell: (r) => (
        <span className="flex flex-col">
          <span className="font-medium text-ink">{r.connector.name}</span>
          <span className="text-xs text-muted">{t(`devices.triggers.${r.trigger}`)}</span>
        </span>
      ),
    },
    { id: "status", header: t("syncLog.status"), cell: (r) => <Pill tone={RUN_TONES[r.status]}>{t(`devices.runStates.${r.status}`)}</Pill> },
    {
      id: "counts",
      header: t("syncLog.counts"),
      cell: (r) => <span className="num text-sm">{t("devices.runCounts", { received: r.received, new: r.new, already: r.already, unmapped: r.unmapped })}</span>,
    },
    {
      id: "problem",
      header: <span className="sr-only">{t("syncLog.problem")}</span>,
      cell: (r) =>
        r.message || r.error_count ? (
          <Button size="sm" variant="ghost" onClick={() => setOpen(r)}>
            {r.message ? t("syncLog.why") : t("syncLog.refused", { count: r.error_count })}
          </Button>
        ) : null,
    },
  ];
  return (
    <Card variant="solid" title={t("syncLog.title")} subtitle={t("syncLog.hint")}>
      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <FormSelect label={t("syncLog.connection")} name="connector" value={filters.connector} placeholder={t("syncLog.every")} onChange={(e) => set("connector", e.target.value)} options={(connectors.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))} />
        <FormSelect label={t("syncLog.status")} name="status" value={filters.status} placeholder={t("syncLog.every")} onChange={(e) => set("status", e.target.value)} options={(["ok", "failed", "running"] as const).map((x) => ({ value: x, label: t(`devices.runStates.${x}`) }))} />
        <FormSelect label={t("syncLog.trigger")} name="trigger" value={filters.trigger} placeholder={t("syncLog.every")} onChange={(e) => set("trigger", e.target.value)} options={(["schedule", "manual", "agent"] as const).map((x) => ({ value: x, label: t(`devices.triggers.${x}`) }))} />
      </div>
      <DataTable caption={t("syncLog.title")} columns={columns} rows={list.data?.results ?? []} rowKey={(r) => String(r.id)} loading={list.isPending} empty={t("devices.noRuns")} minWidth={760} />
      {(list.data?.count ?? 0) > 25 && <Pagination page={page} pageCount={Math.ceil((list.data?.count ?? 0) / 25)} onPageChange={setPage} />}
      {open && (
        <Dialog open onClose={() => setOpen(null)} title={t("syncLog.detailOf", { name: open.connector.name, when: format.relative(open.started_at) })}>
          <div className="flex flex-col gap-3 text-sm">
            {open.message && <p className="text-danger">{open.message}</p>}
            {(open.details.errors ?? []).length > 0 && (
              <ul aria-label={t("syncLog.refusedList")} className="flex flex-col gap-1">
                {(open.details.errors ?? []).map((e) => (
                  <li key={e.index} className="flex gap-3">
                    <span className="num text-muted">#{e.index + 1}</span>
                    <span>{e.error}</span>
                  </li>
                ))}
              </ul>
            )}
            {open.error_count > (open.details.errors ?? []).length && <p className="text-muted">{t("syncLog.more", { count: open.error_count - (open.details.errors ?? []).length })}</p>}
          </div>
        </Dialog>
      )}
    </Card>
  );
}
