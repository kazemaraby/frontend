import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { custody, type CustodyCategory, type CustodyItem, type ItemStatus } from "@/api/custody";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { Dialog } from "@/design/Dialog";
import { FormSelect, SearchInput, TextArea, TextField } from "@/design/Field";
import { Money } from "@/design/Money";
import { Pagination } from "@/design/Pagination";
import { Pill, type PillTone } from "@/design/Pill";
import { Tabs } from "@/design/Tabs";
import NoAccess from "@/features/misc/NoAccessPage";
import { Page } from "@/layout/Page";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

import { CustodyRecords } from "./CustodyRecords";

export const CATEGORIES: CustodyCategory[] = ["laptop", "phone", "sim", "vehicle", "key", "access_card", "tool", "uniform", "other"];
const STATUSES: ItemStatus[] = ["available", "assigned", "maintenance", "lost", "retired"];
const ITEM_TONES: Record<ItemStatus, PillTone> = { available: "green", assigned: "sky", maintenance: "amber", lost: "salmon", retired: "neutral" };
const PAGE_SIZE = 25;

/** /custody — custody (#35). HR (selfservice.manage_custody) hands over and receives back, and keeps the register
 * of items; everyone else sees what they (or their team) hold and acknowledges receipt. */
export default function CustodyPage() {
  const { t } = useTranslation();
  const { can } = useSession();
  const manage = can("selfservice.manage_custody");
  const [params, setParams] = useSearchParams();
  const tab = manage && params.get("tab") === "items" ? "items" : "records";
  if (!can("selfservice.view_custody")) return <NoAccess />;
  return (
    <Page
      title={t("custody.title")}
      tabs={
        manage && (
          <Tabs
            label={t("custody.title")}
            value={tab}
            onChange={(next) => setParams(next === "records" ? {} : { tab: next }, { replace: true })}
            items={[
              { id: "records", label: t("custody.tabs.records") },
              { id: "items", label: t("custody.tabs.items") },
            ]}
          />
        )
      }
    >
      {tab === "records" ? <CustodyRecords manage={manage} title={t("custody.records")} /> : <ItemsCard />}
    </Page>
  );
}

function ItemsCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<CustodyItem | "new" | null>(null);
  const items = useQuery({
    queryKey: ["custody", "items", status, search, page, ...scope],
    queryFn: () => custody.items({ status: status || undefined, search: search || undefined, page }),
    placeholderData: (previous) => previous,
  });
  const columns: Column<CustodyItem>[] = [
    {
      id: "item",
      header: t("custody.item"),
      cell: (i) => (
        <span className="flex flex-col">
          <span className="font-semibold text-ink">{format.name(i)}</span>
          <span className="text-sm text-muted">{t(`custody.categories.${i.category}`)}</span>
        </span>
      ),
    },
    {
      id: "tag",
      header: t("custody.assetTag"),
      cell: (i) => (
        <span className="flex flex-col" dir="ltr">
          <span className="num text-start">{i.asset_tag || "—"}</span>
          {i.serial_number && <span className="num text-start text-sm text-muted">{i.serial_number}</span>}
        </span>
      ),
    },
    { id: "value", header: t("custody.value"), cell: (i) => (i.value ? <Money amount={i.value} /> : <span className="text-muted">—</span>) },
    {
      id: "status",
      header: t("approvals.columns.status"),
      cell: (i) => (
        <span className="flex flex-col items-start gap-1">
          <Pill tone={ITEM_TONES[i.status]}>{t(`custody.itemStatus.${i.status}`)}</Pill>
          {i.holder && <span className="text-sm text-muted">{format.name(i.holder)}</span>}
        </span>
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">{t("common.actions")}</span>,
      cell: (i) => <IconButton size="sm" variant="plain" label={t("common.editNamed", { name: format.name(i) })} icon={<Pencil />} onClick={() => setEditing(i)} />,
    },
  ];
  const total = items.data?.count ?? 0;
  return (
    <Card
      variant="solid"
      title={t("custody.register")}
      subtitle={t("custody.registerHint")}
      action={
        <Button size="sm" variant="accent" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
          {t("custody.addItem")}
        </Button>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <SearchInput label={t("custody.searchItems")} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <FormSelect label={t("approvals.columns.status")} className="[&_label]:sr-only" value={status} placeholder={t("custody.everyStatus")} options={STATUSES.map((s) => ({ value: s, label: t(`custody.itemStatus.${s}`) }))} onChange={(e) => { setStatus(e.target.value); setPage(1); }} />
      </div>
      <DataTable caption={t("custody.register")} columns={columns} rows={items.data?.results ?? []} rowKey={(i) => String(i.id)} loading={items.isPending} empty={t("custody.noItems")} minWidth={720} />
      {total > PAGE_SIZE && <Pagination page={page} pageCount={Math.ceil(total / PAGE_SIZE)} onPageChange={setPage} />}
      {editing && <ItemDialog item={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function ItemDialog({ item, onClose }: { item?: CustodyItem; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [v, setV] = useState({
    category: item?.category ?? ("laptop" as CustodyCategory),
    name_ar: item?.name_ar ?? "",
    name_en: item?.name_en ?? "",
    asset_tag: item?.asset_tag ?? "",
    serial_number: item?.serial_number ?? "",
    value: item?.value ?? "",
    status: item?.status ?? ("available" as ItemStatus),
    notes: item?.notes ?? "",
  });
  const set = <K extends keyof typeof v>(key: K, value: (typeof v)[K]) => setV((x) => ({ ...x, [key]: value }));
  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: ["custody"] });
    onClose();
  };
  const save = useMutation({ mutationFn: () => custody.saveItem({ ...v, value: v.value.trim() || null }, item?.id), onSuccess: done });
  const remove = useMutation({ mutationFn: () => custody.deleteItem(item!.id), onSuccess: done });
  const errors = apiErrors(save.error ?? remove.error, t("common.saveFailed"));
  // "Handed over" follows the custody records, so it is offered only as the current state.
  const statuses = STATUSES.filter((s) => s !== "assigned" || item?.status === "assigned");
  return (
    <Dialog
      open
      onClose={onClose}
      title={item ? t("custody.editItem") : t("custody.addItem")}
      footer={
        <>
          {item && (
            <Button variant="outline" className="me-auto" disabled={remove.isPending} onClick={() => remove.mutate()}>
              {t("common.delete")}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!v.name_ar.trim() || save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormSelect label={t("custody.category")} name="category" value={v.category} onChange={(e) => set("category", e.target.value as CustodyCategory)} options={CATEGORIES.map((c) => ({ value: c, label: t(`custody.categories.${c}`) }))} />
        <FormSelect label={t("approvals.columns.status")} name="status" value={v.status} disabled={v.status === "assigned"} onChange={(e) => set("status", e.target.value as ItemStatus)} options={statuses.map((s) => ({ value: s, label: t(`custody.itemStatus.${s}`) }))} error={errors.fields.status} />
        <TextField label={t("letters.nameAr")} name="name_ar" value={v.name_ar} onChange={(e) => set("name_ar", e.target.value)} error={errors.fields.name_ar} required />
        <TextField label={t("letters.nameEn")} name="name_en" dir="ltr" value={v.name_en} onChange={(e) => set("name_en", e.target.value)} />
        <TextField label={t("custody.assetTag")} name="asset_tag" dir="ltr" value={v.asset_tag} onChange={(e) => set("asset_tag", e.target.value)} error={errors.fields.asset_tag} />
        <TextField label={t("custody.serial")} name="serial_number" dir="ltr" value={v.serial_number} onChange={(e) => set("serial_number", e.target.value)} />
        <TextField label={t("custody.value")} name="value" inputMode="decimal" dir="ltr" value={v.value} onChange={(e) => set("value", e.target.value)} error={errors.fields.value} />
        <TextArea label={t("custody.notes")} name="notes" rows={2} className="sm:col-span-2" value={v.notes} onChange={(e) => set("notes", e.target.value)} />
        {(errors.general || errors.fields.detail) && <Alert className="sm:col-span-2">{errors.general ?? errors.fields.detail}</Alert>}
      </div>
    </Dialog>
  );
}
