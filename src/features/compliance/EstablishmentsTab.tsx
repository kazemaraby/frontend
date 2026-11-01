import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { complianceSettings, type CompliancePerson, type Establishment, establishmentsApi, type PersonFacts, type SaudiEquivalent } from "@/api/compliance";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable, PersonCell } from "@/design/DataTable";
import { Dialog } from "@/design/Dialog";
import { CheckField, FormSelect, SearchInput, TextField } from "@/design/Field";
import { Money } from "@/design/Money";
import { Pagination } from "@/design/Pagination";
import { Pill } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

const PAGE_SIZE = 25;
const EQUIVALENTS: Exclude<SaudiEquivalent, "">[] = ["saudi_spouse", "saudi_mother", "displaced_tribes"];

/** Establishments (Phase 5 task 2, decision 1): the company under its MHRSD number and each other number a branch
 * carries, with the Nitaqat activity each is measured against. */
export function EstablishmentsTab() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const { can } = useSession();
  const rows = useQuery({ queryKey: ["establishments", ...scope], queryFn: establishmentsApi.list });
  const activities = useQuery({ queryKey: ["nitaqat-activities", ...scope], queryFn: complianceSettings.activities });
  const [editing, setEditing] = useState<Establishment | null>(null);
  const activity = (id: number | null) => activities.data?.find((a) => a.id === id);
  const columns: Column<Establishment>[] = [
    {
      id: "number",
      header: t("establishments.number"),
      cell: (e) => (
        <span className="flex flex-col">
          <span dir="ltr" className="num font-medium">{e.number || t("establishments.noNumber")}</span>
          <span className="text-xs text-muted">{e.is_main ? t("establishments.main") : t("establishments.ownNumber")}</span>
        </span>
      ),
      className: "w-48",
    },
    { id: "branches", header: t("establishments.branches"), cell: (e) => <span className="text-sm">{e.branches.map((b) => format.name(b)).join(t("common.listSeparator")) || "—"}</span> },
    {
      id: "activity",
      header: t("establishments.activity"),
      cell: (e) => {
        const found = activity(e.activity);
        return found ? <span className="text-sm">{`${found.code} · ${format.name(found)}`}</span> : <Pill tone="amber">{t("establishments.noActivity")}</Pill>;
      },
    },
    { id: "headcount", header: t("establishments.headcount"), cell: (e) => <span className="num">{format.number(e.headcount)}</span>, className: "w-28" },
    {
      id: "actions",
      header: <span className="sr-only">{t("common.actions")}</span>,
      cell: (e) => can("compliance.manage") && <IconButton size="sm" variant="plain" label={t("establishments.edit", { number: e.number || t("establishments.noNumber") })} icon={<Pencil />} onClick={() => setEditing(e)} />,
    },
  ];
  return (
    <Card variant="solid" title={t("establishments.title")} subtitle={t("establishments.hint")}>
      <DataTable caption={t("establishments.title")} columns={columns} rows={rows.data ?? []} rowKey={(e) => String(e.id)} loading={rows.isPending} minWidth={760} />
      {editing && <EstablishmentDialog establishment={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function EstablishmentDialog({ establishment, onClose }: { establishment: Establishment; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const queryClient = useQueryClient();
  const activities = useQuery({ queryKey: ["nitaqat-activities", ...scope], queryFn: complianceSettings.activities });
  const [activity, setActivity] = useState(establishment.activity ? String(establishment.activity) : "");
  const [note, setNote] = useState(establishment.note);
  const [industrial, setIndustrial] = useState(establishment.is_industrial);
  const save = useMutation({
    mutationFn: () => establishmentsApi.save(establishment.id, { activity: activity ? Number(activity) : null, is_industrial: industrial, note }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["establishments"] });
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const options = (activities.data ?? []).filter((a) => a.is_active || a.id === establishment.activity);
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("establishments.edit", { number: establishment.number || t("establishments.noNumber") })}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <FormSelect
          label={t("establishments.activity")}
          name="activity"
          value={activity}
          placeholder={t("common.choose")}
          onChange={(e) => setActivity(e.target.value)}
          options={options.map((a) => ({ value: String(a.id), label: `${a.code} · ${format.name(a)}` }))}
          hint={options.length ? undefined : t("establishments.noActivities")}
          error={errors.fields.activity}
        />
        <CheckField label={t("establishments.industrial")} checked={industrial} onChange={(e) => setIndustrial(e.target.checked)} />
        <TextField label={t("establishments.note")} name="note" value={note} onChange={(e) => setNote(e.target.value)} error={errors.fields.note} />
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

/** Each employee as Nitaqat will see them. The nationality and personal facts show only with access to the person's
 * personal data, the counting wage (basic + housing) only with salary access: the API leaves out what isn't allowed. */
export function PeopleTab() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const { can } = useSession();
  const establishments = useQuery({ queryKey: ["establishments", ...scope], queryFn: establishmentsApi.list });
  const [establishment, setEstablishment] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const people = useQuery({
    queryKey: ["compliance-people", establishment, search, page, ...scope],
    queryFn: () => establishmentsApi.people({ establishment: establishment ? Number(establishment) : undefined, search: search || undefined, page }),
    placeholderData: keepPreviousData,
  });
  const [editing, setEditing] = useState<CompliancePerson | null>(null);
  const columns: Column<CompliancePerson>[] = [
    { id: "who", header: t("compliance.employee"), cell: (p) => <PersonCell name={format.name(p)} subtitle={p.employee_no} /> },
    {
      id: "establishment",
      header: t("establishments.establishment"),
      cell: (p) => (
        <span className="flex flex-col text-sm">
          <span dir="ltr" className="num">{p.establishment || t("establishments.noNumber")}</span>
          {p.branch_name && <span className="text-xs text-muted">{format.pick(p.branch_name)}</span>}
        </span>
      ),
      className: "w-44",
    },
    { id: "nationality", header: t("establishments.nationality"), cell: (p) => (p.nationality === undefined ? <span className="text-muted">•••</span> : <span className="text-sm">{p.nationality ? format.name(p.nationality) : "—"}</span>), className: "w-32" },
    { id: "wage", header: t("establishments.countingWage"), cell: (p) => (p.counting_wage === undefined ? <span className="text-muted">•••</span> : p.counting_wage ? <Money amount={p.counting_wage} /> : "—"), className: "w-36" },
    {
      id: "facts",
      header: t("establishments.facts"),
      cell: (p) => {
        const facts = [
          p.employment_type === "part_time" && t("establishments.partTime"),
          p.saudi_equivalent && t(`establishments.equivalents.${p.saudi_equivalent}`),
          p.is_student && t("establishments.student"),
          p.is_flexible && (p.flexible_hours ? t("establishments.flexibleHours", { hours: format.number(p.flexible_hours) }) : t("establishments.flexible")),
          p.is_owner && t("establishments.owner"),
        ].filter(Boolean) as string[];
        return facts.length ? (
          <span className="flex flex-wrap gap-1">
            {facts.map((f) => (
              <Pill key={f} tone="lavender">
                {f}
              </Pill>
            ))}
          </span>
        ) : (
          <span className="text-muted">—</span>
        );
      },
    },
    {
      id: "actions",
      header: <span className="sr-only">{t("common.actions")}</span>,
      cell: (p) => can("compliance.manage") && <IconButton size="sm" variant="plain" label={t("establishments.editPerson", { name: format.name(p) })} icon={<Pencil />} onClick={() => setEditing(p)} />,
    },
  ];
  return (
    <Card variant="solid" title={t("establishments.peopleTitle")} subtitle={t("establishments.peopleHint")}>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <FormSelect
          label={t("establishments.establishment")}
          name="establishment"
          value={establishment}
          onChange={(e) => {
            setEstablishment(e.target.value);
            setPage(1);
          }}
          options={[{ value: "", label: t("compliance.all") }, ...(establishments.data ?? []).map((e) => ({ value: String(e.id), label: e.number || t("establishments.noNumber") }))]}
          className="w-full sm:w-56"
        />
        <SearchInput
          label={t("common.search")}
          placeholder={t("common.searchPlaceholder")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full sm:w-72"
        />
      </div>
      <DataTable caption={t("establishments.peopleTitle")} columns={columns} rows={people.data?.results ?? []} rowKey={(p) => String(p.id)} loading={people.isPending} empty={t("establishments.noPeople")} minWidth={960} />
      {(people.data?.count ?? 0) > PAGE_SIZE && <Pagination page={page} pageCount={Math.ceil((people.data?.count ?? 0) / PAGE_SIZE)} onPageChange={setPage} />}
      {editing && <PersonDialog person={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function PersonDialog({ person, onClose }: { person: CompliancePerson; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const personal = person.is_student !== undefined; // the API sent the personal facts: they may be changed too
  const [v, setV] = useState({
    saudi_equivalent: person.saudi_equivalent ?? "",
    is_student: person.is_student ?? false,
    is_flexible: person.is_flexible,
    flexible_hours: person.flexible_hours ?? "",
    is_owner: person.is_owner,
  });
  const save = useMutation({
    mutationFn: () => {
      const body: PersonFacts = { is_flexible: v.is_flexible, flexible_hours: v.is_flexible && v.flexible_hours ? v.flexible_hours : null, is_owner: v.is_owner };
      if (personal) Object.assign(body, { saudi_equivalent: v.saudi_equivalent, is_student: v.is_student });
      return establishmentsApi.savePerson(person.id, body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["compliance-people"] });
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("establishments.editPerson", { name: format.name(person) })}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {personal ? (
          <>
            <FormSelect
              label={t("establishments.equivalent")}
              name="saudi_equivalent"
              value={v.saudi_equivalent}
              onChange={(e) => setV({ ...v, saudi_equivalent: e.target.value as SaudiEquivalent })}
              options={[{ value: "", label: t("establishments.equivalentNone") }, ...EQUIVALENTS.map((k) => ({ value: k, label: t(`establishments.equivalents.${k}`) }))]}
              hint={t("establishments.equivalentHint")}
              error={errors.fields.saudi_equivalent}
            />
            <CheckField label={t("establishments.student")} checked={v.is_student} onChange={(e) => setV({ ...v, is_student: e.target.checked })} />
          </>
        ) : (
          <p className="text-sm text-muted">{t("establishments.personalHidden")}</p>
        )}
        <CheckField label={t("establishments.flexible")} checked={v.is_flexible} onChange={(e) => setV({ ...v, is_flexible: e.target.checked })} />
        {v.is_flexible && <TextField label={t("establishments.hoursField")} name="flexible_hours" type="number" inputMode="decimal" min={0} dir="ltr" value={v.flexible_hours} onChange={(e) => setV({ ...v, flexible_hours: e.target.value })} error={errors.fields.flexible_hours} />}
        <CheckField label={t("establishments.owner")} checked={v.is_owner} onChange={(e) => setV({ ...v, is_owner: e.target.checked })} />
        {(errors.fields.detail || errors.general) && <Alert>{errors.fields.detail ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
