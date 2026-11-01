import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { type ApiClientBody, type ApiClientRow, apiClientsApi } from "@/api/apiClients";
import { useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { Dialog } from "@/design/Dialog";
import { CheckField, FormSelect, TextField } from "@/design/Field";
import { Pill } from "@/design/Pill";
import { Tabs } from "@/design/Tabs";
import { Page } from "@/layout/Page";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

import { WebhooksCard } from "./Webhooks";

/** /settings/api — public API clients (task 21): OAuth client credentials with scopes, the companies they reach and
 * the service role they act with. A secret is shown once; rotating replaces it, revoking ends the client. */
type Tab = "clients" | "webhooks";

export default function ApiClientsPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const [params, setParams] = useSearchParams();
  const format = useFormat();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ["api-clients"], queryFn: apiClientsApi.list });
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<{ name: string; id: string; secret: string } | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["api-clients"] });
  const rotate = useMutation({ mutationFn: (id: number) => apiClientsApi.rotate(id), onSuccess: async (c) => { setSecret({ name: c.name, id: c.client_id, secret: c.client_secret }); await refresh(); } });
  const revoke = useMutation({ mutationFn: (id: number) => apiClientsApi.revoke(id), onSuccess: refresh });
  const columns: Column<ApiClientRow>[] = [
    { id: "name", header: t("apiClients.name"), cell: (c) => <span className="flex flex-col"><span className="font-semibold text-ink">{c.name}</span><span dir="ltr" className="num self-start text-xs text-muted">{c.client_id}</span></span> },
    { id: "scopes", header: t("apiClients.scopes"), cell: (c) => <span className="flex flex-wrap gap-1">{c.scopes.map((s) => <Pill key={s} tone="neutral"><span dir="ltr">{s}</span></Pill>)}</span> },
    { id: "role", header: t("apiClients.role"), cell: (c) => <span className="flex flex-col text-sm"><span>{format.name(c.info.role)}</span><span className="text-muted">{c.info.companies.map((x) => format.name(x)).join("\u060C ")}</span></span> },
    { id: "used", header: t("apiClients.lastUsed"), cell: (c) => <span className="num text-sm">{c.last_used_at ? format.date(c.last_used_at) : "—"}</span> },
    { id: "state", header: t("apiClients.state"), cell: (c) => <Pill tone={c.is_active ? "green" : "neutral"}>{c.is_active ? t("apiClients.active") : t("apiClients.revoked")}</Pill> },
    { id: "act", header: t("common.actions"), cell: (c) => c.is_active && <span className="flex gap-2"><Button size="sm" variant="outline" disabled={rotate.isPending} onClick={() => rotate.mutate(c.id)}>{t("apiClients.rotate")}</Button><Button size="sm" variant="ghost" className="text-danger" disabled={revoke.isPending} onClick={() => revoke.mutate(c.id)}>{t("apiClients.revoke")}</Button></span> },
  ];
  const tabs: Tab[] = [...(can("api.manage_clients") ? (["clients"] as Tab[]) : []), ...(can("api.manage_webhooks") ? (["webhooks"] as Tab[]) : [])];
  const asked = params.get("tab") as Tab | null;
  const tab: Tab = asked && tabs.includes(asked) ? asked : tabs[0];
  return (
    <Page
      title={t("settings.api.title")}
      tabs={tabs.length > 1 && <Tabs label={t("settings.api.title")} value={tab} onChange={(next) => setParams(next === tabs[0] ? {} : { tab: next }, { replace: true })} items={tabs.map((id) => ({ id, label: t(`apiClients.tabs.${id}`) }))} />}
      actions={tab === "clients" && <Button variant="accent" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>{t("apiClients.add")}</Button>}
    >
      {tab === "webhooks" ? <WebhooksCard /> : (
      <div className="flex flex-col gap-4">
        <Card>
          <p className="text-sm text-muted">{t("apiClients.intro")}</p>
          <a href="/api/public/v1/docs" target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-teal-dark hover:underline">{t("apiClients.docs")}</a>
        </Card>
        <Card title={t("apiClients.title")}>
          <DataTable caption={t("apiClients.title")} columns={columns} rows={list.data?.results ?? []} rowKey={(c) => String(c.id)} rowLabel={(c) => c.name} loading={list.isPending} empty={t("apiClients.empty")} />
          {(rotate.error || revoke.error) && <Alert className="mt-3">{apiErrors(rotate.error ?? revoke.error, t("common.saveFailed")).general}</Alert>}
        </Card>
      </div>
      )}
      {creating && <CreateDialog onClose={() => setCreating(false)} onCreated={(c) => { setCreating(false); setSecret(c); }} />}
      {secret && (
        <Dialog open onClose={() => setSecret(null)} title={t("apiClients.secretTitle", { name: secret.name })} footer={<Button variant="accent" onClick={() => setSecret(null)}>{t("apiClients.copied")}</Button>}>
          <div className="flex flex-col gap-3">
            <Alert tone="warning">{t("apiClients.secretOnce")}</Alert>
            <TextField label={t("apiClients.clientId")} name="client_id" dir="ltr" readOnly value={secret.id} onFocus={(e) => e.target.select()} />
            <TextField label={t("apiClients.secret")} name="client_secret" dir="ltr" readOnly value={secret.secret} onFocus={(e) => e.target.select()} />
          </div>
        </Dialog>
      )}
    </Page>
  );
}

function CreateDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (c: { name: string; id: string; secret: string }) => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const options = useQuery({ queryKey: ["api-client-options"], queryFn: apiClientsApi.options });
  const [v, setV] = useState<ApiClientBody>({ name: "", scopes: [], companies: [], role: null });
  const save = useMutation({
    mutationFn: () => apiClientsApi.create(v),
    onSuccess: async (c) => {
      await queryClient.invalidateQueries({ queryKey: ["api-clients"] });
      onCreated({ name: c.name, id: c.client_id, secret: c.client_secret });
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const toggle = (list: (string | number)[], value: string | number) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  return (
    <Dialog open onClose={onClose} title={t("apiClients.add")} footer={<Button variant="accent" disabled={save.isPending || !v.name.trim() || !v.scopes.length || !v.companies.length || !v.role} onClick={() => save.mutate()}>{t("apiClients.create")}</Button>}>
      <div className="flex flex-col gap-4">
        <TextField label={t("apiClients.name")} name="name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} error={errors.fields.name} />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-ink">{t("apiClients.scopes")}</legend>
          {(options.data?.scopes ?? []).map((s) => <CheckField key={s.code} label={`${s.label} (${s.code})`} checked={v.scopes.includes(s.code)} onChange={() => setV({ ...v, scopes: toggle(v.scopes, s.code) as string[] })} />)}
          {errors.fields.scopes && <span className="text-sm text-danger">{errors.fields.scopes}</span>}
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-ink">{t("apiClients.companies")}</legend>
          {(options.data?.companies ?? []).map((c) => <CheckField key={c.id} label={format.name(c)} checked={v.companies.includes(c.id)} onChange={() => setV({ ...v, companies: toggle(v.companies, c.id) as number[] })} />)}
          {errors.fields.companies && <span className="text-sm text-danger">{errors.fields.companies}</span>}
        </fieldset>
        <FormSelect label={t("apiClients.role")} hint={t("apiClients.roleHint")} name="role" placeholder={t("common.choose")} value={v.role ? String(v.role) : ""} onChange={(e) => setV({ ...v, role: Number(e.target.value) || null })} options={(options.data?.roles ?? []).map((r) => ({ value: String(r.id), label: format.name(r) }))} error={errors.fields.role} />
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
