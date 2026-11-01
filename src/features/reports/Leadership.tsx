import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { type DashboardPeriod, type LeadershipRow, leadershipApi, type NitaqatBand } from "@/api/reports";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { Money } from "@/design/Money";
import { useFormat } from "@/lib/useFormat";

const BANDS: Record<Exclude<NitaqatBand, "">, string> = { platinum: "platinum", high_green: "highGreen", medium_green: "midGreen", low_green: "lowGreen", red: "red" };

type Line = LeadershipRow & { key: string; kind: "company" | "branch" | "total"; name: string; hidden?: number };

/** The leadership dashboard (task 16, #130): every company (and branch) the user leads, side by side, with the
 * totals; money per currency, never converted (apps/reports/leadership.py). */
export function LeadershipBoard({ period }: { period: DashboardPeriod }) {
  const { t } = useTranslation();
  const format = useFormat();
  const data = useQuery({ queryKey: ["leadership", period], queryFn: () => leadershipApi.get(period) });
  const percent = (v: string | null) => (v === null ? "—" : `${format.number(v, [0, 1])}%`);
  const lines: Line[] = (data.data?.companies ?? []).flatMap((c) => [
    { ...c, key: `c${c.id}`, kind: "company" as const, name: format.name(c), hidden: c.hidden_branches },
    ...c.branches.map((b) => ({ ...b, key: `b${c.id}-${b.id ?? "none"}`, kind: "branch" as const, name: b.id === null ? t("reports.leadership.noBranch") : format.name(b) })),
  ]);
  if (data.data) lines.push({ ...data.data.totals, key: "total", kind: "total", name: t("reports.leadership.total") });
  const columns: Column<Line>[] = [
    { id: "name", header: t("reports.leadership.unit"), cell: (l) => (
        <span className="flex flex-col">
          <span className={l.kind === "branch" ? "ps-5 text-muted" : "font-semibold text-ink"}>{l.name}</span>
          {!!l.hidden && <span className="text-xs text-muted">{t("reports.leadership.hiddenBranches", { count: l.hidden })}</span>}
        </span>
      ) },
    { id: "active", header: t("reports.leadership.active"), cell: (l) => <span className="num font-semibold">{format.number(l.active)}</span> },
    { id: "moves", header: t("reports.leadership.moves"), cell: (l) => <span className="num text-sm">{t("reports.leadership.movesValue", { hires: l.hires, separations: l.separations, voluntary: l.voluntary })}</span> },
    { id: "turnover", header: t("reports.turnover"), cell: (l) => <span className="num">{percent(l.turnover)}</span> },
    { id: "retention", header: t("reports.retention"), cell: (l) => <span className="num">{percent(l.retention)}</span> },
    { id: "saudization", header: t("reports.saudization"), cell: (l) => (l.nitaqat ? <span className="flex flex-col"><span className="num">{percent(l.nitaqat.percent)}</span>{l.nitaqat.band && <span className="text-xs text-muted">{t(`reports.nitaqat.${BANDS[l.nitaqat.band]}`)}</span>}</span> : <span className="text-muted">—</span>) },
    {
      id: "cost",
      header: t("reports.leadership.cost"),
      cell: (l) =>
        l.payroll_cost.length === 0 ? (
          <span className="text-muted">—</span>
        ) : (
          <span className="flex flex-col items-start gap-0.5">
            {l.payroll_cost.map((c) => (c.total === null ? <span key={c.currency} className="text-sm text-muted">{t("reports.leadership.hidden", { currency: c.currency })}</span> : <Money key={c.currency} amount={c.total} currency={c.currency} />))}
          </span>
        ),
    },
  ];
  const covered = data.data?.period;
  return (
    <Card title={t("reports.leadership.title")} subtitle={covered ? format.dateRange(covered.first, covered.last) : undefined}>
      {data.isError ? (
        <p className="text-danger">{t("reports.loadFailed")}</p>
      ) : (
        <>
          <DataTable caption={t("reports.leadership.title")} columns={columns} rows={lines} rowKey={(l) => l.key} rowLabel={(l) => l.name} loading={data.isPending} empty={t("reports.leadership.empty")} />
          <p className="mt-3 text-sm text-muted">{t("reports.leadership.note")}</p>
        </>
      )}
    </Card>
  );
}
