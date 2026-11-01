import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { type Grade, hr, type JobTitle } from "@/api/hr";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { Dialog } from "@/design/Dialog";
import { CheckField, TextField } from "@/design/Field";
import { Money } from "@/design/Money";
import { Pill } from "@/design/Pill";
import { Tabs } from "@/design/Tabs";
import { Page } from "@/layout/Page";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

type Kind = "job-titles" | "grades";
type Row = (JobTitle | Grade) & { id: number };
type Field = { key: string; label: string; ltr?: boolean; money?: boolean; numeric?: boolean };

/** /settings/master-data — job titles (tenant-wide, with the Qiwa / GOSI occupation code) and grades (per company,
 * with a salary band) (#36). A record in use can't be deleted: deactivate it instead. */
export default function MasterDataPage() {
  const { t } = useTranslation();
  const format = useFormat();
  const { can } = useSession();
  const scopeKey = useScopeKey();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const kind: Kind = params.get("tab") === "grades" ? "grades" : "job-titles";
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const rows = useQuery({
    queryKey: ["master", kind === "grades" ? "grades" : "job-titles", ...(kind === "grades" ? scopeKey : [])],
    queryFn: async () => ((kind === "grades" ? await hr.grades() : await hr.jobTitles()).results as Row[]),
  });
  const remove = useMutation({
    mutationFn: (row: Row) => (kind === "grades" ? hr.deleteGrade(row.id) : hr.deleteJobTitle(row.id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["master"] }),
  });
  const removeError = remove.error ? apiErrors(remove.error, t("common.saveFailed")).general : null;

  const salary = can("employees.view_salary");
  const fields: Field[] =
    kind === "grades"
      ? [
          { key: "code", label: t("master.code"), ltr: true },
          { key: "name_ar", label: t("master.name_ar") },
          { key: "name_en", label: t("master.name_en"), ltr: true },
          { key: "rank", label: t("master.rank"), numeric: true },
          ...(salary ? [{ key: "min_salary", label: t("master.min_salary"), money: true }, { key: "max_salary", label: t("master.max_salary"), money: true }] : []),
        ]
      : [
          { key: "code", label: t("master.code"), ltr: true },
          { key: "name_ar", label: t("master.name_ar") },
          { key: "name_en", label: t("master.name_en"), ltr: true },
          { key: "occupation_code", label: t("master.occupation_code"), ltr: true },
        ];
  const columns: Column<Row>[] = [
    { id: "name", header: t("master.name"), cell: (r) => <span className="font-medium">{format.name(r)}</span> },
    { id: "code", header: t("master.code"), cell: (r) => <span className="num">{r.code}</span> },
    ...(kind === "grades"
      ? [
          { id: "rank", header: t("master.rank"), cell: (r: Row) => <span className="num">{(r as Grade).rank}</span> },
          ...(salary
            ? [
                {
                  id: "band",
                  header: t("master.band"),
                  cell: (r: Row) => {
                    const g = r as Grade;
                    return g.min_salary || g.max_salary ? (
                      <span className="flex items-center gap-1">
                        {g.min_salary ? <Money amount={g.min_salary} /> : "—"} – {g.max_salary ? <Money amount={g.max_salary} /> : "—"}
                      </span>
                    ) : (
                      "—"
                    );
                  },
                },
              ]
            : []),
        ]
      : [{ id: "occupation", header: t("master.occupation_code"), cell: (r: Row) => <span className="num">{(r as JobTitle).occupation_code || "—"}</span> }]),
    { id: "active", header: t("master.status"), cell: (r) => <Pill tone={r.is_active ? "green" : "neutral"}>{r.is_active ? t("master.active") : t("master.inactive")}</Pill> },
  ];

  return (
    <Page
      title={t("master.title")}
      tabs={
        <Tabs
          label={t("master.title")}
          value={kind}
          onChange={(k) => setParams(k === "job-titles" ? {} : { tab: k })}
          items={[
            { id: "job-titles", label: t("master.jobTitles") },
            { id: "grades", label: t("master.grades") },
          ]}
        />
      }
      actions={
        <Button variant="accent" icon={<Plus className="size-[18px]" />} onClick={() => setEditing("new")}>
          {t("setup.add")}
        </Button>
      }
    >
      <Card>
        {kind === "grades" && <p className="mb-3 text-sm text-muted">{t("master.gradesNote")}</p>}
        {removeError && <Alert className="mb-3">{removeError}</Alert>}
        <DataTable
          caption={kind === "grades" ? t("master.grades") : t("master.jobTitles")}
          columns={columns}
          rows={rows.data ?? []}
          rowKey={(r) => String(r.id)}
          rowLabel={(r) => format.name(r)}
          loading={rows.isPending}
          onEdit={(r) => setEditing(r)}
          onDelete={(r) => remove.mutate(r)}
          minWidth={720}
        />
      </Card>
      {editing && <RecordDialog kind={kind} fields={fields} row={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </Page>
  );
}

function RecordDialog({ kind, fields, row, onClose }: { kind: Kind; fields: Field[]; row: Row | null; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, row ? String((row as Record<string, unknown>)[f.key] ?? "") : ""])),
  );
  const [active, setActive] = useState(row?.is_active ?? true);
  const save = useMutation({
    mutationFn: async (): Promise<unknown> => {
      const body: Record<string, unknown> = { is_active: active };
      for (const f of fields) {
        const v = values[f.key].trim();
        body[f.key] = v === "" ? (f.money ? null : "") : f.numeric ? Number(v) : v;
      }
      return kind === "grades" ? hr.saveGrade(body as Partial<Grade>, row?.id) : hr.saveJobTitle(body as Partial<JobTitle>, row?.id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["master"] });
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      onClose={onClose}
      title={row ? t("common.edit") : t("setup.add")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={save.isPending || !values.name_ar?.trim() || !values.code?.trim()} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <TextField
            key={f.key}
            label={f.label}
            dir={f.ltr || f.money || f.numeric ? "ltr" : undefined}
            inputMode={f.money ? "decimal" : f.numeric ? "numeric" : undefined}
            value={values[f.key]}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            error={errors.fields[f.key]}
          />
        ))}
        <CheckField label={t("master.active")} checked={active} onChange={(e) => setActive(e.target.checked)} />
      </div>
      {errors.general && <Alert className="mt-4">{errors.general}</Alert>}
    </Dialog>
  );
}
