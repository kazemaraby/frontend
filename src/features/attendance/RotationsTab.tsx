import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { roster, type Rotation, type Shift, shifts } from "@/api/attendance";
import { useScopeKey } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { Dialog } from "@/design/Dialog";
import { CheckField, FormSelect, TextField } from "@/design/Field";
import { Pill } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

import { DOTS } from "./ShiftsTab";

/** Rotations (Phase 3 task 3): a cycle of days, each a shift or off, assigned in the roster like a shift. The cycle
 * starts on the assignment's first day; a rotation sets its own days off (no branch weekend). */
export function RotationsTab() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const rotations = useQuery({ queryKey: ["rotations", ...scope], queryFn: roster.rotations });
  const shiftList = useQuery({ queryKey: ["shifts", ...scope], queryFn: () => shifts.list() });
  const [editing, setEditing] = useState<Rotation | "new" | null>(null);
  const byId = new Map((shiftList.data ?? []).map((s) => [s.id, s]));
  return (
    <Card
      variant="solid"
      title={t("rotations.title")}
      subtitle={t("rotations.hint")}
      action={
        <Button size="sm" variant="accent" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
          {t("rotations.add")}
        </Button>
      }
    >
      {rotations.isSuccess && rotations.data.length === 0 ? (
        <p className="text-sm text-muted">{t("rotations.none")}</p>
      ) : (
        <ul aria-label={t("rotations.title")} className="flex flex-col divide-y divide-line">
          {(rotations.data ?? []).map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="min-w-40 font-semibold text-ink">{format.name(r)}</span>
              <span className="num text-sm text-muted">{t("rotations.days", { count: r.days.length })}</span>
              <ol aria-label={t("rotations.cycle", { name: format.name(r) })} className="flex flex-wrap gap-1">
                {r.days.map((d) => {
                  const s = d.shift ? byId.get(d.shift) : undefined;
                  return (
                    <li key={d.position} title={s ? format.name(s) : t("rotations.off")} className={`flex h-7 min-w-9 items-center justify-center rounded-md px-1.5 text-xs font-semibold ${s ? `${DOTS[s.color]} text-white` : "bg-neutral-soft text-muted"}`}>
                      {s ? s.code || format.name(s).slice(0, 2) : t("rotations.offShort")}
                    </li>
                  );
                })}
              </ol>
              {!r.is_active && <Pill tone="navy">{t("leaveSettings.off")}</Pill>}
              <IconButton className="ms-auto" size="sm" variant="plain" label={t("common.editNamed", { name: format.name(r) })} icon={<Pencil />} onClick={() => setEditing(r)} />
            </li>
          ))}
        </ul>
      )}
      {editing && <RotationDialog rotation={editing === "new" ? undefined : editing} shiftList={(shiftList.data ?? []).filter((s) => s.is_active)} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function RotationDialog({ rotation, shiftList, onClose }: { rotation?: Rotation; shiftList: Shift[]; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const [v, setV] = useState({ name_ar: rotation?.name_ar ?? "", name_en: rotation?.name_en ?? "", is_active: rotation?.is_active ?? true });
  const [days, setDays] = useState<(number | null)[]>(rotation?.days.map((d) => d.shift) ?? [shiftList[0]?.id ?? null, null]);
  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: ["rotations"] });
    onClose();
  };
  const save = useMutation({ mutationFn: () => roster.saveRotation({ ...v, days: days.map((shift, position) => ({ position, shift })) }, rotation?.id), onSuccess: done });
  const remove = useMutation({ mutationFn: () => roster.removeRotation(rotation!.id), onSuccess: done });
  const errors = apiErrors(save.error ?? remove.error, t("common.saveFailed"));
  const options = [{ value: "", label: t("rotations.off") }, ...shiftList.map((s) => ({ value: String(s.id), label: format.name(s) }))];
  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={rotation ? t("rotations.edit") : t("rotations.add")}
      footer={
        <>
          {rotation && (
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
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("letters.nameAr")} name="name_ar" value={v.name_ar} onChange={(e) => setV({ ...v, name_ar: e.target.value })} error={errors.fields.name_ar} required />
          <TextField label={t("letters.nameEn")} name="name_en" dir="ltr" value={v.name_en} onChange={(e) => setV({ ...v, name_en: e.target.value })} />
          <CheckField label={t("leaveSettings.active")} checked={v.is_active} onChange={(e) => setV({ ...v, is_active: e.target.checked })} />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold text-ink">{t("rotations.cycleTitle")}</legend>
          <p className="text-sm text-muted">{t("rotations.cycleHint")}</p>
          <ol className="grid gap-2 sm:grid-cols-2">
            {days.map((shift, i) => (
              <li key={i} className="flex items-end gap-2">
                <FormSelect className="flex-1" label={t("rotations.day", { n: i + 1 })} name={`day_${i}`} value={shift === null ? "" : String(shift)} options={options} onChange={(e) => setDays(days.map((x, j) => (j === i ? (e.target.value ? Number(e.target.value) : null) : x)))} />
                <IconButton size="sm" variant="plain" label={t("rotations.removeDay", { n: i + 1 })} icon={<Trash2 />} disabled={days.length < 2} onClick={() => setDays(days.filter((_, j) => j !== i))} />
              </li>
            ))}
          </ol>
          <Button size="sm" variant="ghost" className="self-start" icon={<Plus className="size-4" />} iconPosition="start" disabled={days.length >= 56} onClick={() => setDays([...days, null])}>
            {t("rotations.addDay")}
          </Button>
          {errors.fields.days && <p className="text-sm text-danger">{errors.fields.days}</p>}
        </fieldset>
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
