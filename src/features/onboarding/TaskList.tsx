import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { hr, type OnboardingTask } from "@/api/hr";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { type Column, DataTable } from "@/design/DataTable";
import { Pill } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

/** Onboarding tasks with a done / reopen button. The API decides who may change what (assignee or HR). */
export function TaskList({ tasks, loading, showEmployee = false }: { tasks: OnboardingTask[]; loading?: boolean; showEmployee?: boolean }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: ({ task, status }: { task: OnboardingTask; status: OnboardingTask["status"] }) => hr.updateTask(task.id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["onboarding"] }),
  });
  const columns: Column<OnboardingTask>[] = [
    ...(showEmployee ? [{ id: "employee", header: t("onboarding.employee"), cell: (task: OnboardingTask) => format.pick(task.employee_name) }] : []),
    {
      id: "title",
      header: t("onboarding.task"),
      cell: (task) => (
        <span className="block">
          <span className="block font-medium">{format.pick({ ar: task.title_ar, en: task.title_en })}</span>
          {(task.details_ar || task.details_en) && (
            <span className="block text-sm text-muted">{format.pick({ ar: task.details_ar, en: task.details_en })}</span>
          )}
        </span>
      ),
    },
    {
      id: "assignee",
      header: t("onboarding.assignee"),
      cell: (task) => (task.assignee_name ? format.name(task.assignee_name) : t(`onboarding.assignees.${task.assignee_type}`)),
    },
    { id: "due", header: t("onboarding.due"), cell: (task) => <span className="num">{format.date(task.due_date)}</span> },
    {
      id: "status",
      header: t("onboarding.status"),
      cell: (task) =>
        task.is_overdue ? (
          <Pill tone="salmon">{t("onboarding.overdue")}</Pill>
        ) : (
          <Pill tone={task.status === "done" ? "green" : task.status === "skipped" ? "neutral" : "amber"}>{t(`onboarding.statuses.${task.status}`)}</Pill>
        ),
    },
    {
      id: "act",
      header: <span className="sr-only">{t("common.actions")}</span>,
      className: "w-36 text-end",
      cell: (task) =>
        task.status === "open" ? (
          <Button size="sm" icon={<Check className="size-4" />} disabled={update.isPending} onClick={() => update.mutate({ task, status: "done" })}>
            {t("onboarding.markDone")}
          </Button>
        ) : task.status === "done" ? (
          <Button size="sm" variant="outline" icon={<RotateCcw className="size-4" />} disabled={update.isPending} onClick={() => update.mutate({ task, status: "open" })}>
            {t("onboarding.reopen")}
          </Button>
        ) : null,
    },
  ];
  return (
    <>
      {update.isError && <Alert className="mb-3">{apiErrors(update.error, t("common.saveFailed")).general}</Alert>}
      <DataTable
        caption={t("onboarding.title")}
        columns={columns}
        rows={tasks}
        rowKey={(task) => String(task.id)}
        rowLabel={(task) => format.pick({ ar: task.title_ar, en: task.title_en })}
        loading={loading}
        minWidth={760}
        empty={t("onboarding.none")}
      />
    </>
  );
}
