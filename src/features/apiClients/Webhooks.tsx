import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type WebhookBody, type WebhookEndpoint, webhooksApi } from "@/api/apiClients";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { Dialog } from "@/design/Dialog";
import { CheckField, TextField } from "@/design/Field";
import { Pill, type PillTone } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

const TONES: Record<string, PillTone> = { sent: "green", pending: "amber", failed: "salmon", skipped: "neutral" };

/** Webhooks (task 22): where events are sent, signed with the endpoint's secret; the delivery log; a test ping. */
export function WebhooksCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ["webhooks"], queryFn: webhooksApi.list });
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<{ name: string; secret: string } | null>(null);
  const [log, setLog] = useState<WebhookEndpoint | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["webhooks"] });
  const toggle = useMutation({ mutationFn: (e: WebhookEndpoint) => webhooksApi.update(e.id, { is_active: !e.is_active }), onSuccess: refresh });
  const test = useMutation({ mutationFn: (id: number) => webhooksApi.test(id), onSuccess: refresh });
  const rotate = useMutation({ mutationFn: (id: number) => webhooksApi.rotate(id), onSuccess: (e) => setSecret({ name: e.name, secret: e.secret }) });
  const columns: Column<WebhookEndpoint>[] = [
    { id: "name", header: t("webhooks.name"), cell: (e) => <span className="flex flex-col"><span className="font-semibold text-ink">{e.name}</span><span dir="ltr" className="self-start text-xs text-muted">{e.url}</span></span> },
    { id: "events", header: t("webhooks.events"), cell: (e) => <span className="flex flex-wrap gap-1">{e.events.map((ev) => <Pill key={ev} tone="neutral"><span dir="ltr">{ev}</span></Pill>)}</span> },
    { id: "state", header: t("webhooks.state"), cell: (e) => <span className="flex flex-col gap-1"><Pill tone={e.is_active ? "green" : "salmon"}>{e.is_active ? t("webhooks.on") : t("webhooks.off")}</Pill>{e.disabled_reason && <span className="text-xs text-danger">{e.disabled_reason}</span>}</span> },
    { id: "last", header: t("webhooks.last"), cell: (e) => (e.info.last ? <span className="flex flex-col gap-1"><Pill tone={TONES[e.info.last.status]}>{t(`webhooks.statuses.${e.info.last.status}`)}</Pill><span className="num text-xs text-muted">{format.date(e.info.last.at)}</span></span> : "—") },
    { id: "act", header: t("common.actions"), cell: (e) => (
      <span className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" disabled={test.isPending || !e.is_active} onClick={() => test.mutate(e.id)}>{t("webhooks.test")}</Button>
        <Button size="sm" variant="outline" onClick={() => setLog(e)}>{t("webhooks.log")}</Button>
        <Button size="sm" variant="outline" onClick={() => rotate.mutate(e.id)}>{t("webhooks.rotate")}</Button>
        <Button size="sm" variant="ghost" onClick={() => toggle.mutate(e)}>{e.is_active ? t("webhooks.turnOff") : t("webhooks.turnOn")}</Button>
      </span>
    ) },
  ];
  return (
    <Card title={t("webhooks.title")} subtitle={t("webhooks.subtitle")} action={<Button variant="accent" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>{t("webhooks.add")}</Button>}>
      {test.data && <Alert tone={test.data.status === "sent" ? "info" : "warning"} className="mb-3">{test.data.status === "sent" ? t("webhooks.testOk", { code: test.data.last_status }) : t("webhooks.testFailed", { error: test.data.last_error })}</Alert>}
      {(test.error || toggle.error) && <Alert className="mb-3">{apiErrors(test.error ?? toggle.error, t("common.saveFailed")).general}</Alert>}
      <DataTable caption={t("webhooks.title")} columns={columns} rows={list.data?.results ?? []} rowKey={(e) => String(e.id)} rowLabel={(e) => e.name} loading={list.isPending} empty={t("webhooks.empty")} />
      {creating && <CreateDialog onClose={() => setCreating(false)} onCreated={(s) => { setCreating(false); setSecret(s); void refresh(); }} />}
      {secret && (
        <Dialog open onClose={() => setSecret(null)} title={t("webhooks.secretTitle", { name: secret.name })} footer={<Button variant="accent" onClick={() => setSecret(null)}>{t("apiClients.copied")}</Button>}>
          <div className="flex flex-col gap-3">
            <Alert tone="warning">{t("webhooks.secretOnce")}</Alert>
            <TextField label={t("webhooks.secret")} name="webhook_secret" dir="ltr" readOnly value={secret.secret} onFocus={(e) => e.target.select()} />
          </div>
        </Dialog>
      )}
      {log && <LogDialog endpoint={log} onClose={() => setLog(null)} />}
    </Card>
  );
}

function CreateDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (s: { name: string; secret: string }) => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const options = useQuery({ queryKey: ["webhook-options"], queryFn: webhooksApi.options });
  const [v, setV] = useState<WebhookBody>({ name: "", url: "https://", events: [], companies: [] });
  const save = useMutation({ mutationFn: () => webhooksApi.create(v), onSuccess: (e) => onCreated({ name: e.name, secret: e.secret }) });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const flip = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
  return (
    <Dialog open onClose={onClose} title={t("webhooks.add")} footer={<Button variant="accent" disabled={save.isPending || !v.name.trim() || !v.events.length || !v.companies.length} onClick={() => save.mutate()}>{t("webhooks.create")}</Button>}>
      <div className="flex flex-col gap-4">
        <TextField label={t("webhooks.name")} name="name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} error={errors.fields.name} />
        <TextField label={t("webhooks.url")} hint={t("webhooks.urlHint")} name="url" dir="ltr" value={v.url} onChange={(e) => setV({ ...v, url: e.target.value })} error={errors.fields.url} />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-ink">{t("webhooks.events")}</legend>
          {(options.data?.events ?? []).map((ev) => <CheckField key={ev.code} label={`${ev.label} (${ev.code})`} checked={v.events.includes(ev.code)} onChange={() => setV({ ...v, events: flip(v.events, ev.code) })} />)}
          {errors.fields.events && <span className="text-sm text-danger">{errors.fields.events}</span>}
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-ink">{t("apiClients.companies")}</legend>
          {(options.data?.companies ?? []).map((c) => <CheckField key={c.id} label={format.name(c)} checked={v.companies.includes(c.id)} onChange={() => setV({ ...v, companies: flip(v.companies, c.id) })} />)}
        </fieldset>
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

function LogDialog({ endpoint, onClose }: { endpoint: WebhookEndpoint; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const rows = useQuery({ queryKey: ["webhook-log", endpoint.id], queryFn: () => webhooksApi.deliveries(endpoint.id) });
  const again = useMutation({ mutationFn: (id: number) => webhooksApi.redeliver(endpoint.id, id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhook-log", endpoint.id] }) });
  return (
    <Dialog open size="lg" onClose={onClose} title={t("webhooks.logOf", { name: endpoint.name })}>
      <ul className="flex flex-col gap-2">
        {(rows.data ?? []).map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-tile border border-line px-3 py-2 text-sm">
            <span className="flex flex-col">
              <span dir="ltr" className="self-start font-medium">{d.event.type}</span>
              <span className="num text-xs text-muted">{format.date(d.created_at)} · {t("webhooks.attempts", { count: d.attempts })}{d.last_status ? ` · HTTP ${d.last_status}` : ""}{d.last_error && d.last_error !== `HTTP ${d.last_status}` ? ` · ${d.last_error}` : ""}</span>
            </span>
            <span className="flex items-center gap-2">
              <Pill tone={TONES[d.status]}>{t(`webhooks.statuses.${d.status}`)}</Pill>
              {d.status !== "sent" && <Button size="sm" variant="outline" disabled={again.isPending} onClick={() => again.mutate(d.id)}>{t("webhooks.redeliver")}</Button>}
            </span>
          </li>
        ))}
        {rows.data?.length === 0 && <li className="text-muted">{t("webhooks.noDeliveries")}</li>}
      </ul>
    </Dialog>
  );
}
