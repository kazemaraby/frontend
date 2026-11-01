import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Trans, useTranslation } from "react-i18next";

import { type CompliancePerson, establishmentsApi, type NitaqatRow, type SimulatedAssessment, type SimulatedHire, simulationApi, type SimulationResult } from "@/api/compliance";
import { useScopeKey } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Dialog } from "@/design/Dialog";
import { CheckField, FormSelect, TextField } from "@/design/Field";
import { Pill } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

import { BAND_TONES } from "./NitaqatTab";

type Named = { person: CompliancePerson; wage?: string };
const NEW_HIRE: SimulatedHire = { count: 1, saudi: true, wage: "", part_time: false, student: false };

/** Nitaqat simulation (Phase 5 task 5, #111): hires, people leaving and wage changes, and the band before and after —
 * on the average Nitaqat applies and on the day alone (where the average is heading). Nothing is saved. */
export function SimulationDialog({ row, onClose }: { row: NitaqatRow; onClose: () => void }) {
  const { t } = useTranslation();
  const [hires, setHires] = useState<SimulatedHire[]>([{ ...NEW_HIRE }]);
  const [leaving, setLeaving] = useState<Named[]>([]);
  const [wages, setWages] = useState<Named[]>([]);
  const number = row.establishment.number || t("establishments.noNumber");
  const run = useMutation({
    mutationFn: () =>
      simulationApi.run(row.establishment.id, {
        hire: hires.filter((h) => h.count > 0).map((h) => ({ ...h, wage: h.wage || null })),
        leave: leaving.map((n) => n.person.id),
        wages: wages.filter((n) => n.wage).map((n) => ({ employee: n.person.id, wage: n.wage! })),
      }),
  });
  const errors = apiErrors(run.error, t("common.loadFailed"));
  const setHire = (i: number, patch: Partial<SimulatedHire>) => setHires(hires.map((h, j) => (j === i ? { ...h, ...patch } : h)));
  const chosen = new Set([...leaving, ...wages].map((n) => n.person.id));
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={<Trans i18nKey="simulation.title" values={{ number }} components={{ n: <bdi dir="ltr" /> }} />}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.close")}
          </Button>
          <Button disabled={run.isPending} onClick={() => run.mutate()}>
            {t("simulation.run")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Alert tone="info">{t("simulation.nothingSaved")}</Alert>
        <section className="flex flex-col gap-3" aria-label={t("simulation.hires")}>
          <h3 className="font-medium">{t("simulation.hires")}</h3>
          {hires.map((h, i) => (
            <div key={i} className="grid items-end gap-3 sm:grid-cols-[6rem_10rem_9rem_auto_auto_auto] [&_label]:whitespace-nowrap">
              <TextField label={t("simulation.count")} name={`count-${i}`} type="number" min={1} max={500} dir="ltr" value={String(h.count)} onChange={(e) => setHire(i, { count: Number(e.target.value) || 0 })} />
              <FormSelect label={t("simulation.nationality")} name={`saudi-${i}`} value={h.saudi ? "saudi" : "other"} onChange={(e) => setHire(i, { saudi: e.target.value === "saudi" })} options={[{ value: "saudi", label: t("simulation.saudi") }, { value: "other", label: t("simulation.nonSaudi") }]} />
              <TextField label={t("simulation.wage")} name={`wage-${i}`} type="number" min={0} inputMode="decimal" dir="ltr" value={h.wage ?? ""} onChange={(e) => setHire(i, { wage: e.target.value })} />
              <CheckField label={t("simulation.partTime")} checked={h.part_time} onChange={(e) => setHire(i, { part_time: e.target.checked })} />
              <CheckField label={t("simulation.student")} checked={h.student} onChange={(e) => setHire(i, { student: e.target.checked })} />
              <IconButton size="sm" variant="plain" label={t("simulation.removeHire")} icon={<Trash2 />} onClick={() => setHires(hires.filter((_h, j) => j !== i))} />
            </div>
          ))}
          <div>
            <Button size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={() => setHires([...hires, { ...NEW_HIRE }])}>
              {t("simulation.addHire")}
            </Button>
          </div>
        </section>
        <PeoplePicker title={t("simulation.leaving")} establishment={row.establishment.id} exclude={chosen} named={leaving} onChange={setLeaving} />
        <PeoplePicker title={t("simulation.wageChanges")} establishment={row.establishment.id} exclude={chosen} named={wages} onChange={setWages} withWage />
        {run.isError && <Alert>{errors.fields.detail ?? errors.general}</Alert>}
        {run.data && <Result data={run.data} />}
      </div>
    </Dialog>
  );
}

function PeoplePicker({ title, establishment, exclude, named, onChange, withWage }: { title: string; establishment: number; exclude: Set<number>; named: Named[]; onChange: (next: Named[]) => void; withWage?: boolean }) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const [search, setSearch] = useState("");
  const found = useQuery({
    queryKey: ["simulation-people", establishment, search, ...scope],
    queryFn: () => establishmentsApi.people({ establishment, search: search || undefined }),
    placeholderData: keepPreviousData,
    enabled: search.length > 0,
  });
  const options = (found.data?.results ?? []).filter((p) => !exclude.has(p.id));
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <h3 className="font-medium">{title}</h3>
      <div className="grid items-end gap-3 sm:grid-cols-2">
        <TextField label={t("compliance.findEmployee")} type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
        <FormSelect
          label={t("compliance.employee")}
          name={withWage ? "wage-employee" : "leaving-employee"}
          value=""
          placeholder={t("common.choose")}
          onChange={(e) => {
            const person = options.find((p) => String(p.id) === e.target.value);
            if (person) onChange([...named, { person, wage: withWage ? "" : undefined }]);
          }}
          options={options.map((p) => ({ value: String(p.id), label: `${format.name(p)} · ${p.employee_no}` }))}
        />
      </div>
      {named.length > 0 && (
        <ul className="flex flex-col gap-2">
          {named.map((n, i) => (
            <li key={n.person.id} className="flex flex-wrap items-end gap-3">
              <span className="min-w-48 flex-1 text-sm">{`${format.name(n.person)} · ${n.person.employee_no}`}</span>
              {withWage && (
                <TextField
                  label={t("simulation.newWage")}
                  name={`new-wage-${n.person.id}`}
                  type="number"
                  min={0}
                  inputMode="decimal"
                  dir="ltr"
                  value={n.wage ?? ""}
                  onChange={(e) => onChange(named.map((m, j) => (j === i ? { ...m, wage: e.target.value } : m)))}
                  className="w-40"
                />
              )}
              <IconButton size="sm" variant="plain" label={t("simulation.removePerson", { name: format.name(n.person) })} icon={<Trash2 />} onClick={() => onChange(named.filter((_m, j) => j !== i))} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Result({ data }: { data: SimulationResult }) {
  const { t } = useTranslation();
  const format = useFormat();
  const pct = (a: SimulatedAssessment) => (a.percent != null ? `${format.number(a.percent, [0, 2])}%` : "—");
  const band = (a: SimulatedAssessment) => (a.band ? <Pill tone={BAND_TONES[a.band]}>{t(`nitaqat.bands.${a.band}`)}</Pill> : <Pill tone="neutral">{t("nitaqat.noBand")}</Pill>);
  const count = (v: number | null) => (v == null ? "—" : format.number(v));
  const rows: [string, (a: SimulatedAssessment) => ReactNode][] = [
    [t("simulation.percent"), pct],
    [t("simulation.band"), band],
    [t("simulation.saudisTotal"), (a) => <bdi dir="ltr">{`${format.number(a.saudis, [0, 2])} / ${format.number(a.total, [0, 2])}`}</bdi>],
    [t("simulation.toNext"), (a) => count(a.saudis_to_next)],
    [t("simulation.room"), (a) => count(a.non_saudis_room)],
    [t("simulation.lose"), (a) => count(a.saudis_to_lose)],
  ];
  return (
    <section className="flex flex-col gap-3" aria-label={t("simulation.result")}>
      <h3 className="font-medium">{t("simulation.result")}</h3>
      {!data.thresholds && <Alert tone="warning">{t("simulation.noThresholds")}</Alert>}
      <table className="w-full text-sm">
        <caption className="sr-only">{t("simulation.result")}</caption>
        <thead>
          <tr className="text-muted">
            <th scope="col" className="py-2 text-start font-normal" />
            <th scope="col" className="py-2 text-start font-normal">{t("simulation.before", { count: data.before.headcount })}</th>
            <th scope="col" className="py-2 text-start font-normal">{t("simulation.after", { count: data.after.headcount })}</th>
            <th scope="col" className="py-2 text-start font-normal">{t("simulation.spot")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, cell]) => (
            <tr key={label} className="border-t border-line">
              <th scope="row" className="py-2 text-start font-medium">{label}</th>
              <td className="num py-2">{cell(data.before.average)}</td>
              <td className="num py-2">{cell(data.after.average)}</td>
              <td className="num py-2">{cell(data.after.spot)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted">{t("simulation.explain", { count: data.weeks })}</p>
    </section>
  );
}
