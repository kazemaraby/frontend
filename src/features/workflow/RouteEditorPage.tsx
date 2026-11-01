import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router";

import { ApiError, type Person } from "@/api";
import {
  type ApproverType,
  type Condition,
  type EscalateTo,
  type FactMeta,
  type Route,
  type RouteMeta,
  type RouteStep,
  type StepInput,
  workflow,
} from "@/api/workflow";
import { useScopeKey } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { CheckField, FormSelect, TextField } from "@/design/Field";
import { Page } from "@/layout/Page";
import { useFormat } from "@/lib/useFormat";

import { PreviewPanel } from "./PreviewPanel";
import { ConditionsEditor, PersonPicker, useRouteMeta } from "./shared";

type StepDraft = {
  key: number;
  name_ar: string;
  name_en: string;
  approver_type: ApproverType;
  role: string;
  user: Person | null;
  mode: "any" | "all";
  skip_if_unresolved: boolean;
  sla_hours: string;
  condition: Condition[];
  escalate_after_hours: string;
  escalate_to: EscalateTo;
  escalate_role: string;
  escalate_user: Person | null;
};

type Errors = { general: string | null; fields: Record<string, string>; steps: Record<string, string>[]; stepsGeneral: string | null };

const ROLE_TYPES: ApproverType[] = ["role", "role_in_scope"];
let nextKey = 1;

function toDraft(step?: RouteStep): StepDraft {
  return {
    key: nextKey++,
    name_ar: step?.name_ar ?? "",
    name_en: step?.name_en ?? "",
    approver_type: step?.approver_type ?? "manager",
    role: step?.role ? String(step.role.id) : "",
    user: step?.user ?? null,
    mode: step?.mode ?? "any",
    skip_if_unresolved: step?.skip_if_unresolved ?? true,
    sla_hours: step?.sla_hours ? String(step.sla_hours) : "",
    condition: step?.condition ?? [],
    escalate_after_hours: step?.escalate_after_hours ? String(step.escalate_after_hours) : "",
    escalate_to: step?.escalate_to ?? "",
    escalate_role: step?.escalate_role ? String(step.escalate_role.id) : "",
    escalate_user: step?.escalate_user ?? null,
  };
}

function toInput(step: StepDraft): StepInput {
  const hours = (v: string) => (v.trim() ? Number(v) : null);
  return {
    name_ar: step.name_ar,
    name_en: step.name_en,
    approver_type: step.approver_type,
    role: ROLE_TYPES.includes(step.approver_type) && step.role ? Number(step.role) : null,
    user: step.approver_type === "user" ? step.user?.id ?? null : null,
    mode: step.mode,
    skip_if_unresolved: step.skip_if_unresolved,
    sla_hours: hours(step.sla_hours),
    condition: step.condition,
    escalate_after_hours: hours(step.escalate_after_hours),
    escalate_to: step.escalate_after_hours.trim() ? step.escalate_to : "",
    escalate_role: step.escalate_to === "role" && step.escalate_role ? Number(step.escalate_role) : null,
    escalate_user: step.escalate_to === "user" ? step.escalate_user?.id ?? null : null,
  };
}

const first = (v: unknown) => (Array.isArray(v) ? String(v[0] ?? "") : typeof v === "string" ? v : "");

/** DRF errors of a route: route fields, and per step (a list of field → messages, one per step). */
export function routeErrors(error: unknown, fallback: string): Errors {
  const result: Errors = { general: null, fields: {}, steps: [], stepsGeneral: null };
  if (!error) return result;
  if (!(error instanceof ApiError) || !error.body || typeof error.body !== "object") return { ...result, general: fallback };
  for (const [key, value] of Object.entries(error.body as Record<string, unknown>)) {
    if (key === "steps" && Array.isArray(value) && value.some((v) => v && typeof v === "object")) {
      result.steps = value.map((row) =>
        row && typeof row === "object" ? Object.fromEntries(Object.entries(row).map(([k, v]) => [k, first(v)])) : {},
      );
    } else if (key === "steps") {
      result.stepsGeneral = first(value);
    } else if (key === "detail" || key === "non_field_errors") {
      result.general = first(value);
    } else if (key !== "code") {
      result.fields[key] = first(value);
    }
  }
  if (!result.general && !Object.keys(result.fields).length && !result.steps.length && !result.stepsGeneral) result.general = fallback;
  return result;
}

/** /settings/workflows/new?type= and /settings/workflows/:id */
export default function RouteEditorPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const scope = useScopeKey();
  const meta = useRouteMeta();
  const route = useQuery({
    queryKey: ["workflow", "route", Number(id), ...scope],
    queryFn: () => workflow.route(Number(id)),
    enabled: Boolean(id),
  });
  const { t } = useTranslation();
  if (!meta.data || (id && !route.data)) {
    return (
      <Page title={t("workflow.title")}>
        <Card>
          <p className="text-muted">{route.isError ? t("common.loadFailed") : t("common.loading")}</p>
        </Card>
      </Page>
    );
  }
  const type = route.data?.request_type ?? params.get("type") ?? meta.data.types[0].code;
  return <Editor key={route.data?.id ?? "new"} meta={meta.data} route={route.data} type={type} />;
}

function Editor({ meta, route, type }: { meta: RouteMeta; route?: Route; type: string }) {
  const { t } = useTranslation();
  const format = useFormat();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const typeMeta = meta.types.find((x) => x.code === type)!;
  const facts: FactMeta[] = typeMeta.facts;

  const [nameAr, setNameAr] = useState(route?.name_ar ?? "");
  const [nameEn, setNameEn] = useState(route?.name_en ?? "");
  const [scopeValue, setScope] = useState<"company" | "tenant">(route?.scope ?? "company");
  const [priority, setPriority] = useState(String(route?.priority ?? 100));
  const [active, setActive] = useState(route?.is_active ?? true);
  const [conditions, setConditions] = useState<Condition[]>(route?.conditions ?? []);
  const [steps, setSteps] = useState<StepDraft[]>(route ? route.steps.map(toDraft) : [toDraft()]);
  const fallback = Boolean(route?.is_fallback);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name_ar: nameAr,
        name_en: nameEn,
        is_active: fallback ? true : active,
        priority: Number(priority),
        conditions: fallback ? [] : conditions,
        steps: steps.map(toInput),
      };
      return route ? workflow.updateRoute(route.id, body) : workflow.createRoute({ ...body, request_type: type, scope: scopeValue });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workflow"] });
      navigate(`/settings/workflows?type=${type}`);
    },
  });
  const errors = routeErrors(save.error, t("common.saveFailed"));

  const setStep = (key: number, patch: Partial<StepDraft>) => setSteps((all) => all.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const move = (index: number, by: number) =>
    setSteps((all) => {
      const next = [...all];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });
  const option = (c: { value: string; label: { ar: string; en: string } }) => ({ value: c.value, label: format.pick(c.label) });
  const roles = meta.roles.map((r) => ({ value: String(r.id), label: format.name(r) }));

  return (
    <Page title={route ? t("workflow.editRoute") : t("workflow.newRoute")}>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Card variant="solid" title={t("workflow.route")} subtitle={format.pick(typeMeta.name)}>
            <div className="flex flex-col gap-4">
              {route && route.in_use > 0 && <Alert tone="info">{t("workflow.versionNote", { count: route.in_use })}</Alert>}
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label={t("master.name_ar")} name="name_ar" value={nameAr} onChange={(e) => setNameAr(e.target.value)} error={errors.fields.name_ar} required />
                <TextField label={t("master.name_en")} name="name_en" dir="ltr" value={nameEn} onChange={(e) => setNameEn(e.target.value)} error={errors.fields.name_en} />
              </div>
              {fallback ? (
                <p className="text-sm text-muted">{t("workflow.fallbackHint")}</p>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormSelect
                      label={t("workflow.appliesTo")}
                      name="scope"
                      value={scopeValue}
                      disabled={Boolean(route) || !meta.can_manage_tenant}
                      onChange={(e) => setScope(e.target.value as "company" | "tenant")}
                      options={[
                        { value: "company", label: t("workflow.scope.company") },
                        { value: "tenant", label: t("workflow.scope.tenant") },
                      ]}
                      error={errors.fields.scope}
                    />
                    <TextField
                      label={t("workflow.priority")}
                      name="priority"
                      inputMode="numeric"
                      dir="ltr"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      hint={t("workflow.priorityHint")}
                      error={errors.fields.priority}
                    />
                  </div>
                  <CheckField label={t("workflow.active")} checked={active} onChange={(e) => setActive(e.target.checked)} />
                  <ConditionsEditor
                    label={t("workflow.routeConditions")}
                    facts={facts}
                    meta={meta}
                    value={conditions}
                    onChange={setConditions}
                    error={errors.fields.conditions}
                  />
                </>
              )}
            </div>
          </Card>

          <Card variant="solid" title={t("workflow.steps")} subtitle={t("workflow.stepsHint")}>
            <ol className="flex flex-col gap-4">
              {steps.map((step, index) => {
                const err = errors.steps[index] ?? {};
                return (
                  <li key={step.key} aria-label={t("workflow.stepN", { n: index + 1 })} className="flex flex-col gap-4 rounded-tile border border-line bg-neutral-soft/50 p-4">
                    <div className="flex items-center gap-2">
                      <span className="num flex size-7 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white">{format.number(index + 1)}</span>
                      <span className="flex-1 font-semibold">{step.name_ar || t("workflow.stepN", { n: index + 1 })}</span>
                      <IconButton size="xs" variant="plain" label={t("workflow.moveUp")} icon={<ArrowUp />} disabled={index === 0} onClick={() => move(index, -1)} />
                      <IconButton size="xs" variant="plain" label={t("workflow.moveDown")} icon={<ArrowDown />} disabled={index === steps.length - 1} onClick={() => move(index, 1)} />
                      <IconButton
                        size="xs"
                        variant="danger"
                        label={t("workflow.removeStep")}
                        icon={<Trash2 />}
                        disabled={steps.length === 1}
                        onClick={() => setSteps((all) => all.filter((s) => s.key !== step.key))}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <TextField label={t("master.name_ar")} name={`step-${index}-name_ar`} value={step.name_ar} onChange={(e) => setStep(step.key, { name_ar: e.target.value })} error={err.name_ar} required />
                      <TextField label={t("master.name_en")} dir="ltr" value={step.name_en} onChange={(e) => setStep(step.key, { name_en: e.target.value })} error={err.name_en} />
                      <FormSelect
                        label={t("workflow.approver")}
                        name={`step-${index}-approver`}
                        value={step.approver_type}
                        options={meta.approver_types.map(option)}
                        onChange={(e) => setStep(step.key, { approver_type: e.target.value as ApproverType })}
                        error={err.approver_type}
                      />
                      {ROLE_TYPES.includes(step.approver_type) && (
                        <FormSelect
                          label={t("workflow.role")}
                          name={`step-${index}-role`}
                          value={step.role}
                          placeholder={t("workflow.chooseRole")}
                          options={roles}
                          onChange={(e) => setStep(step.key, { role: e.target.value })}
                          error={err.role}
                        />
                      )}
                      <FormSelect
                        label={t("workflow.mode")}
                        value={step.mode}
                        options={meta.modes.map(option)}
                        onChange={(e) => setStep(step.key, { mode: e.target.value as "any" | "all" })}
                        error={err.mode}
                      />
                      <TextField
                        label={t("workflow.slaHours")}
                        inputMode="numeric"
                        dir="ltr"
                        value={step.sla_hours}
                        onChange={(e) => setStep(step.key, { sla_hours: e.target.value })}
                        hint={t("workflow.slaHint")}
                        error={err.sla_hours}
                      />
                    </div>
                    {step.approver_type === "user" && (
                      <PersonPicker label={t("workflow.user")} value={step.user} onChange={(user) => setStep(step.key, { user })} error={err.user} />
                    )}
                    <CheckField
                      label={t("workflow.skipIfNobody")}
                      checked={step.skip_if_unresolved}
                      onChange={(e) => setStep(step.key, { skip_if_unresolved: e.target.checked })}
                    />

                    <ConditionsEditor
                      label={t("workflow.stepCondition")}
                      facts={facts}
                      meta={meta}
                      value={step.condition}
                      onChange={(condition) => setStep(step.key, { condition })}
                      error={err.condition}
                    />

                    <fieldset className="flex flex-col gap-3">
                      <legend className="mb-1 text-sm font-medium text-ink">{t("workflow.escalation")}</legend>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <TextField
                          label={t("workflow.escalateAfter")}
                          inputMode="numeric"
                          dir="ltr"
                          value={step.escalate_after_hours}
                          onChange={(e) => setStep(step.key, { escalate_after_hours: e.target.value })}
                          hint={t("workflow.escalateHint")}
                          error={err.escalate_after_hours}
                        />
                        {step.escalate_after_hours.trim() !== "" && (
                          <FormSelect
                            label={t("workflow.escalateTo")}
                            name={`step-${index}-escalate_to`}
                            value={step.escalate_to}
                            placeholder={t("workflow.chooseEscalation")}
                            options={meta.escalate_to.map(option)}
                            onChange={(e) => setStep(step.key, { escalate_to: e.target.value as EscalateTo })}
                            error={err.escalate_to}
                          />
                        )}
                        {step.escalate_after_hours.trim() !== "" && step.escalate_to === "role" && (
                          <FormSelect
                            label={t("workflow.role")}
                            value={step.escalate_role}
                            placeholder={t("workflow.chooseRole")}
                            options={roles}
                            onChange={(e) => setStep(step.key, { escalate_role: e.target.value })}
                            error={err.escalate_role}
                          />
                        )}
                      </div>
                      {step.escalate_after_hours.trim() !== "" && step.escalate_to === "user" && (
                        <PersonPicker label={t("workflow.user")} value={step.escalate_user} onChange={(escalate_user) => setStep(step.key, { escalate_user })} error={err.escalate_user} />
                      )}
                    </fieldset>
                  </li>
                );
              })}
            </ol>
            {errors.stepsGeneral && <Alert className="mt-4">{errors.stepsGeneral}</Alert>}
            <Button className="mt-4" size="sm" variant="outline" icon={<Plus className="size-4" />} onClick={() => setSteps((all) => [...all, toDraft()])}>
              {t("workflow.addStep")}
            </Button>
          </Card>

          {errors.general && <Alert>{errors.general}</Alert>}
          {(Object.keys(errors.fields).length > 0 || errors.steps.some((s) => Object.keys(s).length)) && <Alert>{t("workflow.fixErrors")}</Alert>}
          <div className="flex gap-3">
            <Button type="submit" variant="primary" disabled={save.isPending}>
              {t("common.save")}
            </Button>
            <Button variant="outline" onClick={() => navigate(`/settings/workflows?type=${type}`)}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>

        <div className="lg:sticky lg:top-4">
          <PreviewPanel
            requestType={type}
            facts={facts}
            draft={() => ({ scope: route?.scope ?? scopeValue, conditions: fallback ? [] : conditions, steps: steps.map(toInput) })}
          />
        </div>
      </div>
    </Page>
  );
}
