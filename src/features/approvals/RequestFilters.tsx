import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { endpoints, type RequestFilters } from "@/api";
import { FormSelect, SearchInput } from "@/design/Field";
import { useFormat } from "@/lib/useFormat";

/** Status groups of "my requests" (the API takes a comma list). */
export const STATUS_GROUPS = { open: "pending,returned", returned: "returned", approved: "approved", closed: "rejected,cancelled" } as const;

/** Search, request type and (optionally) status above a request list. Changing one goes back to page 1. */
export function RequestFilterBar({ value, onChange, statuses = false }: { value: RequestFilters; onChange: (next: RequestFilters) => void; statuses?: boolean }) {
  const { t } = useTranslation();
  const format = useFormat();
  const types = useQuery({ queryKey: ["workflow", "types"], queryFn: endpoints.delegationTypes, staleTime: Infinity });
  const set = (patch: RequestFilters) => onChange({ ...value, ...patch, page: 1 });
  return (
    <div className={`mb-4 grid gap-3 ${statuses ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
      <SearchInput label={t("approvals.filters.search")} value={value.search ?? ""} onChange={(e) => set({ search: e.target.value || undefined })} />
      <FormSelect
        label={t("approvals.filters.type")}
        className="[&_label]:sr-only"
        name="type"
        value={value.type ?? ""}
        placeholder={t("approvals.filters.everyType")}
        options={(types.data ?? []).map((x) => ({ value: x.code, label: format.pick(x.name) }))}
        onChange={(e) => set({ type: e.target.value || undefined })}
      />
      {statuses && (
        <FormSelect
          label={t("approvals.filters.status")}
          className="[&_label]:sr-only"
          name="status"
          value={value.status ?? ""}
          placeholder={t("approvals.filters.everyStatus")}
          options={Object.entries(STATUS_GROUPS).map(([key, codes]) => ({ value: codes, label: t(`approvals.filters.statuses.${key}`) }))}
          onChange={(e) => set({ status: e.target.value || undefined })}
        />
      )}
    </div>
  );
}
