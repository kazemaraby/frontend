import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, CircleSlash, UsersRound } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { hr } from "@/api/hr";
import { type FactMeta, type PreviewInput, workflow } from "@/api/workflow";
import { useScopeKey } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { FormSelect, TextField } from "@/design/Field";
import { Pill } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

type Draft = Pick<PreviewInput, "scope" | "conditions" | "steps">;

/** "Who would approve?" for one employee: the route the engine picks, or (with `draft`) the route being edited. */
export function PreviewPanel({ requestType, facts, draft }: { requestType: string; facts: FactMeta[]; draft?: () => Draft }) {
  const grid = draft ? "grid gap-3" : "grid gap-3 sm:grid-cols-2"; // beside the editor the column is narrow
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const [search, setSearch] = useState("");
  const [employee, setEmployee] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const own = facts.filter((f) => f.own);

  const employees = useQuery({
    queryKey: ["workflow", "preview-employees", search, ...scope],
    queryFn: () => hr.searchEmployees(search),
    placeholderData: (previous) => previous,
  });
  const run = useMutation({
    mutationFn: () => workflow.preview({ request_type: requestType, employee: Number(employee), facts: values, ...draft?.() }),
  });
  const result = run.data;
  const error = run.error ? apiErrors(run.error, t("common.loadFailed")) : null;
  const person = (p: { name_ar: string; name_en: string }) => format.pick({ ar: p.name_ar, en: p.name_en });

  return (
    <Card variant="solid" title={t("workflow.preview.title")} subtitle={t(draft ? "workflow.preview.draftHint" : "workflow.preview.hint")}>
      <div className="flex flex-col gap-4">
        <div className={grid}>
          <TextField label={t("workflow.preview.findEmployee")} type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
          <FormSelect
            label={t("workflow.preview.employee")}
            name="preview_employee"
            value={employee}
            placeholder={t("workflow.preview.chooseEmployee")}
            options={(employees.data?.results ?? []).map((e) => ({ value: String(e.id), label: `${format.name(e)} · ${e.employee_no}` }))}
            onChange={(e) => setEmployee(e.target.value)}
          />
        </div>
        {own.length > 0 && (
          <div className={grid}>
            {own.map((fact) =>
              fact.kind === "number" ? (
                <TextField
                  key={fact.name}
                  label={format.pick(fact.label)}
                  inputMode="decimal"
                  dir="ltr"
                  value={values[fact.name] ?? ""}
                  onChange={(e) => setValues({ ...values, [fact.name]: e.target.value })}
                />
              ) : (
                <FormSelect
                  key={fact.name}
                  label={format.pick(fact.label)}
                  value={values[fact.name] ?? ""}
                  placeholder="—"
                  options={fact.options.map((o) => ({ value: String(o.value), label: format.pick(o.label) }))}
                  onChange={(e) => setValues({ ...values, [fact.name]: e.target.value })}
                />
              ),
            )}
          </div>
        )}
        <div>
          <Button variant="primary" size="sm" disabled={!employee || run.isPending} onClick={() => run.mutate()}>
            {t("workflow.preview.run")}
          </Button>
        </div>

        {error && <Alert>{error.general ?? Object.values(error.fields)[0] ?? t("workflow.preview.invalidDraft")}</Alert>}
        {result && !run.isPending && (
          <section aria-label={t("workflow.preview.result")} className="flex flex-col gap-3">
            <p className="text-sm">
              {draft ? (
                result.matches ? (
                  t("workflow.preview.draftMatches")
                ) : (
                  <>
                    {t("workflow.preview.draftDoesNotMatch")} <strong>{format.name(result.chosen)}</strong>
                  </>
                )
              ) : (
                <>
                  {t("workflow.preview.chosen")} <strong>{format.name(result.chosen)}</strong>
                  {result.chosen.is_fallback && <> · {t("workflow.default")}</>}
                </>
              )}
            </p>
            <ol className="flex flex-col gap-2">
              {result.steps.map((step) => (
                <li key={step.order} className="rounded-tile border border-line bg-white px-4 py-3">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    <span className="num text-muted">{format.number(step.order)}.</span>
                    {format.name(step)}
                    {step.outcome === "ask" && step.mode === "all" && step.approvers.length > 1 && (
                      <Pill tone="lavender" icon={<UsersRound />}>
                        {t("workflow.preview.allMustApprove")}
                      </Pill>
                    )}
                  </p>
                  {step.outcome === "ask" ? (
                    <ul className="mt-1 flex flex-col gap-1 text-sm">
                      {step.approvers.map((a) => (
                        <li key={a.id}>
                          {person(a)}
                          {a.delegate && (
                            <span className="text-muted">
                              {" "}
                              <ArrowLeftRight aria-hidden="true" className="inline size-3.5" /> {t("workflow.preview.delegatedTo", { name: person(a.delegate) })}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                      <CircleSlash aria-hidden="true" className="size-3.5" />
                      {t(`workflow.preview.outcome.${step.outcome}`)}
                    </p>
                  )}
                </li>
              ))}
            </ol>
            {result.goes_to_admins && <Alert tone="warning">{t("workflow.preview.goesToAdmins")}</Alert>}
          </section>
        )}
      </div>
    </Card>
  );
}
