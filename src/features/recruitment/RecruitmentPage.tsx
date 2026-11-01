import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { recruitment, type Requisition } from "@/api/recruitment";
import { useScopeKey, useSession } from "@/auth/session";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { FormSelect } from "@/design/Field";
import { Pagination } from "@/design/Pagination";
import { Pill, StatusChip } from "@/design/Pill";
import { Tabs } from "@/design/Tabs";
import NoAccess from "@/features/misc/NoAccessPage";
import { Page } from "@/layout/Page";
import { useFormat } from "@/lib/useFormat";

import { BudgetsCard } from "./BudgetsCard";
import { InterviewTemplatesCard, OpeningsCard, PrivacyNoticeCard, RetentionCard } from "./OpeningsCard";
import { PipelineBoard } from "./PipelineBoard";
import { BUDGET_TONES, NITAQAT_TONES, RequisitionDialog } from "./RequisitionDialog";
import { TalentPoolCard } from "./TalentPoolCard";

type Tab = "requisitions" | "openings" | "pipeline" | "pool" | "budgets" | "settings";
const VIEW_TABS: Tab[] = ["openings", "pipeline", "pool", "budgets", "settings"];
const PAGE_SIZE = 25;

/** /recruitment — recruitment (Phase 6). Manpower requisitions (anyone with recruitment.request raises one; the list
 * shows what the user's scope allows); with recruitment.view: openings (task 2), the headcount budget, and the
 * settings (scorecard templates, the candidates' privacy notice). */
export default function RecruitmentPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const [params, setParams] = useSearchParams();
  const seesBudgets = can("recruitment.view");
  const asked = params.get("tab") as Tab | null;
  const tab: Tab = seesBudgets && asked && VIEW_TABS.includes(asked) ? asked : "requisitions";
  if (!can("recruitment.request") && !can("recruitment.view")) return <NoAccess />;
  return (
    <Page
      title={t("recruitment.title")}
      tabs={
        seesBudgets && (
          <Tabs
            label={t("recruitment.title")}
            value={tab}
            onChange={(next) => setParams(next === "requisitions" ? {} : { tab: next }, { replace: true })}
            items={[
              { id: "requisitions", label: t("recruitment.tabs.requisitions") },
              { id: "openings", label: t("recruitment.tabs.openings") },
              { id: "pipeline", label: t("recruitment.tabs.pipeline") },
              { id: "pool", label: t("recruitment.tabs.pool") },
              { id: "budgets", label: t("recruitment.tabs.budgets") },
              { id: "settings", label: t("recruitment.tabs.settings") },
            ]}
          />
        )
      }
    >
      {tab === "requisitions" && <RequisitionsCard />}
      {tab === "openings" && <OpeningsCard />}
      {tab === "pipeline" && <PipelineBoard />}
      {tab === "pool" && <TalentPoolCard />}
      {tab === "budgets" && <BudgetsCard />}
      {tab === "settings" && (
        <div className="flex flex-col gap-4">
          <InterviewTemplatesCard />
          <PrivacyNoticeCard />
          <RetentionCard />
        </div>
      )}
    </Page>
  );
}

function RequisitionsCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const { can } = useSession();
  const scope = useScopeKey();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const list = useQuery({
    queryKey: ["requisitions", status, page, ...scope],
    queryFn: () => recruitment.requisitions({ status: status || undefined, page }),
    placeholderData: (previous) => previous,
  });
  const columns: Column<Requisition>[] = [
    {
      id: "job",
      header: t("recruitment.requisition.job"),
      cell: (r) => (
        <span className="flex flex-col">
          <span className="font-semibold text-ink">{format.name(r.names.job_title)}</span>
          <span className="text-sm text-muted">
            {format.name(r.names.department)}
            {r.names.branch && ` · ${format.name(r.names.branch)}`}
          </span>
        </span>
      ),
    },
    {
      id: "positions",
      header: t("recruitment.requisition.positions"),
      cell: (r) => (
        <span className="num">
          {r.status === "approved" ? t("recruitment.requisition.filledOf", { filled: format.number(r.filled), positions: format.number(r.positions) }) : format.number(r.positions)}
          {r.reason === "replacement" && <span className="block text-sm text-muted">{t("recruitment.reasons.replacement")}</span>}
        </span>
      ),
    },
    { id: "requester", header: t("recruitment.requisition.requester"), cell: (r) => format.name(r.names.requester) },
    { id: "start", header: t("recruitment.requisition.targetStart"), cell: (r) => <span className="num">{format.date(r.target_start)}</span> },
    { id: "budget", header: t("recruitment.requisition.budget"), cell: (r) => r.budget && <Pill tone={BUDGET_TONES[r.budget]}>{t(`recruitment.budget.${r.budget}`)}</Pill> },
    { id: "nitaqat", header: t("recruitment.requisition.nitaqat"), cell: (r) => r.nitaqat && <Pill tone={NITAQAT_TONES[r.nitaqat]}>{t(`recruitment.nitaqat.${r.nitaqat}`)}</Pill> },
    {
      id: "status",
      header: t("recruitment.requisition.status"),
      cell: (r) =>
        r.status === "returned" ? (
          <Button variant="outline" size="sm" onClick={() => setEditing(r.id)}>
            {t("approvals.editAndResubmit")}
          </Button>
        ) : (
          <StatusChip status={r.status === "cancelled" ? "rejected" : r.status} label={t(`requestStatus.${r.status}`)} />
        ),
    },
  ];
  const count = list.data?.count ?? 0;
  return (
    <Card
      title={t("recruitment.requisitions")}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <FormSelect
            label={t("recruitment.requisition.status")}
            name="status"
            className="w-44"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            options={[{ value: "", label: t("recruitment.allStatuses") }, ...(["pending", "approved", "returned", "rejected"] as const).map((s) => ({ value: s, label: t(`requestStatus.${s}`) }))]}
          />
          {can("recruitment.request") && (
            <Button variant="accent" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
              {t("recruitment.newRequisition")}
            </Button>
          )}
        </div>
      }
    >
      <DataTable caption={t("recruitment.requisitions")} columns={columns} rows={list.data?.results ?? []} rowKey={(r) => String(r.id)} loading={list.isPending} empty={t("recruitment.noRequisitions")} />
      {count > PAGE_SIZE && <Pagination page={page} pageCount={Math.ceil(count / PAGE_SIZE)} onPageChange={setPage} />}
      {editing !== null && <RequisitionDialog editId={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}
