import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { Employee } from "@/api";
import { type ChangeLogEntry, hr, type LifecycleAction } from "@/api/hr";
import { Card } from "@/design/Card";
import { Money } from "@/design/Money";
import { Pill } from "@/design/Pill";
import { TaskList } from "@/features/onboarding/TaskList";
import { useFormat } from "@/lib/useFormat";

import type { MasterData } from "../masterData";

type Entry = { date: string; key: string; title: string; detail?: ReactNode; by?: string };

/** Status changes, applied promotions / transfers / salary changes, contracts, and (HR) the change log. */
export function HistoryTab({ employee, master }: { employee: Employee; master: MasterData }) {
  const { t } = useTranslation();
  const format = useFormat();
  const history = useQuery({ queryKey: ["employee", employee.id, "history"], queryFn: () => hr.history(employee.id) });
  const data = history.data;
  const arrow = format.dir === "rtl" ? "←" : "→"; // from → to in the reading direction
  // Audit keys are model field names (foreign keys as "nationality_id"); show the field's label when we have one.
  const fieldLabel = (key: string) => t(`employee.fields.${key.replace(/_id$/, "")}`, { defaultValue: key });
  const actorName = (actor: ChangeLogEntry["actor"]) =>
    !actor || actor === "system" ? t("history.system") : typeof actor === "string" ? actor : format.name(actor);

  const value = (action: LifecycleAction, side: "from" | "to", field: string) => {
    const v = action[`${side}_${field}` as keyof LifecycleAction] as string | number | null | undefined;
    if (v === undefined) return null; // hidden (salary)
    if (v === null || v === "") return "—";
    if (field.includes("salary") || field.includes("allowance")) return <Money amount={v} />;
    const names: Record<string, (x: unknown) => string> = {
      job_title: master.name.jobTitle,
      grade: master.name.grade,
      department: master.name.department,
      branch: master.name.branch,
    };
    return names[field]?.(v) || `#${v}`;
  };

  const entries: Entry[] = [
    ...(data?.status_changes ?? []).map((c) => ({
      date: c.effective_date,
      key: `s${c.id}`,
      title: t("history.statusChange", { from: t(`status.${c.from_status}`), to: t(`status.${c.to_status}`) }),
      detail: [c.reason && t(`employee.reasons.${c.reason}`), c.note].filter(Boolean).join(" · "),
      by: c.changed_by ? format.name(c.changed_by) : t("history.system"),
    })),
    ...(data?.actions ?? []).map((a) => ({
      date: a.effective_date,
      key: `a${a.id}`,
      title: t(`employee.actions.types.${a.action_type}`),
      detail: (
        <ul className="mt-1 flex flex-col gap-0.5">
          {a.changed_fields
            .filter((f) => value(a, "to", f) !== null)
            .map((f) => (
              <li key={f} className="num text-sm">
                {t(`employee.fields.${f}`)}: {value(a, "from", f)} {arrow} {value(a, "to", f)}
              </li>
            ))}
          {a.reason && <li className="text-sm text-muted">{a.reason}</li>}
        </ul>
      ),
      by: a.confirmed_by ? format.name(a.confirmed_by) : undefined,
    })),
    ...(data?.contracts ?? []).map((c) => ({
      date: c.start_date,
      key: `c${c.id}`,
      title: t("history.contract", { type: master.name.contractType(c.contract_type), status: t(`contracts.status.${c.status}`) }),
      detail: c.end_date ? t("history.contractUntil", { date: format.date(c.end_date) }) : undefined,
    })),
  ].sort((x, y) => (x.date < y.date ? 1 : -1));

  return (
    <div className="flex flex-col gap-4">
      <Card variant="solid" title={t("history.title")}>
        {history.isPending ? (
          <p className="text-muted">{t("common.loading")}</p>
        ) : entries.length === 0 ? (
          <p className="text-muted">{t("history.none")}</p>
        ) : (
          <ol className="flex flex-col gap-4 border-s-2 border-line ps-5">
            {entries.map((e) => (
              <li key={e.key} className="relative">
                <span aria-hidden="true" className="absolute -start-[27px] top-1.5 size-3 rounded-full bg-teal-dark" />
                <p className="num text-xs text-muted">
                  {format.date(e.date)}
                  {e.by ? ` · ${e.by}` : ""}
                </p>
                <p className="font-medium text-ink">{e.title}</p>
                {e.detail && <div className="text-sm text-muted">{e.detail}</div>}
              </li>
            ))}
          </ol>
        )}
      </Card>
      {data?.change_log && (
        <Card variant="solid" title={t("history.changeLog")} subtitle={t("history.changeLogNote")}>
          <ul className="flex flex-col divide-y divide-line">
            {data.change_log.map((entry) => {
              const fields = Object.keys(entry.after ?? entry.before ?? {});
              return (
                <li key={entry.id} className="py-3">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <Pill tone={entry.action === "delete" ? "salmon" : entry.action === "create" ? "green" : "sky"}>
                      {t(`history.actions.${entry.action}`, { defaultValue: entry.action })}
                    </Pill>
                    <span className="font-medium">{t(`history.models.${entry.model.split(".")[1]}`, { defaultValue: entry.model })}</span>
                    <span className="num text-muted">
                      {format.date(new Date(entry.at))} · {actorName(entry.actor)}
                    </span>
                  </p>
                  {entry.action === "update" && fields.length > 0 && (
                    <ul className="num mt-1 flex flex-col gap-0.5 text-xs text-muted">
                      {fields.map((f) => (
                        <li key={f}>
                          {fieldLabel(f)}: <bdi>{String(entry.before?.[f] ?? "—")}</bdi> {arrow} <bdi>{String(entry.after?.[f] ?? "—")}</bdi>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

export function OnboardingTab({ employee }: { employee: Employee }) {
  const { t } = useTranslation();
  const tasks = useQuery({ queryKey: ["onboarding", "employee", employee.id], queryFn: () => hr.onboardingTasks({ employee: employee.id }) });
  const rows = tasks.data?.results ?? [];
  const done = rows.filter((x) => x.status !== "open").length;
  return (
    <Card variant="solid" title={t("onboarding.title")} subtitle={rows.length ? t("onboarding.progress", { done, total: rows.length }) : undefined}>
      <TaskList tasks={rows} loading={tasks.isPending} />
    </Card>
  );
}
