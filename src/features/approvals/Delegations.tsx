import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type Delegation, endpoints } from "@/api";
import { useScopeKey, useSession } from "@/auth/session";
import { Button } from "@/design/Button";
import { DateInput } from "@/design/DateInput";
import { Dialog } from "@/design/Dialog";
import { CheckField, FormSelect, TextArea, TextField } from "@/design/Field";
import { Pill } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

const today = () => new Date().toLocaleDateString("en-CA"); // local YYYY-MM-DD

function useInvalidate() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["delegations"] }),
      queryClient.invalidateQueries({ queryKey: ["approvals"] }),
    ]);
}

// --- new delegation ------------------------------------------------------------------------------

export function DelegateDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const invalidate = useInvalidate();
  const [search, setSearch] = useState("");
  const [delegate, setDelegate] = useState("");
  const [start, setStart] = useState<string | null>(today());
  const [end, setEnd] = useState<string | null>(null);
  const [allTypes, setAllTypes] = useState(true);
  const [types, setTypes] = useState<string[]>([]);
  const [reason, setReason] = useState("");

  const people = useQuery({
    queryKey: ["delegations", "people", search],
    queryFn: () => endpoints.delegationPeople(search),
    placeholderData: (previous) => previous,
  });
  const requestTypes = useQuery({ queryKey: ["delegations", "types"], queryFn: endpoints.delegationTypes, staleTime: Infinity });
  const mutation = useMutation({
    mutationFn: () =>
      endpoints.createDelegation({
        delegate: Number(delegate),
        start_date: start!,
        end_date: end!,
        request_types: allTypes ? [] : types,
        reason,
      }),
    onSuccess: async () => {
      await invalidate();
      onClose();
    },
  });
  const errors = apiErrors(mutation.error, t("common.loadFailed"));
  const toggle = (code: string) => setTypes((now) => (now.includes(code) ? now.filter((c) => c !== code) : [...now, code]));
  const ready = delegate && start && end && (allTypes || types.length > 0);

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("delegations.newTitle")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="accent" disabled={mutation.isPending || !ready} onClick={() => mutation.mutate()}>
            {t("delegations.confirm")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t("delegations.explain")}</p>
        <TextField label={t("delegations.findPerson")} type="search" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
        <FormSelect
          label={t("delegations.delegate")}
          name="delegate"
          value={delegate}
          onChange={(e) => setDelegate(e.target.value)}
          placeholder={t("delegations.choosePerson")}
          options={(people.data ?? []).map((p) => ({ value: String(p.id), label: `${format.pick({ ar: p.name_ar, en: p.name_en })} · ${p.email}` }))}
          error={errors.fields.delegate}
          required
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <DateInput label={t("delegations.from")} name="start_date" value={start} onChange={setStart} min={today()} error={errors.fields.start_date} required />
          <DateInput label={t("delegations.to")} name="end_date" value={end} onChange={setEnd} min={start ?? today()} error={errors.fields.end_date} required />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-ink">{t("delegations.covers")}</legend>
          <CheckField label={t("delegations.allTypes")} checked={allTypes} onChange={(e) => setAllTypes(e.target.checked)} />
          {!allTypes && (
            <div className="flex flex-col gap-2 ps-7">
              {(requestTypes.data ?? []).map((type) => (
                <CheckField key={type.code} label={format.pick(type.name)} checked={types.includes(type.code)} onChange={() => toggle(type.code)} />
              ))}
            </div>
          )}
          {errors.fields.request_types && <p className="text-sm text-danger">{errors.fields.request_types}</p>}
        </fieldset>
        <TextArea label={t("delegations.reason")} value={reason} onChange={(e) => setReason(e.target.value)} />
        {errors.general && (
          <p role="alert" className="rounded-card bg-danger-soft px-4 py-3 text-sm text-danger">
            {errors.general}
          </p>
        )}
      </div>
    </Dialog>
  );
}

// --- current delegations -------------------------------------------------------------------------

/** Delegations that are running or coming up, given by or to the user, above the approvals list. */
export function DelegationBanner() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const { me } = useSession();
  const invalidate = useInvalidate();
  const list = useQuery({ queryKey: ["delegations", "list", ...scope], queryFn: endpoints.delegations });
  const cancel = useMutation({ mutationFn: (id: number) => endpoints.cancelDelegation(id), onSuccess: invalidate });
  const open = (list.data?.results ?? []).filter((d) => d.status !== "ended");
  if (!open.length) return null;

  const name = (d: Delegation, who: "delegator" | "delegate") => format.pick({ ar: d[who].name_ar, en: d[who].name_en });
  const dates = (d: Delegation) => ({ dates: format.dateRange(d.start_date, d.end_date) });
  const types = (d: Delegation) => new Intl.ListFormat(format.lang).format(d.request_type_names.map((n) => format.pick(n)));

  return (
    <ul aria-label={t("delegations.title")} className="mb-4 flex flex-col gap-2">
      {open.map((d) => {
        const given = d.delegator.id === me?.id;
        return (
          <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-tile bg-white px-4 py-3">
            <Pill tone={d.status === "active" ? "teal" : "amber"}>{t(`delegations.status.${d.status}`)}</Pill>
            <span className="flex-1 text-sm">
              {given
                ? t("delegations.givenTo", { name: name(d, "delegate"), ...dates(d) })
                : t("delegations.receivedFrom", { name: name(d, "delegator"), ...dates(d) })}
              {d.request_type_names.length > 0 && (
                <span className="text-muted"> · {types(d)}</span>
              )}
            </span>
            {given && (
              <Button size="sm" variant="outline" disabled={cancel.isPending} onClick={() => cancel.mutate(d.id)}>
                {t("delegations.end")}
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
