import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { announcementsApi, type RsvpAnswer } from "@/api/announcements";
import { cn } from "@/design/cn";
import { useFormat } from "@/lib/useFormat";

const ANSWERS: RsvpAnswer[] = ["yes", "maybe", "no"];

/** Going / maybe / not going to a company event (task 20), the counts, and who (for the organisers). */
export function EventRsvp({ event, past }: { event: number; past?: boolean }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const rsvp = useQuery({ queryKey: ["rsvp", event], queryFn: () => announcementsApi.rsvp(event) });
  const answer = useMutation({ mutationFn: (a: RsvpAnswer) => announcementsApi.answer(event, a), onSuccess: (data) => queryClient.setQueryData(["rsvp", event], data) });
  const data = rsvp.data;
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <div role="group" aria-label={t("rsvp.label")} className="flex flex-wrap gap-1.5">
        {ANSWERS.map((a) => (
          <button key={a} type="button" aria-pressed={data?.mine === a} disabled={past || answer.isPending} onClick={() => answer.mutate(a)}
            className={cn("cursor-pointer rounded-full border px-3 py-1 text-sm disabled:cursor-default disabled:opacity-60", data?.mine === a ? "border-navy bg-navy text-white" : "border-line bg-white text-ink hover:bg-neutral-soft")}>
            {t(`rsvp.answers.${a}`)} <span className="num opacity-70">{data ? format.number(data.counts[a]) : ""}</span>
          </button>
        ))}
      </div>
      {data?.people && data.people.length > 0 && (
        <p className="text-xs text-muted">{ANSWERS.filter((a) => data.people!.some((p) => p.answer === a)).map((a) => `${t(`rsvp.answers.${a}`)}: ${data.people!.filter((p) => p.answer === a).map((p) => format.name(p)).join("\u060C ")}`).join(" · ")}</p>
      )}
    </div>
  );
}
