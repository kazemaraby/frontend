import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileDown, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { type ComplianceArea, type ComplianceItem, riskApi, type RiskRow, type Severity } from "@/api/compliance";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable, PersonCell } from "@/design/DataTable";
import { DonutGauge } from "@/design/DonutGauge";
import { CheckField, FormSelect, SearchInput } from "@/design/Field";
import { Pagination } from "@/design/Pagination";
import { Pill, type PillTone } from "@/design/Pill";
import { TrendChart } from "@/design/TrendChart";
import { apiErrors } from "@/lib/apiErrors";
import { saveFile } from "@/lib/saveFile";
import { useFormat } from "@/lib/useFormat";

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];
const AREAS: ComplianceArea[] = ["nitaqat", "documents", "visas", "wps", "gosi", "qiwa", "missing", "integrations"];
export const SEVERITY_TONES: Record<Severity, PillTone> = { critical: "salmon", high: "orange", medium: "amber", low: "neutral" };
const BAND_TONES: Record<RiskRow["band"], PillTone> = { low: "green", medium: "amber", high: "salmon" };
const PAGE_SIZE = 25;

/** The compliance dashboard (Phase 5 task 12, #107): each establishment's risk score (0–100, by the open items'
 * severity and age) and its 12-week trend, and the open items by area and severity. The checks run every night;
 * "Run the checks now" runs them without sending alerts. */
export function OverviewTab() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const { can } = useSession();
  const queryClient = useQueryClient();
  const [, setParams] = useSearchParams();
  const overview = useQuery({ queryKey: ["compliance-overview", ...scope], queryFn: riskApi.overview });
  const runNow = useMutation({ mutationFn: riskApi.runNow, onSuccess: async (data) => {
    queryClient.setQueryData(["compliance-overview", ...scope], data);
    await queryClient.invalidateQueries({ queryKey: ["compliance-items"] });
  } });
  const data = overview.data;
  const open = (query: Record<string, string>) => setParams({ tab: "report", ...query }, { replace: true });
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{data?.checked_on ? t("risk.checkedOn", { day: format.date(data.checked_on) }) : t("risk.neverChecked")}</p>
        {can("compliance.manage") && (
          <Button size="sm" variant="outline" icon={<RefreshCw className="size-4" />} disabled={runNow.isPending} onClick={() => runNow.mutate()}>
            {t("risk.runNow")}
          </Button>
        )}
      </div>
      {(overview.isError || runNow.isError) && <Alert>{apiErrors(overview.error ?? runNow.error, t("common.loadFailed")).general}</Alert>}
      {data?.establishments.map((row) => (
        <Card
          key={row.establishment.id}
          variant="solid"
          title={<Trans i18nKey="nitaqat.cardTitle" values={{ number: row.establishment.number || t("establishments.noNumber") }} components={{ n: <bdi dir="ltr" /> }} />}
          subtitle={t("risk.cardHint")}
        >
          <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
            <div className="flex flex-col items-center gap-3">
              <DonutGauge value={row.score} label={t("risk.gaugeLabel", { number: row.establishment.number || t("establishments.noNumber"), score: row.score })}>
                <span className="num text-2xl font-semibold">{format.number(row.score)}</span>
              </DonutGauge>
              <Pill tone={BAND_TONES[row.band]}>{t(`risk.bands.${row.band}`)}</Pill>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {SEVERITIES.map((s) => (
                  <button key={s} type="button" className="rounded-full" onClick={() => open({ severity: s })}>
                    <Pill tone={SEVERITY_TONES[s]}>{`${t(`risk.severities.${s}`)} · ${format.number(row.counts[s] ?? 0)}`}</Pill>
                  </button>
                ))}
              </div>
              {row.trend.length > 1 ? (
                <TrendChart label={t("risk.trend")} primaryLabel={t("risk.score")} height={180} data={row.trend.map((p) => ({ label: format.date(p.day, "dayMonth"), primary: p.score }))} />
              ) : (
                <p className="text-sm text-muted">{t("risk.noTrend")}</p>
              )}
            </div>
          </div>
        </Card>
      ))}
      {data && (
        <Card variant="solid" title={t("risk.byArea")} subtitle={t("risk.byAreaHint")}>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {AREAS.map((area) => (
              <li key={area}>
                <button type="button" onClick={() => open({ area })} className="flex w-full items-center justify-between rounded-card border border-line-strong bg-white px-4 py-3 text-sm hover:bg-neutral-soft">
                  <span>{t(`risk.areas.${area}`)}</span>
                  <span className="num font-semibold">{format.number(data.areas[area] ?? 0)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/** The compliance report (#107): every check's items, filterable; Excel with compliance.export (audited). People are
 * named only for whom the user may see personal data. */
export function ReportTab() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const { can } = useSession();
  const [params] = useSearchParams();
  const [area, setArea] = useState(params.get("area") ?? "");
  const [severity, setSeverity] = useState(params.get("severity") ?? "");
  const [resolved, setResolved] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const query = { area: area || undefined, severity: severity || undefined, resolved: resolved ? ("1" as const) : undefined };
  const items = useQuery({
    queryKey: ["compliance-items", area, severity, resolved, search, page, ...scope],
    queryFn: () => riskApi.items({ ...query, search: search || undefined, page }),
    placeholderData: keepPreviousData,
  });
  const exporting = useMutation({ mutationFn: async () => saveFile(await riskApi.exportItems(query)) });
  const columns: Column<ComplianceItem>[] = [
    { id: "severity", header: t("risk.severity"), cell: (i) => <Pill tone={SEVERITY_TONES[i.severity]}>{t(`risk.severities.${i.severity}`)}</Pill>, className: "w-28" },
    { id: "area", header: t("risk.area"), cell: (i) => <span className="text-sm">{t(`risk.areas.${i.area}`)}</span>, className: "w-32" },
    { id: "title", header: t("risk.finding"), cell: (i) => <span className="text-sm">{i.title}</span> },
    {
      id: "who",
      header: t("compliance.employee"),
      cell: (i) => (i.employee ? <PersonCell name={format.name(i.employee)} subtitle={i.employee.employee_no} /> : <span className="text-muted">{i.hidden ? t("risk.hiddenPerson") : "—"}</span>),
      className: "w-56",
    },
    {
      id: "age",
      header: t("risk.open"),
      cell: (i) => (
        <span className="flex flex-col text-sm">
          <span className="num">{i.resolved_on ? t("risk.resolvedOn", { day: format.date(i.resolved_on) }) : t("risk.days", { count: i.age })}</span>
          <span className="num text-xs text-muted">{t("risk.since", { day: format.date(i.first_seen) })}</span>
          {i.escalated && !i.resolved_on && <span className="text-xs text-danger">{t("risk.escalated")}</span>}
        </span>
      ),
      className: "w-40",
    },
  ];
  return (
    <Card
      variant="solid"
      title={t("risk.reportTitle")}
      subtitle={t("risk.reportHint")}
      action={
        can("compliance.export") && (
          <Button size="sm" variant="outline" icon={<FileDown className="size-4" />} disabled={exporting.isPending || !items.data?.count} onClick={() => exporting.mutate()}>
            {t("saudization.export")}
          </Button>
        )
      }
    >
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <FormSelect label={t("risk.area")} name="area" value={area} onChange={(e) => { setArea(e.target.value); setPage(1); }} options={[{ value: "", label: t("compliance.all") }, ...AREAS.map((a) => ({ value: a, label: t(`risk.areas.${a}`) }))]} className="w-full sm:w-48" />
        <FormSelect label={t("risk.severity")} name="severity" value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(1); }} options={[{ value: "", label: t("compliance.all") }, ...SEVERITIES.map((s) => ({ value: s, label: t(`risk.severities.${s}`) }))]} className="w-full sm:w-40" />
        <SearchInput label={t("common.search")} placeholder={t("common.searchPlaceholder")} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="w-full sm:w-64" />
        <CheckField label={t("risk.showResolved")} checked={resolved} onChange={(e) => { setResolved(e.target.checked); setPage(1); }} className="pb-3" />
      </div>
      {(items.isError || exporting.isError) && <Alert className="mb-3">{apiErrors(items.error ?? exporting.error, t("common.loadFailed")).general}</Alert>}
      <DataTable caption={t("risk.reportTitle")} columns={columns} rows={items.data?.results ?? []} rowKey={(i) => String(i.id)} loading={items.isPending} empty={t("risk.nothing")} minWidth={960} />
      {(items.data?.count ?? 0) > PAGE_SIZE && <Pagination page={page} pageCount={Math.ceil((items.data?.count ?? 0) / PAGE_SIZE)} onPageChange={setPage} />}
    </Card>
  );
}
