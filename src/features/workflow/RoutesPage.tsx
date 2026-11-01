import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router";

import { type Route, workflow } from "@/api/workflow";
import { useScopeKey } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { Dialog } from "@/design/Dialog";
import { Select } from "@/design/Field";
import { Pill } from "@/design/Pill";
import { Page } from "@/layout/Page";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

import { PreviewPanel } from "./PreviewPanel";
import { useDescribe, useRouteMeta } from "./shared";

/** /settings/workflows — approval routes of each request type, in the order the engine tries them (#23). */
export default function RoutesPage() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const meta = useRouteMeta();
  const type = params.get("type") || meta.data?.types[0]?.code || "";
  const typeMeta = meta.data?.types.find((x) => x.code === type);
  const describe = useDescribe(meta.data, typeMeta?.facts ?? []);
  const [removing, setRemoving] = useState<Route | null>(null);

  const routes = useQuery({
    queryKey: ["workflow", "routes", type, ...scope],
    queryFn: () => workflow.routes(type),
    enabled: Boolean(type),
  });
  const remove = useMutation({
    mutationFn: (route: Route) => workflow.deleteRoute(route.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workflow", "routes"] });
      setRemoving(null);
    },
  });

  const Arrow = format.dir === "rtl" ? ChevronLeft : ChevronRight;
  const approverLabel = (value: string) => format.pick(meta.data?.approver_types.find((a) => a.value === value)?.label ?? { ar: value, en: value });
  const editable = (route: Route) => route.scope === "company" || Boolean(meta.data?.can_manage_tenant);

  return (
    <Page
      title={t("workflow.title")}
      actions={
        type && (
          <Button variant="accent" icon={<Plus className="size-[18px]" />} onClick={() => navigate(`/settings/workflows/new?type=${type}`)}>
            {t("workflow.newRoute")}
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            label={t("workflow.requestType")}
            value={type}
            onChange={(e) => setParams({ type: e.target.value }, { replace: true })}
            options={(meta.data?.types ?? []).map((x) => ({ value: x.code, label: format.pick(x.name) }))}
            className="min-w-64"
          />
          <p className="text-sm text-muted">{t("workflow.orderHint")}</p>
        </div>

        {routes.isPending ? (
          <Card>
            <p className="text-muted">{t("common.loading")}</p>
          </Card>
        ) : (
          <ol aria-label={t("workflow.routes")} className="flex flex-col gap-3">
            {(routes.data ?? []).map((route, index) => (
              <li key={route.id}>
                <Card variant="solid" padding="md" className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-start gap-3">
                    <span className="num flex size-8 shrink-0 items-center justify-center rounded-full bg-teal-soft text-sm font-semibold text-teal-ink">
                      {format.number(index + 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-semibold text-ink">{format.name(route)}</h2>
                      <p className="mt-0.5 text-sm text-muted">
                        {route.is_fallback
                          ? t("workflow.fallbackHint")
                          : route.conditions.length
                            ? `${t("workflow.when")} ${route.conditions.map(describe).join(` ${t("workflow.and")} `)}`
                            : t("workflow.everyRequest")}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {route.is_fallback && <Pill tone="teal">{t("workflow.default")}</Pill>}
                      <Pill tone={route.scope === "company" ? "lavender" : "neutral"}>{t(`workflow.scope.${route.scope}`)}</Pill>
                      {!route.is_active && <Pill tone="navy">{t("workflow.inactive")}</Pill>}
                      {route.in_use > 0 && <Pill tone="sky">{t("workflow.inUse", { count: route.in_use })}</Pill>}
                    </div>
                    {editable(route) && (
                      <div className="flex gap-1">
                        <Link
                          to={`/settings/workflows/${route.id}?type=${type}`}
                          aria-label={t("common.editNamed", { name: format.name(route) })}
                          className="inline-flex size-9 items-center justify-center rounded-lg text-ink hover:bg-neutral-soft"
                        >
                          <Pencil aria-hidden="true" className="size-[18px]" />
                        </Link>
                        <IconButton
                          size="sm"
                          variant="danger"
                          label={route.is_fallback ? t("workflow.restoreDefault") : t("common.deleteNamed", { name: format.name(route) })}
                          icon={route.is_fallback ? <RotateCcw /> : <Trash2 />}
                          onClick={() => setRemoving(route)}
                        />
                      </div>
                    )}
                  </div>
                  <ol aria-label={t("workflow.steps")} className="flex flex-wrap items-center gap-2">
                    {route.steps.map((step, i) => (
                      <li key={step.order} className="flex items-center gap-2">
                        {i > 0 && <Arrow aria-hidden="true" className="size-4 text-subtle" />}
                        <span className="rounded-full border border-line bg-white px-3 py-1 text-sm">
                          <span className="font-medium">{format.name(step)}</span>
                          <span className="text-muted">
                            {" · "}
                            {step.role ? format.name(step.role) : step.user ? format.name(step.user) : approverLabel(step.approver_type)}
                          </span>
                          {step.condition.length > 0 && <span className="text-muted"> · {t("workflow.conditional")}</span>}
                        </span>
                      </li>
                    ))}
                  </ol>
                </Card>
              </li>
            ))}
          </ol>
        )}

        {typeMeta && <PreviewPanel key={type} requestType={type} facts={typeMeta.facts} />}
      </div>

      {removing && (
        <Dialog
          open
          onClose={() => setRemoving(null)}
          title={removing.is_fallback ? t("workflow.restoreDefault") : t("workflow.removeTitle")}
          footer={
            <>
              <Button variant="outline" onClick={() => setRemoving(null)}>
                {t("common.cancel")}
              </Button>
              <Button variant="primary" disabled={remove.isPending} onClick={() => remove.mutate(removing)}>
                {removing.is_fallback ? t("workflow.restore") : t("common.delete")}
              </Button>
            </>
          }
        >
          <p>{removing.is_fallback ? t("workflow.restoreBody") : t("workflow.removeBody", { name: format.name(removing) })}</p>
          {removing.in_use > 0 && <p className="mt-3 text-sm text-muted">{t("workflow.removeInUse", { count: removing.in_use })}</p>}
          {remove.isError && <Alert className="mt-3">{apiErrors(remove.error, t("common.saveFailed")).general}</Alert>}
        </Dialog>
      )}
    </Page>
  );
}
