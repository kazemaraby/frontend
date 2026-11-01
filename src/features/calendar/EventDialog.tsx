import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type Audience, calendar, type CompanyEvent } from "@/api/calendar";
import { useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { DateInput } from "@/design/DateInput";
import { Dialog } from "@/design/Dialog";
import { CheckField, FormSelect, TextArea, TextField } from "@/design/Field";
import { useMasterData } from "@/features/employees/masterData";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

/** Add or change a company event (leave.manage_events). The audience decides who sees it. */
export function EventDialog({ event, day, onClose }: { event?: CompanyEvent; day?: string; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { company } = useSession();
  const master = useMasterData();
  const format = useFormat();
  const [values, setValues] = useState({
    title_ar: event?.title_ar ?? "",
    title_en: event?.title_en ?? "",
    description: event?.description ?? "",
    start_date: event?.start_date ?? day ?? "",
    end_date: event?.end_date ?? day ?? "",
    all_day: event?.all_day ?? true,
    start_time: event?.start_time?.slice(0, 5) ?? "",
    end_time: event?.end_time?.slice(0, 5) ?? "",
    location: event?.location ?? "",
    audience: event?.audience ?? ("company" as Audience),
    branch: event?.branch ? String(event.branch) : "",
    department: event?.department ? String(event.department) : "",
  });
  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => setValues((v) => ({ ...v, [key]: value }));

  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: ["calendar"] });
    onClose();
  };
  const save = useMutation({
    mutationFn: () => {
      const body: Partial<CompanyEvent> = {
        ...values,
        start_time: values.all_day ? null : values.start_time || null,
        end_time: values.all_day ? null : values.end_time || null,
        branch: values.audience === "branch" && values.branch ? Number(values.branch) : null,
        department: values.audience === "department" && values.department ? Number(values.department) : null,
      };
      return event ? calendar.updateEvent(event.id, body) : calendar.createEvent(body);
    },
    onSuccess: done,
  });
  const remove = useMutation({ mutationFn: () => calendar.deleteEvent(event!.id), onSuccess: done });
  const errors = apiErrors(save.error ?? remove.error, t("common.saveFailed"));

  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={event ? t("calendar.events.edit") : t("calendar.events.new")}
      footer={
        <>
          {event && (
            <Button variant="outline" className="me-auto" disabled={remove.isPending} onClick={() => remove.mutate()}>
              {t("common.delete")}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={save.isPending || !values.title_ar.trim() || !values.start_date || !values.end_date} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("calendar.events.titleAr")} name="title_ar" value={values.title_ar} onChange={(e) => set("title_ar", e.target.value)} error={errors.fields.title_ar} required autoFocus />
          <TextField label={t("calendar.events.titleEn")} name="title_en" dir="ltr" value={values.title_en} onChange={(e) => set("title_en", e.target.value)} error={errors.fields.title_en} />
          <DateInput label={t("calendar.events.from")} name="start_date" value={values.start_date || null} onChange={(d) => set("start_date", d ?? "")} error={errors.fields.start_date} required />
          <DateInput label={t("calendar.events.to")} name="end_date" value={values.end_date || null} min={values.start_date || undefined} onChange={(d) => set("end_date", d ?? "")} error={errors.fields.end_date} required />
        </div>
        <CheckField label={t("calendar.events.allDay")} checked={values.all_day} onChange={(e) => set("all_day", e.target.checked)} />
        {!values.all_day && (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label={t("calendar.events.startsAt")} name="start_time" type="time" dir="ltr" value={values.start_time} onChange={(e) => set("start_time", e.target.value)} error={errors.fields.start_time} required />
            <TextField label={t("calendar.events.endsAt")} name="end_time" type="time" dir="ltr" value={values.end_time} onChange={(e) => set("end_time", e.target.value)} error={errors.fields.end_time} />
          </div>
        )}
        <TextField label={t("calendar.events.location")} name="location" value={values.location} onChange={(e) => set("location", e.target.value)} error={errors.fields.location} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormSelect
            label={t("calendar.events.audience")}
            name="audience"
            value={values.audience}
            onChange={(e) => set("audience", e.target.value as Audience)}
            options={(["company", "branch", "department"] as const).map((a) => ({ value: a, label: t(`calendar.events.audiences.${a}`) }))}
          />
          {values.audience === "branch" && (
            <FormSelect
              label={t("employee.fields.branch")}
              name="branch"
              value={values.branch}
              placeholder={t("common.choose")}
              options={(company?.branches ?? []).map((b) => ({ value: String(b.id), label: format.name(b) }))}
              onChange={(e) => set("branch", e.target.value)}
              error={errors.fields.branch}
            />
          )}
          {values.audience === "department" && (
            <FormSelect
              label={t("employee.fields.department")}
              name="department"
              value={values.department}
              placeholder={t("common.choose")}
              options={master.options.departments}
              onChange={(e) => set("department", e.target.value)}
              error={errors.fields.department}
            />
          )}
        </div>
        <TextArea label={t("calendar.events.description")} rows={3} value={values.description} onChange={(e) => set("description", e.target.value)} />
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
