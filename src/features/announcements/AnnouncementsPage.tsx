import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Paperclip, Pin, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";

import { type Announcement, type AnnouncementBody, announcementsApi, type Audience } from "@/api/announcements";
import { endpoints } from "@/api/index";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { Dialog } from "@/design/Dialog";
import { CheckField, FormSelect, TextArea, TextField } from "@/design/Field";
import { FileDrop } from "@/design/FileDrop";
import { Pill } from "@/design/Pill";
import { openFile } from "@/features/employees/download";
import { Page } from "@/layout/Page";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

const local = (iso: string | null) => (iso ? new Date(iso).toLocaleString("sv").slice(0, 16).replace(" ", "T") : "");
const toIso = (value: string) => (value ? new Date(value).toISOString() : "");

/** /announcements — company news for one's audience (task 20, #49); HR writes them, sees every one and its
 * receipts. /announcements/:id opens one, which counts as read. */
export default function AnnouncementsPage() {
  const { id } = useParams();
  return id ? <One id={Number(id)} /> : <List />;
}

function List() {
  const { t } = useTranslation();
  const format = useFormat();
  const { can } = useSession();
  const scope = useScopeKey();
  const list = useQuery({ queryKey: ["announcements", ...scope], queryFn: () => announcementsApi.list() });
  const [editing, setEditing] = useState<Announcement | "new" | null>(null);
  const manage = can("announcements.manage");
  return (
    <Page title={t("announcements.title")} actions={manage && <Button variant="accent" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>{t("announcements.add")}</Button>}>
      <div className="flex flex-col gap-3">
        {list.isPending && <Card><p className="text-muted">{t("common.loading")}</p></Card>}
        {list.data?.results.length === 0 && <Card><p className="text-muted">{t("announcements.empty")}</p></Card>}
        {list.data?.results.map((a) => (
          <Card key={a.id} className={a.info.read_at || manage ? "" : "ring-2 ring-teal/40"}>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {a.pinned && <Pin aria-label={t("announcements.pinned")} className="size-4 text-teal-dark" />}
                <Link to={`/announcements/${a.id}`} className="text-lg font-semibold text-ink hover:underline">{format.pick({ ar: a.title_ar, en: a.title_en || a.title_ar })}</Link>
                {!a.info.read_at && !manage && <Pill tone="sky">{t("announcements.new")}</Pill>}
                {a.requires_ack && !a.info.acknowledged_at && !manage && <Pill tone="amber">{t("announcements.toConfirm")}</Pill>}
                {manage && <Pill tone={a.info.live ? "green" : "neutral"}>{a.info.live ? t("announcements.live") : a.published_at ? t("announcements.ended") : t("announcements.scheduled")}</Pill>}
              </div>
              <p className="line-clamp-2 text-muted">{format.pick({ ar: a.body_ar, en: a.body_en || a.body_ar })}</p>
              <p className="num text-sm text-muted">
                {format.date(a.publish_at)} · {audienceLabel(t, format, a)}
                {a.info.attachments.length > 0 && <> · <Paperclip aria-hidden="true" className="inline size-3.5" /> {a.info.attachments.length}</>}
              </p>
              {manage && <Button size="sm" variant="outline" className="self-start" onClick={() => setEditing(a)}>{t("common.edit")}</Button>}
            </div>
          </Card>
        ))}
      </div>
      {editing !== null && <Editor row={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </Page>
  );
}

function audienceLabel(t: (k: string, v?: Record<string, unknown>) => string, format: ReturnType<typeof useFormat>, a: Announcement) {
  if (a.audience === "branch" && a.info.branch) return t("announcements.forBranch", { name: format.name(a.info.branch) });
  if (a.audience === "department" && a.info.department) return t("announcements.forDepartment", { name: format.name(a.info.department) });
  return t("announcements.forCompany");
}

function One({ id }: { id: number }) {
  const { t } = useTranslation();
  const format = useFormat();
  const { can } = useSession();
  const queryClient = useQueryClient();
  const manage = can("announcements.manage");
  const item = useQuery({ queryKey: ["announcement", id], queryFn: () => announcementsApi.get(id) });
  const read = useMutation({ mutationFn: () => announcementsApi.read(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["announcements"] }) });
  const confirm = useMutation({ mutationFn: () => announcementsApi.acknowledge(id), onSuccess: (a) => { queryClient.setQueryData(["announcement", id], a); void queryClient.invalidateQueries({ queryKey: ["announcements"] }); } });
  const open = useMutation({ mutationFn: (aid: number) => openFile(() => announcementsApi.attachment(id, aid)) });
  const receipts = useQuery({ queryKey: ["announcement-receipts", id], queryFn: () => announcementsApi.receipts(id), enabled: manage });
  const { mutate: markRead } = read;
  const a = item.data;
  useEffect(() => {
    if (a && !manage && !a.info.read_at) markRead();
  }, [a, manage, markRead]);
  if (item.isError) return <Page title={t("announcements.title")}><Alert>{t("announcements.notFound")}</Alert></Page>;
  if (!a) return null;
  return (
    <Page title={format.pick({ ar: a.title_ar, en: a.title_en || a.title_ar })}>
      <div className="flex flex-col gap-4">
        <Card subtitle={`${format.date(a.publish_at)} · ${audienceLabel(t, format, a)}`}>
          <div className="flex flex-col gap-4">
            <p className="whitespace-pre-line leading-relaxed text-ink">{format.pick({ ar: a.body_ar, en: a.body_en || a.body_ar })}</p>
            {a.info.attachments.length > 0 && (
              <ul className="flex flex-col gap-1">
                {a.info.attachments.map((f) => (
                  <li key={f.id}>
                    <button type="button" className="inline-flex cursor-pointer items-center gap-1.5 text-teal-dark hover:underline" onClick={() => open.mutate(f.id)}><Paperclip aria-hidden="true" className="size-4" />{f.name}</button>
                  </li>
                ))}
              </ul>
            )}
            {a.requires_ack && !manage && (a.info.acknowledged_at ? <p role="status" className="text-sm text-muted">{t("announcements.confirmedOn", { date: format.date(a.info.acknowledged_at) })}</p> : <Button variant="accent" className="self-start" disabled={confirm.isPending} onClick={() => confirm.mutate()}>{t("announcements.confirm")}</Button>)}
            {(confirm.error || open.error) && <Alert>{apiErrors(confirm.error ?? open.error, t("common.saveFailed")).general}</Alert>}
          </div>
        </Card>
        {manage && receipts.data && (
          <Card title={t("announcements.receipts")} subtitle={t("announcements.receiptsSummary", { audience: receipts.data.audience, read: receipts.data.read, confirmed: receipts.data.acknowledged })}>
            {receipts.data.pending.length ? (
              <>
                <p className="mb-2 text-sm text-muted">{a.requires_ack ? t("announcements.notConfirmed") : t("announcements.notRead")}</p>
                <ul className="grid gap-1 text-sm sm:grid-cols-2">{receipts.data.pending.map((p) => <li key={p.id}>{format.name(p)} <span className="text-muted">({p.email})</span></li>)}</ul>
              </>
            ) : (
              <p className="text-muted">{t("announcements.everyone")}</p>
            )}
          </Card>
        )}
      </div>
    </Page>
  );
}

function Editor({ row, onClose }: { row: Announcement | null; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const { company } = useSession();
  const queryClient = useQueryClient();
  const departments = useQuery({ queryKey: ["departments", ...scope], queryFn: () => endpoints.departments() });
  const [v, setV] = useState<AnnouncementBody>(row ?? { title_ar: "", title_en: "", body_ar: "", body_en: "", audience: "company", branch: null, department: null, publish_at: new Date().toISOString(), expires_at: null, pinned: false, requires_ack: false });
  const [file, setFile] = useState<File | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      const saved = await announcementsApi.save({ ...v, id: row?.id });
      if (file) await announcementsApi.attach(saved.id, file);
      return saved;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["announcements"] });
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog open size="lg" onClose={onClose} title={row ? t("announcements.edit") : t("announcements.add")} footer={<Button variant="accent" disabled={save.isPending || !v.title_ar.trim() || !v.body_ar.trim()} onClick={() => save.mutate()}>{t("announcements.save")}</Button>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t("announcements.titleAr")} name="title_ar" value={v.title_ar} onChange={(e) => setV({ ...v, title_ar: e.target.value })} error={errors.fields.title_ar} />
        <TextField label={t("announcements.titleEn")} name="title_en" dir="ltr" value={v.title_en} onChange={(e) => setV({ ...v, title_en: e.target.value })} />
        <TextArea label={t("announcements.bodyAr")} name="body_ar" rows={5} value={v.body_ar} onChange={(e) => setV({ ...v, body_ar: e.target.value })} error={errors.fields.body_ar} />
        <TextArea label={t("announcements.bodyEn")} name="body_en" rows={5} dir="ltr" value={v.body_en} onChange={(e) => setV({ ...v, body_en: e.target.value })} />
        <FormSelect label={t("announcements.audience")} name="audience" value={v.audience} onChange={(e) => setV({ ...v, audience: e.target.value as Audience })} options={(["company", "branch", "department"] as const).map((a) => ({ value: a, label: t(`announcements.audiences.${a}`) }))} />
        {v.audience === "branch" && <FormSelect label={t("announcements.branch")} name="branch" placeholder={t("common.choose")} value={v.branch ? String(v.branch) : ""} onChange={(e) => setV({ ...v, branch: Number(e.target.value) || null })} options={(company?.branches ?? []).map((b) => ({ value: String(b.id), label: format.name(b) }))} error={errors.fields.branch} />}
        {v.audience === "department" && <FormSelect label={t("announcements.department")} name="department" placeholder={t("common.choose")} value={v.department ? String(v.department) : ""} onChange={(e) => setV({ ...v, department: Number(e.target.value) || null })} options={(departments.data?.results ?? []).map((d) => ({ value: String(d.id), label: format.name(d) }))} error={errors.fields.department} />}
        <TextField label={t("announcements.publishAt")} name="publish_at" type="datetime-local" dir="ltr" value={local(v.publish_at)} onChange={(e) => setV({ ...v, publish_at: toIso(e.target.value) })} error={errors.fields.publish_at} />
        <TextField label={t("announcements.expiresAt")} hint={t("announcements.expiresHint")} name="expires_at" type="datetime-local" dir="ltr" value={local(v.expires_at)} onChange={(e) => setV({ ...v, expires_at: e.target.value ? toIso(e.target.value) : null })} error={errors.fields.expires_at} />
        <CheckField label={t("announcements.pin")} checked={v.pinned} onChange={(e) => setV({ ...v, pinned: e.target.checked })} />
        <CheckField label={t("announcements.askConfirm")} checked={v.requires_ack} onChange={(e) => setV({ ...v, requires_ack: e.target.checked })} />
        <FileDrop className="sm:col-span-2" label={t("announcements.attachment")} file={file} onChange={setFile} accept=".pdf,.jpg,.jpeg,.png" error={errors.fields.file} />
        {(errors.fields.detail || errors.general) && <Alert className="sm:col-span-2">{errors.fields.detail ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
