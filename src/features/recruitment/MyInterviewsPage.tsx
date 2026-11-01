import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { interviewsApi } from "@/api/recruitment";
import { useScopeKey } from "@/auth/session";
import { Card } from "@/design/Card";
import { Pill } from "@/design/Pill";
import { Page } from "@/layout/Page";
import { useFormat } from "@/lib/useFormat";

import { InterviewFiles, ScorecardForm } from "./Interviews";

/** /interviews — the interviews the user takes part in (#117), for anyone in the company: when, where, the
 * candidate's CV, the calendar file, and their scorecard (the others' scores appear once theirs is sent). */
export default function MyInterviewsPage() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const list = useQuery({ queryKey: ["interviews", "mine", ...scope], queryFn: () => interviewsApi.list({ mine: "1", page_size: 100 }) });
  const rows = (list.data?.results ?? []).filter((i) => i.status !== "cancelled");
  return (
    <Page title={t("recruitment.interviews.mine")}>
      <div className="flex flex-col gap-4">
        {list.isPending && <p className="text-muted">{t("common.loading")}</p>}
        {list.isSuccess && rows.length === 0 && (
          <Card>
            <p className="text-muted">{t("recruitment.interviews.noneMine")}</p>
          </Card>
        )}
        {rows.map((i) => (
          <Card key={i.id} title={`${i.info.candidate} · ${format.lang === "en" ? i.info.opening.title_en || i.info.opening.title_ar : i.info.opening.title_ar}`} subtitle={t("recruitment.interviews.round", { round: format.number(i.round) })} action={<InterviewFiles interview={i} />}>
            <div className="flex flex-col gap-4">
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <span className="num font-medium">
                  {format.date(i.starts_at)} · {format.time(new Date(i.starts_at).toTimeString().slice(0, 5))}
                </span>
                <Pill tone="sky">{t(`recruitment.interviews.kinds.${i.kind}`)}</Pill>
                {i.kind === "video" && i.link ? (
                  <a href={i.link} target="_blank" rel="noreferrer" dir="ltr" className="text-teal-dark hover:underline">
                    {i.link}
                  </a>
                ) : (
                  i.location && <span>{i.location}</span>
                )}
              </p>
              <ScorecardForm interview={i} />
            </div>
          </Card>
        ))}
      </div>
    </Page>
  );
}
