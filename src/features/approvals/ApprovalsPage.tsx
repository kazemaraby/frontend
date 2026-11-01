import { useQuery } from "@tanstack/react-query";
import { UserRoundCog } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { type ApprovalTask, type Decision, endpoints, type RequestFilters, type WorkflowRequest } from "@/api";
import { useScopeKey } from "@/auth/session";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable, PersonCell } from "@/design/DataTable";
import { Pagination } from "@/design/Pagination";
import { Pill, StatusChip } from "@/design/Pill";
import { Tabs } from "@/design/Tabs";
import { NewRequestMenu } from "@/features/selfservice/composer";
import { Page } from "@/layout/Page";
import { useFormat } from "@/lib/useFormat";

import { DelegateDialog, DelegationBanner } from "./Delegations";
import { MyRequests } from "./MyRequests";
import { DecisionDialog, RequestDetail } from "./RequestDetail";
import { RequestFilterBar } from "./RequestFilters";

const PAGE_SIZE = 25;

type Tab = "pending" | "mine" | "done";

// --- page ----------------------------------------------------------------------------------------

export default function ApprovalsPage() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "pending";
  const openId = Number(params.get("request")) || null;
  const [decision, setDecision] = useState<{ task: ApprovalTask; decision: Decision } | null>(null);
  const [delegating, setDelegating] = useState(false);
  const [filters, setFilters] = useState<RequestFilters>({ page: 1 });

  const setTab = (next: Tab) => {
    setFilters({ page: 1 });
    setParams({ tab: next }, { replace: true });
  };
  const openRequest = (id: number | null) =>
    setParams(id ? { tab, request: String(id) } : { tab }, { replace: true });

  const count = useQuery({ queryKey: ["approvals", "count", ...scope], queryFn: endpoints.approvalCount });
  const tasks = useQuery({
    queryKey: ["approvals", "tasks", tab, filters, ...scope],
    queryFn: () => endpoints.approvalTasks(tab === "done" ? "done" : "pending", filters),
    enabled: tab !== "mine", // no placeholder data: another tab's rows must never be clickable here
  });

  const name = (p: { name_ar: string; name_en: string }) => format.pick({ ar: p.name_ar, en: p.name_en });
  const title = (r: WorkflowRequest) => (
    <button type="button" onClick={() => openRequest(r.id)} className="cursor-pointer text-start">
      <span className="block font-semibold text-ink hover:underline">{format.pick({ ar: r.title_ar, en: r.title_en })}</span>
      <span className="block text-sm text-muted">{format.pick(r.type_name)}</span>
    </button>
  );

  /** Delegated ("on behalf of …") and escalated tasks say so next to the step. */
  const taskNotes = (task: ApprovalTask) => (
    <>
      {task.on_behalf_of && <Pill tone="lavender">{t("approvals.onBehalfOf", { name: name(task.on_behalf_of) })}</Pill>}
      {task.escalated && <Pill tone="orange">{t("approvals.escalatedToYou")}</Pill>}
    </>
  );

  const pendingColumns: Column<ApprovalTask>[] = [
    { id: "request", header: t("approvals.columns.request"), cell: (task) => title(task.request) },
    { id: "requester", header: t("approvals.columns.requester"), cell: (task) => <PersonCell name={name(task.request.requester)} /> },
    {
      id: "submitted",
      header: t("approvals.columns.submitted"),
      cell: (task) => <span className="num text-muted">{format.relative(task.request.submitted_at)}</span>,
    },
    {
      id: "step",
      header: t("approvals.columns.step"),
      cell: (task) => (
        <span className="flex flex-wrap items-center gap-2">
          {format.pick({ ar: task.step_name_ar, en: task.step_name_en })}
          {task.overdue && <Pill tone="salmon">{t("approvals.overdue")}</Pill>}
          {taskNotes(task)}
        </span>
      ),
    },
    {
      id: "decide",
      header: <span className="sr-only">{t("common.actions")}</span>,
      className: "w-80",
      cell: (task) => (
        <span className="flex justify-end gap-2">
          <Button size="sm" variant="accent" onClick={() => setDecision({ task, decision: "approve" })}>
            {t("approvals.decision.approve.short")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDecision({ task, decision: "return" })}>
            {t("approvals.decision.return.short")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDecision({ task, decision: "reject" })}>
            {t("approvals.decision.reject.short")}
          </Button>
        </span>
      ),
    },
  ];

  const doneColumns: Column<ApprovalTask>[] = [
    pendingColumns[0],
    pendingColumns[1],
    {
      id: "decision",
      header: t("approvals.columns.myDecision"),
      cell: (task) => <Pill tone={task.status === "approved" ? "green" : task.status === "rejected" ? "salmon" : "neutral"}>{t(`approvals.taskStatus.${task.status}`)}</Pill>,
    },
    { id: "when", header: t("approvals.columns.when"), cell: (task) => <span className="num text-muted">{task.acted_at ? format.relative(task.acted_at) : "—"}</span> },
    { id: "now", header: t("approvals.columns.status"), cell: (task) => <StatusChip status={task.request.status} label={t(`requestStatus.${task.request.status}`)} /> },
  ];

  const pendingCount = count.data?.pending ?? 0;

  return (
    <Page
      title={t("approvals.title")}
      tabs={
        <Tabs
          label={t("approvals.title")}
          value={tab}
          onChange={setTab}
          items={[
            { id: "pending", label: pendingCount ? `${t("approvals.tabs.pending")} (${format.number(pendingCount)})` : t("approvals.tabs.pending") },
            { id: "mine", label: t("approvals.tabs.mine") },
            { id: "done", label: t("approvals.tabs.done") },
          ]}
        />
      }
      actions={
        <>
          <Button variant="outline" icon={<UserRoundCog className="size-[18px]" />} onClick={() => setDelegating(true)}>
            {t("delegations.open")}
          </Button>
          <NewRequestMenu />
        </>
      }
    >
      <DelegationBanner />
      <Card>
        {tab !== "mine" && <RequestFilterBar value={filters} onChange={setFilters} />}
        {tab === "mine" ? (
          <MyRequests onOpen={openRequest} />
        ) : tab === "pending" && !tasks.isPending && (tasks.data?.results.length ?? 0) > 0 ? (
          <>
            {/* Phones: one card per request with the decision buttons in view (a wide table would hide them). */}
            <ul className="flex flex-col gap-2.5 md:hidden">
              {tasks.data!.results.map((task) => (
                <li key={task.id} className="rounded-tile bg-white p-4">
                  {title(task.request)}
                  <p className="num mt-2 text-sm text-muted">
                    {name(task.request.requester)} · {format.relative(task.request.submitted_at)} ·{" "}
                    {format.pick({ ar: task.step_name_ar, en: task.step_name_en })}
                  </p>
                  {(task.on_behalf_of || task.escalated) && <p className="mt-2 flex flex-wrap gap-2">{taskNotes(task)}</p>}
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="accent" className="flex-1" onClick={() => setDecision({ task, decision: "approve" })}>
                      {t("approvals.decision.approve.short")}
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setDecision({ task, decision: "return" })}>
                      {t("approvals.decision.return.short")}
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setDecision({ task, decision: "reject" })}>
                      {t("approvals.decision.reject.short")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden md:block">
              <DataTable
                caption={t("approvals.tabs.pending")}
                columns={pendingColumns}
                rows={tasks.data!.results}
                rowKey={(task) => String(task.id)}
                minWidth={900}
              />
            </div>
          </>
        ) : (
          <DataTable
            caption={tab === "pending" ? t("approvals.tabs.pending") : t("approvals.tabs.done")}
            columns={tab === "pending" ? pendingColumns : doneColumns}
            rows={tasks.data?.results ?? []}
            rowKey={(task) => String(task.id)}
            loading={tasks.isPending}
            empty={filters.search || filters.type ? t("approvals.noMatch") : tab === "pending" ? t("approvals.emptyPending") : t("approvals.emptyDone")}
            minWidth={900}
          />
        )}
        {tab !== "mine" && (tasks.data?.count ?? 0) > PAGE_SIZE && (
          <Pagination page={filters.page ?? 1} pageCount={Math.ceil(tasks.data!.count / PAGE_SIZE)} onPageChange={(page) => setFilters({ ...filters, page })} />
        )}
      </Card>

      {decision && (
        <DecisionDialog
          taskId={decision.task.id}
          title={format.pick({ ar: decision.task.request.title_ar, en: decision.task.request.title_en })}
          decision={decision.decision}
          onClose={() => setDecision(null)}
        />
      )}
      {openId && <RequestDetail id={openId} onClose={() => openRequest(null)} />}
      {delegating && <DelegateDialog onClose={() => setDelegating(false)} />}
    </Page>
  );
}
