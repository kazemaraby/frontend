import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type PermissionRow, type RoleRow, rolesApi } from "@/api/users";
import { useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { Dialog } from "@/design/Dialog";
import { CheckField, TextField } from "@/design/Field";
import { Pill } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

/** The roles tab: system roles (read-only, kept in step with the code) and the tenant's custom roles, each a set of
 * permissions. Anyone who manages users reads them; making and changing them takes core.manage_roles. */
export function RolesCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const { can } = useSession();
  const queryClient = useQueryClient();
  const roles = useQuery({ queryKey: ["roles"], queryFn: rolesApi.list });
  const [open, setOpen] = useState<RoleRow | null>(null);
  const remove = useMutation({ mutationFn: (id: number) => rolesApi.remove(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roles"] }) });
  const editable = can("core.manage_roles");
  const columns: Column<RoleRow>[] = [
    { id: "name", header: t("roles.name"), cell: (r) => <span className="font-semibold text-ink">{format.name(r)}</span> },
    { id: "kind", header: t("roles.kind"), cell: (r) => <Pill tone={r.is_system ? "navy" : "lavender"}>{r.is_system ? t("roles.system") : t("roles.custom")}</Pill> },
    { id: "permissions", header: t("roles.permissions"), cell: (r) => <span className="num text-sm">{t("roles.permissionCount", { count: r.permissions.length })}</span> },
    { id: "users", header: t("roles.users"), cell: (r) => <span className="num text-sm">{r.users}</span> },
    {
      id: "act",
      header: t("common.actions"),
      cell: (r) => (
        <span className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setOpen(r)}>{r.is_system || !editable ? t("common.view") : t("common.edit")}</Button>
          {!r.is_system && editable && <Button size="sm" variant="ghost" className="text-danger" disabled={remove.isPending || r.users > 0} title={r.users > 0 ? t("roles.inUse") : undefined} onClick={() => remove.mutate(r.id)}>{t("common.delete")}</Button>}
        </span>
      ),
    },
  ];
  return (
    <Card title={t("roles.title")}>
      <p className="mb-4 text-sm text-muted">{t("roles.intro")}</p>
      <DataTable caption={t("roles.title")} columns={columns} rows={roles.data ?? []} rowKey={(r) => String(r.id)} rowLabel={(r) => format.name(r)} loading={roles.isPending} empty={t("roles.empty")} />
      {remove.error && <Alert className="mt-3">{apiErrors(remove.error, t("common.saveFailed")).general}</Alert>}
      {open && <RoleDialog role={open} onClose={() => setOpen(null)} />}
    </Card>
  );
}

export function RoleDialog({ role, onClose }: { role: RoleRow | null; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const { can } = useSession();
  const queryClient = useQueryClient();
  const catalog = useQuery({ queryKey: ["permissions"], queryFn: rolesApi.permissions });
  const readOnly = Boolean(role?.is_system) || !can("core.manage_roles");
  const [v, setV] = useState({ name_ar: role?.name_ar ?? "", name_en: role?.name_en ?? "", permissions: role?.permissions ?? [] });
  const save = useMutation({
    mutationFn: () => (role ? rolesApi.update(role.id, v) : rolesApi.create(v)),
    onSuccess: async () => {
      await Promise.all(["roles", "user-options"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const groups = new Map<string, PermissionRow[]>();
  for (const p of catalog.data ?? []) groups.set(p.module, [...(groups.get(p.module) ?? []), p]);
  const toggle = (codes: string[], on: boolean) => setV({ ...v, permissions: on ? [...new Set([...v.permissions, ...codes])] : v.permissions.filter((c) => !codes.includes(c)) });
  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={role ? format.name(role) : t("roles.add")}
      footer={!readOnly && <Button variant="accent" disabled={save.isPending || !v.name_ar.trim()} onClick={() => save.mutate()}>{t("common.save")}</Button>}
    >
      <div className="flex flex-col gap-4">
        {role?.is_system && <Alert tone="info">{t("roles.systemNote")}</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label={t("roles.nameAr")} name="name_ar" value={v.name_ar} disabled={readOnly} onChange={(e) => setV({ ...v, name_ar: e.target.value })} error={errors.fields.name_ar} />
          <TextField label={t("roles.nameEn")} name="name_en" dir="ltr" value={v.name_en} disabled={readOnly} onChange={(e) => setV({ ...v, name_en: e.target.value })} error={errors.fields.name_en} />
        </div>
        {!readOnly && <p className="text-sm text-muted">{t("roles.ownOnly")}</p>}
        {catalog.isPending && <p className="text-muted">{t("common.loading")}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          {[...groups.entries()].map(([module, perms]) => {
            const codes = perms.map((p) => p.code);
            const all = codes.every((c) => v.permissions.includes(c));
            return (
              <fieldset key={module} className="flex flex-col gap-2 rounded-card border border-line bg-white p-4">
                <legend className="px-1 text-sm font-semibold text-ink">{t(`roles.modules.${module}`, { defaultValue: module })}</legend>
                {!readOnly && <CheckField label={t("common.selectAll")} checked={all} onChange={() => toggle(codes, !all)} />}
                {perms.map((p) => (
                  <CheckField key={p.code} label={`${format.name(p)}${p.is_sensitive ? ` · ${t("roles.sensitive")}` : ""}`} checked={v.permissions.includes(p.code)} disabled={readOnly} onChange={() => toggle([p.code], !v.permissions.includes(p.code))} />
                ))}
              </fieldset>
            );
          })}
        </div>
        {(errors.fields.permissions || errors.general) && <Alert>{errors.fields.permissions ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
