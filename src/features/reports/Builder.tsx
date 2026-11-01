import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type Aggregate, builderApi, type BuilderField, type BuilderFilter, type BuilderResult, type Definition, exportsApi, type SavedReport } from "@/api/reports";
import { useScopeKey } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { CheckField, FormSelect, TextField } from "@/design/Field";
import { Money } from "@/design/Money";
import { Tabs } from "@/design/Tabs";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

import { ExportButtons } from "./ExportButtons";

type Mode = "list" | "totals";
const EMPTY: Definition = { dataset: "", columns: [], filters: [], group_by: [], aggregates: [] };
const FNS = ["count", "sum", "avg", "min", "max"] as const;

/** The custom report builder (task 18, #138): a curated dataset, only the fields the user may see, filters by the
 * field's type, a list or totals by group; saved reports download and schedule like the others. The server checks
 * everything again (apps/reports/builder.py). */
export function BuilderCard() {
  const { t } = useTranslation();
  const scope = useScopeKey();
  const queryClient = useQueryClient();
  const meta = useQuery({ queryKey: ["report-builder", ...scope], queryFn: builderApi.datasets });
  const saved = useQuery({ queryKey: ["saved-reports", ...scope], queryFn: builderApi.saved });
  const [def, setDef] = useState<Definition>(EMPTY);
  const [mode, setMode] = useState<Mode>("list");
  const [name, setName] = useState("");
  const [openId, setOpenId] = useState<number | undefined>(undefined);
  const dataset = meta.data?.datasets.find((d) => d.code === def.dataset);
  const fields = dataset?.fields ?? [];
  const body: Definition = mode === "list" ? { ...def, group_by: [], aggregates: [] } : { ...def, columns: [] };
  const preview = useMutation({ mutationFn: () => builderApi.preview(body) });
  const save = useMutation({
    mutationFn: () => builderApi.save({ id: openId, name, definition: body }),
    onSuccess: async (report) => {
      setOpenId(report.id);
      await queryClient.invalidateQueries({ queryKey: ["saved-reports"] });
      await queryClient.invalidateQueries({ queryKey: ["reports-catalog"] });
    },
  });
  const remove = useMutation({ mutationFn: (id: number) => builderApi.remove(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-reports"] }) });
  const errors = apiErrors(preview.error ?? save.error, t("common.loadFailed"));
  const firstError = Object.values(errors.fields)[0] ?? errors.general;
  const open = (report: SavedReport) => {
    setDef(report.definition);
    setMode(report.definition.group_by.length ? "totals" : "list");
    setName(report.name);
    setOpenId(report.id);
    preview.reset();
  };
  const toggleColumn = (key: string) => setDef({ ...def, columns: def.columns.includes(key) ? def.columns.filter((c) => c !== key) : [...def.columns, key] });

  return (
    <div className="flex flex-col gap-4">
      <Card title={t("builder.title")} subtitle={t("builder.subtitle", { count: meta.data?.min_group ?? 5 })}>
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormSelect label={t("builder.dataset")} name="dataset" placeholder={t("common.choose")} value={def.dataset} onChange={(e) => { setDef({ ...EMPTY, dataset: e.target.value }); setOpenId(undefined); preview.reset(); }} options={(meta.data?.datasets ?? []).map((d) => ({ value: d.code, label: d.title }))} />
            {dataset && <Tabs variant="segmented" label={t("builder.mode")} value={mode} onChange={setMode} className="self-end" items={[{ id: "list", label: t("builder.modes.list") }, { id: "totals", label: t("builder.modes.totals") }]} />}
          </div>
          {dataset && mode === "list" && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium text-ink">{t("builder.columns")}</legend>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {fields.map((f) => <CheckField key={f.key} label={f.label + (f.group ? ` · ${t(`builder.groups.${f.group}`)}` : "")} checked={def.columns.includes(f.key)} onChange={() => toggleColumn(f.key)} />)}
              </div>
            </fieldset>
          )}
          {dataset && mode === "totals" && <Totals fields={fields} def={def} onChange={setDef} />}
          {dataset && <Filters fields={fields} filters={def.filters} onChange={(filters) => setDef({ ...def, filters })} />}
          {dataset && (
            <div className="flex flex-wrap items-end gap-3">
              <Button variant="accent" disabled={preview.isPending} onClick={() => preview.mutate()}>{t("builder.preview")}</Button>
              <TextField className="w-64" label={t("builder.name")} name="report_name" value={name} onChange={(e) => setName(e.target.value)} />
              <Button variant="outline" disabled={save.isPending || !name.trim()} onClick={() => save.mutate()}>{openId ? t("builder.update") : t("builder.save")}</Button>
              {save.isSuccess && <span role="status" className="text-sm text-muted">{t("builder.saved")}</span>}
            </div>
          )}
          {firstError && (preview.isError || save.isError) && <Alert>{firstError}</Alert>}
        </div>
      </Card>
      {preview.data && <Results result={preview.data} />}
      <Card title={t("builder.savedTitle")}>
        {saved.data?.results.length ? (
          <ul className="flex flex-col gap-2">
            {saved.data.results.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-white px-4 py-3">
                <button type="button" className="cursor-pointer font-semibold text-ink hover:underline" onClick={() => open(r)}>{r.name}</button>
                <span className="flex items-center gap-2">
                  <ExportButtons download={(as) => exportsApi.run(r.code, as)} />
                  <IconButton size="sm" variant="danger" icon={<Trash2 />} label={t("common.deleteNamed", { name: r.name })} onClick={() => remove.mutate(r.id)} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">{t("builder.noneSaved")}</p>
        )}
      </Card>
    </div>
  );
}

function Totals({ fields, def, onChange }: { fields: BuilderField[]; def: Definition; onChange: (d: Definition) => void }) {
  const { t } = useTranslation();
  const groupable = fields.filter((f) => f.kind !== "money");
  const numeric = fields.filter((f) => f.kind === "number" || f.kind === "money");
  const setAggregate = (i: number, a: Aggregate) => onChange({ ...def, aggregates: def.aggregates.map((x, j) => (j === i ? a : x)) });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-ink">{t("builder.groupBy")}</legend>
        {[0, 1, 2].map((i) => (
          <FormSelect key={i} label={t("builder.groupLevel", { n: i + 1 })} name={`group_${i}`} placeholder={t("builder.none")} value={def.group_by[i] ?? ""} onChange={(e) => onChange({ ...def, group_by: [...def.group_by.slice(0, i), ...(e.target.value ? [e.target.value] : [])] })} options={groupable.map((f) => ({ value: f.key, label: f.label }))} disabled={i > def.group_by.length} />
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-ink">{t("builder.aggregates")}</legend>
        {def.aggregates.map((a, i) => (
          <div key={i} className="flex items-end gap-2">
            <FormSelect className="w-40" label={t("builder.function")} name={`fn_${i}`} value={a.fn} onChange={(e) => setAggregate(i, { fn: e.target.value as Aggregate["fn"], field: e.target.value === "count" ? "" : a.field })} options={FNS.map((fn) => ({ value: fn, label: t(`builder.fns.${fn}`) }))} />
            {a.fn !== "count" && <FormSelect className="flex-1" label={t("builder.field")} name={`agg_field_${i}`} placeholder={t("common.choose")} value={a.field} onChange={(e) => setAggregate(i, { ...a, field: e.target.value })} options={(a.fn === "sum" || a.fn === "avg" ? numeric : fields).map((f) => ({ value: f.key, label: f.label }))} />}
            <IconButton label={t("common.delete")} variant="danger" icon={<Trash2 className="size-4" />} onClick={() => onChange({ ...def, aggregates: def.aggregates.filter((_, j) => j !== i) })} />
          </div>
        ))}
        <Button size="sm" variant="outline" className="self-start" icon={<Plus className="size-4" />} onClick={() => onChange({ ...def, aggregates: [...def.aggregates, { fn: "count", field: "" }] })}>{t("builder.addAggregate")}</Button>
      </fieldset>
    </div>
  );
}

function Filters({ fields, filters, onChange }: { fields: BuilderField[]; filters: BuilderFilter[]; onChange: (f: BuilderFilter[]) => void }) {
  const { t } = useTranslation();
  const byKey = Object.fromEntries(fields.map((f) => [f.key, f]));
  const set = (i: number, f: BuilderFilter) => onChange(filters.map((x, j) => (j === i ? f : x)));
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium text-ink">{t("builder.filters")}</legend>
      {filters.map((item, i) => {
        const field = byKey[item.field];
        return (
          <div key={i} className="flex flex-wrap items-end gap-2">
            <FormSelect className="w-56" label={t("builder.field")} name={`filter_field_${i}`} value={item.field} onChange={(e) => set(i, { field: e.target.value, op: byKey[e.target.value]?.ops[0] ?? "eq", value: "" })} options={fields.map((f) => ({ value: f.key, label: f.label }))} />
            {field && <FormSelect className="w-44" label={t("builder.operator")} name={`filter_op_${i}`} value={item.op} onChange={(e) => set(i, { ...item, op: e.target.value, value: e.target.value === "between" || e.target.value === "in" ? [] : "" })} options={field.ops.map((op) => ({ value: op, label: t(`builder.ops.${op}`) }))} />}
            {field && <FilterValue field={field} filter={item} index={i} onChange={(value) => set(i, { ...item, value })} />}
            <IconButton label={t("common.delete")} variant="danger" icon={<Trash2 className="size-4" />} onClick={() => onChange(filters.filter((_, j) => j !== i))} />
          </div>
        );
      })}
      <Button size="sm" variant="outline" className="self-start" icon={<Plus className="size-4" />} disabled={!fields.length} onClick={() => onChange([...filters, { field: fields[0].key, op: fields[0].ops[0], value: "" }])}>{t("builder.addFilter")}</Button>
    </fieldset>
  );
}

function FilterValue({ field, filter, index, onChange }: { field: BuilderField; filter: BuilderFilter; index: number; onChange: (v: BuilderFilter["value"]) => void }) {
  const { t } = useTranslation();
  const name = `filter_value_${index}`;
  const type = field.kind === "date" && filter.op !== "last_days" ? "date" : "text";
  if (filter.op === "between") {
    const pair = Array.isArray(filter.value) ? filter.value : [];
    return (
      <span className="flex gap-2">
        <TextField className="w-36" label={t("builder.from")} name={`${name}_a`} type={type} dir="ltr" value={pair[0] ?? ""} onChange={(e) => onChange([e.target.value, pair[1] ?? ""])} />
        <TextField className="w-36" label={t("builder.to")} name={`${name}_b`} type={type} dir="ltr" value={pair[1] ?? ""} onChange={(e) => onChange([pair[0] ?? "", e.target.value])} />
      </span>
    );
  }
  if (field.kind === "bool") return <FormSelect className="w-32" label={t("builder.value")} name={name} value={String(filter.value)} onChange={(e) => onChange(e.target.value === "true")} options={[{ value: "true", label: t("builder.yes") }, { value: "false", label: t("builder.no") }]} />;
  if (field.kind === "choice" && filter.op !== "in") return <FormSelect className="w-48" label={t("builder.value")} name={name} placeholder={t("common.choose")} value={String(filter.value)} onChange={(e) => onChange(e.target.value)} options={field.choices} />;
  if (filter.op === "in")
    return <TextField className="w-64" label={t("builder.values")} hint={t("builder.valuesHint")} name={name} value={Array.isArray(filter.value) ? filter.value.join(", ") : ""} onChange={(e) => onChange(e.target.value.split(",").map((v) => v.trim()).filter(Boolean))} />;
  return <TextField className="w-48" label={filter.op === "last_days" ? t("builder.days") : t("builder.value")} name={name} type={type} dir="ltr" value={String(filter.value ?? "")} onChange={(e) => onChange(e.target.value)} />;
}

function Results({ result }: { result: BuilderResult }) {
  const { t } = useTranslation();
  const format = useFormat();
  const cell = (kind: string, value: string | number | boolean | null) => {
    if (value === null || value === undefined) return <span className="text-muted">—</span>;
    if (kind === "money") return <Money amount={String(value)} />;
    if (kind === "number") return <span className="num">{format.number(String(value), [0, 2])}</span>;
    if (kind === "date") return <span className="num">{format.date(String(value))}</span>;
    if (kind === "bool") return value ? t("builder.yes") : t("builder.no");
    return String(value);
  };
  const columns: Column<Record<string, string | number | boolean | null> & { _i: number }>[] = result.columns.map((c) => ({ id: c.key, header: c.label, cell: (r) => cell(c.kind, r[c.key]) }));
  const rows = result.rows.map((r, i) => ({ ...r, _i: i }));
  return (
    <Card title={t("builder.results")} subtitle={t("builder.rows", { count: rows.length })}>
      {result.truncated && <Alert tone="info" className="mb-3">{t("builder.truncated")}</Alert>}
      {result.suppressed > 0 && <Alert tone="warning" className="mb-3">{t("builder.suppressed", { count: result.suppressed })}</Alert>}
      <DataTable caption={t("builder.results")} columns={columns} rows={rows} rowKey={(r) => String(r._i)} empty={t("builder.empty")} minWidth={Math.max(480, columns.length * 140)} />
    </Card>
  );
}
