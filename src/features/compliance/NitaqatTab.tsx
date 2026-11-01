import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, FileDown, RefreshCw, Users } from "lucide-react";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";

import { complianceSettings, type NitaqatBand, type NitaqatBandCode, type NitaqatPerson, type NitaqatRow, nitaqatApi, type SaudizationBy, type SaudizationRow } from "@/api/compliance";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable, PersonCell } from "@/design/DataTable";
import { Dialog } from "@/design/Dialog";
import { DonutGauge } from "@/design/DonutGauge";
import { FormSelect } from "@/design/Field";
import { Pill, type PillTone } from "@/design/Pill";
import { TrendChart } from "@/design/TrendChart";
import { apiErrors } from "@/lib/apiErrors";
import { saveFile } from "@/lib/saveFile";
import { useFormat } from "@/lib/useFormat";

import { SimulationDialog } from "./SimulationDialog";

const BANDS: NitaqatBand[] = ["platinum", "high_green", "medium_green", "low_green"];
export const BAND_TONES: Record<NitaqatBandCode, PillTone> = { platinum: "navy", high_green: "green", medium_green: "green", low_green: "amber", red: "salmon" };
const GROUPS: SaudizationBy[] = ["establishment", "band", "branch", "department", "job_title"];

/** Nitaqat per establishment (Phase 5 task 4, #105): the band judged on the average of the last weeks, each band's
 * line at this size, the margins in people and the weekly trend. Counts only; who counts how much opens on request and
 * lists only the people whose personal data and salary the user may see. */
export function NitaqatTab() {
  const { t } = useTranslation();
  const scope = useScopeKey();
  const { can } = useSession();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ["nitaqat", ...scope], queryFn: nitaqatApi.list });
  const activities = useQuery({ queryKey: ["nitaqat-activities", ...scope], queryFn: complianceSettings.activities });
  const refresh = useMutation({ mutationFn: nitaqatApi.refresh, onSuccess: (data) => queryClient.setQueryData(["nitaqat", ...scope], data) });
  const [people, setPeople] = useState<NitaqatRow | null>(null);
  const [simulating, setSimulating] = useState<NitaqatRow | null>(null);
  const errors = apiErrors(list.error ?? refresh.error, t("common.loadFailed"));
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{t("nitaqat.intro")}</p>
        {can("compliance.manage") && (
          <Button size="sm" variant="outline" icon={<RefreshCw className="size-4" />} disabled={refresh.isPending} onClick={() => refresh.mutate()}>
            {t("nitaqat.refresh")}
          </Button>
        )}
      </div>
      {(list.isError || refresh.isError) && <Alert>{errors.fields.detail ?? errors.general}</Alert>}
      {list.isPending && <p className="text-sm text-muted">{t("common.loading")}</p>}
      {list.data?.establishments.map((row) => (
        <EstablishmentCard key={row.establishment.id} row={row} activity={activities.data?.find((a) => a.id === row.establishment.activity)} onPeople={() => setPeople(row)} onSimulate={() => setSimulating(row)} />
      ))}
      {people && <PeopleDialog row={people} onClose={() => setPeople(null)} />}
      {simulating && <SimulationDialog row={simulating} onClose={() => setSimulating(null)} />}
    </div>
  );
}

function EstablishmentCard({ row, activity, onPeople, onSimulate }: { row: NitaqatRow; activity?: { code: string; name_ar: string; name_en: string }; onPeople: () => void; onSimulate: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const s = row.snapshot;
  const number = row.establishment.number || t("establishments.noNumber");
  const title = <Trans i18nKey="nitaqat.cardTitle" values={{ number }} components={{ n: <bdi dir="ltr" /> }} />;
  const percent = s?.percent != null ? Number(s.percent) : null;
  return (
    <Card
      variant="solid"
      title={title}
      subtitle={[row.establishment.is_main ? t("establishments.main") : t("establishments.ownNumber"), activity ? `${activity.code} · ${format.name(activity)}` : t("establishments.noActivity"), s && t("nitaqat.asOf", { day: format.date(s.day) })].filter(Boolean).join(" · ")}
      action={
        s && (
          <span className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" icon={<Calculator className="size-4" />} onClick={onSimulate}>
              {t("nitaqat.simulate")}
            </Button>
            <Button size="sm" variant="ghost" icon={<Users className="size-4" />} onClick={onPeople}>
              {t("nitaqat.whoCounts")}
            </Button>
          </span>
        )
      }
    >
      {!s ? (
        <p className="text-sm text-muted">{t("nitaqat.noSnapshot")}</p>
      ) : (
        <div className="flex flex-col gap-5">
          {s.problem && <Alert tone="warning">{s.problem_text}</Alert>}
          <div className="grid gap-6 lg:grid-cols-[auto_1fr_1fr]">
            <div className="flex flex-col items-center gap-3">
              <DonutGauge value={percent ?? 0} label={t("nitaqat.gaugeLabel", { number, percent: percent != null ? format.number(percent, [0, 2]) : "—" })}>
                <span className="num text-2xl font-semibold">{percent != null ? `${format.number(percent, [0, 2])}%` : "—"}</span>
              </DonutGauge>
              {s.band ? <Pill tone={BAND_TONES[s.band]}>{t(`nitaqat.bands.${s.band}`)}</Pill> : <Pill tone="neutral">{t("nitaqat.noBand")}</Pill>}
              <p className="text-center text-xs text-muted">{t("nitaqat.weeks", { count: s.weeks })}</p>
            </div>
            <dl className="grid grid-cols-2 content-start gap-x-4 gap-y-3 text-sm">
              <Fact label={t("nitaqat.headcount")} value={format.number(s.headcount)} />
              <Fact label={t("nitaqat.nonSaudis")} value={format.number(s.non_saudis)} />
              <Fact label={t("nitaqat.saudisWeighted")} value={format.number(s.saudis, [0, 2])} />
              <Fact label={t("nitaqat.totalWeighted")} value={format.number(s.total, [0, 2])} />
              <Fact label={t("nitaqat.averageSaudis")} value={format.number(s.average_saudis, [0, 2])} />
              <Fact label={t("nitaqat.averageTotal")} value={format.number(s.average_total, [0, 2])} />
              {Number(s.capped_out) > 0 && <Fact label={t("nitaqat.cappedOut")} value={format.number(s.capped_out, [0, 2])} />}
            </dl>
            <div className="flex flex-col gap-3 text-sm">
              <h4 className="font-medium">{t("nitaqat.lines")}</h4>
              <ul className="flex flex-col gap-1">
                {BANDS.filter((b) => s.minimums[b] !== undefined).map((b) => (
                  <li key={b} className="flex items-center justify-between gap-3">
                    <span className={s.band === b ? "font-semibold" : undefined}>{t(`nitaqat.bands.${b}`)}</span>
                    <span className="num">{format.number(s.minimums[b]!, [0, 2])}%</span>
                  </li>
                ))}
                {!Object.keys(s.minimums).length && <li className="text-muted">{t("nitaqat.noLines")}</li>}
              </ul>
              {s.band && (
                <ul className="flex flex-col gap-1 border-t border-line pt-3">
                  {s.saudis_to_next != null && <li>{t("nitaqat.toNext", { count: s.saudis_to_next })}</li>}
                  {s.non_saudis_room != null && <li>{t("nitaqat.room", { count: s.non_saudis_room })}</li>}
                  {s.saudis_to_lose != null && <li>{t("nitaqat.lose", { count: s.saudis_to_lose })}</li>}
                </ul>
              )}
            </div>
          </div>
          {row.trend.length > 1 && (
            <TrendChart
              label={t("nitaqat.trend", { number })}
              primaryLabel={t("nitaqat.percent")}
              height={200}
              data={row.trend.map((p) => ({ label: format.date(p.day, "dayMonth"), primary: p.percent != null ? Number(p.percent) : 0 }))}
            />
          )}
        </div>
      )}
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="num font-medium">{value}</dd>
    </div>
  );
}

export function reasonLabel(t: (key: string) => string, code: string) {
  if (code.startsWith("equivalent:")) return t(`establishments.equivalents.${code.split(":")[1]}`);
  return t(`nitaqat.reasons.${code}`);
}

function PeopleDialog({ row, onClose }: { row: NitaqatRow; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const found = useQuery({ queryKey: ["nitaqat-people", row.establishment.id], queryFn: () => nitaqatApi.people(row.establishment.id) });
  const columns: Column<NitaqatPerson>[] = [
    { id: "who", header: t("compliance.employee"), cell: (p) => <PersonCell name={format.name(p)} subtitle={p.employee_no} /> },
    { id: "saudi", header: t("nitaqat.asSaudi"), cell: (p) => <span className="num">{format.number(p.saudi, [0, 4])}</span>, className: "w-24" },
    { id: "total", header: t("nitaqat.inTotal"), cell: (p) => <span className="num">{format.number(p.total, [0, 4])}</span>, className: "w-24" },
    {
      id: "why",
      header: t("nitaqat.why"),
      cell: (p) => (
        <span className="flex flex-wrap gap-1">
          {p.reasons.map((r) => (
            <Pill key={r} tone={r === "non_saudi" ? "neutral" : r.startsWith("no_") || r === "undocumented" || r === "low_wage" ? "salmon" : "teal"}>
              {reasonLabel(t, r)}
            </Pill>
          ))}
          {p.capped && <Pill tone="lavender">{t("nitaqat.capped")}</Pill>}
        </span>
      ),
    },
  ];
  const errors = apiErrors(found.error, t("common.loadFailed"));
  return (
    <Dialog open onClose={onClose} size="lg" title={<Trans i18nKey="nitaqat.whoCountsIn" values={{ number: row.establishment.number || t("establishments.noNumber") }} components={{ n: <bdi dir="ltr" /> }} />}>
      <div className="flex flex-col gap-3">
        {found.isError && <Alert>{errors.fields.detail ?? errors.general}</Alert>}
        {found.data && found.data.hidden > 0 && <Alert tone="info">{t("nitaqat.hidden", { count: found.data.hidden })}</Alert>}
        <DataTable caption={t("nitaqat.whoCounts")} columns={columns} rows={found.data?.rows ?? []} rowKey={(p) => String(p.employee)} loading={found.isPending} empty={t("nitaqat.nobodyShown")} minWidth={640} />
      </div>
    </Dialog>
  );
}

/** The Saudization report (#136): Saudis and non-Saudis by headcount and as Nitaqat weighs them, by establishment,
 * band, branch, department or job title; Excel with compliance.export (audited). */
export function SaudizationTab() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const { can } = useSession();
  const [by, setBy] = useState<SaudizationBy>("establishment");
  const report = useQuery({ queryKey: ["saudization", by, ...scope], queryFn: () => nitaqatApi.saudization(by) });
  const exporting = useMutation({ mutationFn: async () => saveFile(await nitaqatApi.exportSaudization(by)) });
  const pct = (v: string | null) => (v != null ? `${format.number(v, [0, 2])}%` : "—");
  const columns: Column<SaudizationRow>[] = [
    { id: "label", header: t(`saudization.groups.${by}`), cell: (r) => <span className="font-medium">{by === "band" && r.key !== "-" ? t(`nitaqat.bands.${r.key}`) : r.label}</span> },
    { id: "saudis", header: t("saudization.saudis"), cell: (r) => <span className="num">{format.number(r.saudis)}</span>, className: "w-24" },
    { id: "non", header: t("saudization.nonSaudis"), cell: (r) => <span className="num">{format.number(r.non_saudis)}</span>, className: "w-28" },
    { id: "headcount", header: t("saudization.headcount"), cell: (r) => <span className="num">{format.number(r.headcount)}</span>, className: "w-24" },
    { id: "weighted", header: t("saudization.weighted"), cell: (r) => <bdi dir="ltr" className="num">{`${format.number(r.saudis_weighted, [0, 2])} / ${format.number(r.total_weighted, [0, 2])}`}</bdi>, className: "w-36" },
    { id: "percent", header: t("saudization.percent"), cell: (r) => <span className="num font-medium">{pct(r.percent)}</span>, className: "w-28" },
  ];
  const totals = report.data?.totals;
  const errors = apiErrors(report.error ?? exporting.error, t("common.loadFailed"));
  return (
    <Card
      variant="solid"
      title={t("saudization.title")}
      subtitle={t("saudization.hint")}
      action={
        can("compliance.export") && (
          <Button size="sm" variant="outline" icon={<FileDown className="size-4" />} disabled={exporting.isPending || !report.data} onClick={() => exporting.mutate()}>
            {t("saudization.export")}
          </Button>
        )
      }
    >
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <FormSelect label={t("saudization.by")} name="by" value={by} onChange={(e) => setBy(e.target.value as SaudizationBy)} options={GROUPS.map((g) => ({ value: g, label: t(`saudization.groups.${g}`) }))} className="w-full sm:w-56" />
      </div>
      {(report.isError || exporting.isError) && <Alert className="mb-3">{errors.fields.detail ?? errors.general}</Alert>}
      <DataTable caption={t("saudization.title")} columns={columns} rows={report.data?.rows ?? []} rowKey={(r) => String(r.key)} loading={report.isPending} empty={t("saudization.empty")} minWidth={760} />
      {totals && report.data!.rows.length > 0 && (
        <p className="num mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span className="font-medium">{t("saudization.total")}</span>
          <span>{t("saudization.totalSaudis", { count: totals.saudis })}</span>
          <span>{t("saudization.totalNon", { count: totals.non_saudis })}</span>
          <span>{t("saudization.totalPercent", { percent: pct(totals.percent) })}</span>
        </p>
      )}
    </Card>
  );
}
