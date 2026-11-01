import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { Person } from "@/api";
import { type Condition, type FactMeta, type Operator, type RouteMeta, workflow } from "@/api/workflow";
import { useScopeKey } from "@/auth/session";
import { Button, IconButton } from "@/design/Button";
import { CheckField, FormSelect, TextField } from "@/design/Field";
import { useFormat } from "@/lib/useFormat";

export function useRouteMeta() {
  const scope = useScopeKey();
  return useQuery({ queryKey: ["workflow", "meta", ...scope], queryFn: workflow.meta, staleTime: 5 * 60_000 });
}

const NUMBER_OPS: Operator[] = ["eq", "ne", "gt", "gte", "lt", "lte"];
const LIST_OPS: Operator[] = ["eq", "ne", "in", "not_in"];
const isList = (op: Operator) => op === "in" || op === "not_in";

export function opsFor(fact: FactMeta | undefined): Operator[] {
  return fact?.kind === "number" ? NUMBER_OPS : LIST_OPS;
}

/** "Department is one of Sales, Finance" in the active language. */
export function useDescribe(meta: RouteMeta | undefined, facts: FactMeta[]) {
  const format = useFormat();
  return (condition: Condition) => {
    const fact = facts.find((f) => f.name === condition.fact);
    const op = meta?.operators.find((o) => o.value === condition.op);
    const label = (v: string | number) => {
      const option = fact?.options.find((o) => String(o.value) === String(v));
      return option ? format.pick(option.label) : fact?.kind === "number" ? format.number(v) : String(v);
    };
    const values = Array.isArray(condition.value) ? condition.value : [condition.value];
    return [
      fact ? format.pick(fact.label) : condition.fact,
      op ? format.pick(op.label) : condition.op,
      new Intl.ListFormat(format.lang, { type: "disjunction" }).format(values.map(label)),
    ].join(" ");
  };
}

/** A list of checks that must all hold. Values follow the fact: a number, one option, or several options. */
export function ConditionsEditor({
  label,
  facts,
  meta,
  value,
  onChange,
  error,
}: {
  label: string;
  facts: FactMeta[];
  meta: RouteMeta;
  value: Condition[];
  onChange: (next: Condition[]) => void;
  error?: string | null;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const set = (index: number, patch: Partial<Condition>) => onChange(value.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  const add = () => {
    const fact = facts[0];
    onChange([...value, { fact: fact.name, op: "eq", value: fact.kind === "number" ? "" : fact.options[0]?.value ?? "" }]);
  };

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-medium text-ink">{label}</legend>
      {value.length === 0 && <p className="text-sm text-muted">{t("workflow.conditions.none")}</p>}
      {value.map((condition, index) => {
        const fact = facts.find((f) => f.name === condition.fact) ?? facts[0];
        const ops = opsFor(fact);
        const many = isList(condition.op);
        const chosen = (Array.isArray(condition.value) ? condition.value : [condition.value]).map(String);
        return (
          <div key={index} className="flex flex-col gap-3 rounded-tile border border-line bg-white p-3">
            <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <FormSelect
                label={t("workflow.conditions.fact")}
                value={condition.fact}
                options={facts.map((f) => ({ value: f.name, label: format.pick(f.label) }))}
                onChange={(e) => {
                  const next = facts.find((f) => f.name === e.target.value)!;
                  set(index, { fact: next.name, op: "eq", value: next.kind === "number" ? "" : next.options[0]?.value ?? "" });
                }}
              />
              <FormSelect
                label={t("workflow.conditions.operator")}
                value={condition.op}
                options={ops.map((op) => ({ value: op, label: format.pick(meta.operators.find((o) => o.value === op)!.label) }))}
                onChange={(e) => {
                  const op = e.target.value as Operator;
                  const keep = isList(op) === many ? condition.value : isList(op) ? chosen.filter(Boolean) : chosen[0] ?? "";
                  set(index, { op, value: keep });
                }}
              />
              <IconButton
                variant="danger"
                size="sm"
                label={t("workflow.conditions.remove", { n: index + 1 })}
                icon={<Trash2 />}
                onClick={() => onChange(value.filter((_c, i) => i !== index))}
              />
            </div>
            {fact.kind === "number" ? (
              <TextField
                label={t("workflow.conditions.value")}
                inputMode="decimal"
                dir="ltr"
                value={String(condition.value ?? "")}
                onChange={(e) => set(index, { value: e.target.value })}
              />
            ) : many ? (
              <div role="group" aria-label={t("workflow.conditions.value")} className="flex max-h-40 flex-col gap-2 overflow-y-auto rounded-card border border-line p-3">
                {fact.options.map((option) => (
                  <CheckField
                    key={option.value}
                    label={format.pick(option.label)}
                    checked={chosen.includes(String(option.value))}
                    onChange={(e) => {
                      const picked = fact.options
                        .filter((o) => (String(o.value) === String(option.value) ? e.target.checked : chosen.includes(String(o.value))))
                        .map((o) => o.value);
                      set(index, { value: picked });
                    }}
                  />
                ))}
              </div>
            ) : (
              <FormSelect
                label={t("workflow.conditions.value")}
                value={String(condition.value ?? "")}
                options={fact.options.map((o) => ({ value: String(o.value), label: format.pick(o.label) }))}
                onChange={(e) => set(index, { value: fact.options.find((o) => String(o.value) === e.target.value)?.value ?? e.target.value })}
              />
            )}
          </div>
        );
      })}
      {error && <p className="text-sm text-danger">{error}</p>}
      <div>
        <Button size="sm" variant="outline" icon={<Plus className="size-4" />} onClick={add} disabled={!facts.length}>
          {t("workflow.conditions.add")}
        </Button>
      </div>
    </fieldset>
  );
}

/** Search colleagues of the company and pick one (named approver, escalation user). */
export function PersonPicker({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: Person | null;
  onChange: (person: Person | null) => void;
  error?: string | null;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const [search, setSearch] = useState("");
  const people = useQuery({
    queryKey: ["workflow", "people", search, ...scope],
    queryFn: () => workflow.people(search),
    placeholderData: (previous) => previous,
  });
  const options = [...(value ? [value] : []), ...(people.data ?? []).filter((p) => p.id !== value?.id)];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField label={t("workflow.findPerson")} type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
      <FormSelect
        label={label}
        value={value ? String(value.id) : ""}
        placeholder={t("workflow.choosePerson")}
        options={options.map((p) => ({ value: String(p.id), label: format.pick({ ar: p.name_ar, en: p.name_en }) }))}
        onChange={(e) => onChange(options.find((p) => String(p.id) === e.target.value) ?? null)}
        error={error}
      />
    </div>
  );
}
