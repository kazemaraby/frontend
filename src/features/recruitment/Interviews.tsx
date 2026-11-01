import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, FileText, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type Interview, type InterviewBody, type InterviewKind, interviewsApi, type Person, type Recommendation, RECOMMENDATIONS, type Scorecards } from "@/api/recruitment";
import { useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Dialog } from "@/design/Dialog";
import { CheckField, FormSelect, SearchInput, TextArea, TextField } from "@/design/Field";
import { Pill, type PillTone } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { saveFile } from "@/lib/saveFile";
import { useFormat } from "@/lib/useFormat";

const KINDS: InterviewKind[] = ["in_person", "video", "phone"];
const STATUS_TONES: Record<Interview["status"], PillTone> = { scheduled: "sky", done: "green", cancelled: "neutral" };
const REC_TONES: Record<Recommendation, PillTone> = { strong_yes: "green", yes: "teal", no: "orange", strong_no: "salmon" };

/** "2026-11-03T10:30" in the browser's time for a datetime-local field. */
function localInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The interviews of one application (#117), inside the application: schedule, change, cancel; the scorecards the
 * user may read and their summary. */
export function ApplicationInterviews({ applicationId, closed }: { applicationId: number; closed: boolean }) {
  const { t } = useTranslation();
  const format = useFormat();
  const { can } = useSession();
  const queryClient = useQueryClient();
  const manage = can("recruitment.manage");
  const [editing, setEditing] = useState<Interview | "new" | null>(null);
  const list = useQuery({ queryKey: ["interviews", "application", applicationId], queryFn: () => interviewsApi.list({ application: applicationId }) });
  const rows = list.data?.results ?? [];
  const first = rows[0];
  const cards = useQuery({ queryKey: ["scorecards", applicationId], queryFn: () => interviewsApi.scorecards(first!.id), enabled: Boolean(first) });
  const cancel = useMutation({
    mutationFn: (id: number) => interviewsApi.cancel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["interviews"] }),
  });
  return (
    <section aria-label={t("recruitment.interviews.title")} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{t("recruitment.interviews.title")}</h3>
        {manage && !closed && (
          <Button size="sm" variant="outline" icon={<CalendarPlus className="size-4" />} iconPosition="start" onClick={() => setEditing("new")}>
            {t("recruitment.interviews.schedule")}
          </Button>
        )}
      </div>
      {rows.length === 0 && <p className="text-sm text-muted">{t("recruitment.interviews.none")}</p>}
      {rows.map((i) => (
        <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-card bg-neutral-soft p-3 text-sm">
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">
              {t("recruitment.interviews.round", { round: format.number(i.round) })} · <span className="num">{format.date(i.starts_at, "short")} {format.time(new Date(i.starts_at).toTimeString().slice(0, 5))}</span> · {t(`recruitment.interviews.kinds.${i.kind}`)}
            </span>
            <span className="text-muted">{i.info.interviewers.map((p) => format.name(p)).join(t("common.listSeparator"))}</span>
          </span>
          <span className="flex items-center gap-2">
            <Pill tone={STATUS_TONES[i.status]}>{t(`recruitment.interviews.statuses.${i.status}`)}</Pill>
            {manage && i.status === "scheduled" && (
              <>
                <Button size="sm" variant="ghost" onClick={() => setEditing(i)}>
                  {t("common.edit")}
                </Button>
                <Button size="sm" variant="ghost" disabled={cancel.isPending} onClick={() => cancel.mutate(i.id)}>
                  {t("recruitment.interviews.cancel")}
                </Button>
              </>
            )}
          </span>
        </div>
      ))}
      {cards.data && <ScorecardsSummary data={cards.data} />}
      {editing !== null && <ScheduleDialog applicationId={applicationId} row={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

export function ScorecardsSummary({ data }: { data: Scorecards }) {
  const { t } = useTranslation();
  const format = useFormat();
  if (data.hidden_until_you_score) return <Alert tone="info">{t("recruitment.interviews.hidden")}</Alert>;
  if (data.summary.count === 0) return null;
  const s = data.summary;
  return (
    <div aria-label={t("recruitment.interviews.scores")} role="group" className="flex flex-col gap-2 rounded-card border border-line p-3 text-sm">
      <p className="flex flex-wrap items-center gap-2 font-semibold">
        {t("recruitment.interviews.overall")} <span className="num">{s.overall ? `${format.number(s.overall, [0, 2])} / 5` : "—"}</span>
        {(Object.entries(s.recommendations) as [Recommendation, number][]).map(([r, n]) => (
          <Pill key={r} tone={REC_TONES[r]}>
            {t(`recruitment.interviews.recommendations.${r}`)} × {format.number(n)}
          </Pill>
        ))}
      </p>
      {s.criteria.map((c) => (
        <p key={c.key} className="flex justify-between gap-2">
          <span>{format.lang === "en" ? c.text_en || c.text_ar : c.text_ar}</span>
          <span className="num">{c.average ? format.number(c.average, [0, 2]) : "—"}</span>
        </p>
      ))}
      {data.cards.map((card) => (
        <p key={card.id} className="text-muted">
          {format.name(card.interviewer)} · {t(`recruitment.interviews.recommendations.${card.recommendation}`)}
          {card.comments && ` · ${card.comments}`}
        </p>
      ))}
    </div>
  );
}

function ScheduleDialog({ applicationId, row, onClose }: { applicationId: number; row: Interview | null; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const templates = useQuery({ queryKey: ["interview-templates"], queryFn: interviewsApi.templates });
  const [v, setV] = useState<InterviewBody>(
    row
      ? { kind: row.kind, starts_at: localInput(row.starts_at), minutes: row.minutes, location: row.location, link: row.link, template: row.template, interviewers: row.interviewers, invite_candidate: row.candidate_invited }
      : { kind: "in_person", starts_at: "", minutes: 45, location: "", link: "", template: null, interviewers: [], invite_candidate: false },
  );
  const [chosen, setChosen] = useState<Person[]>(row?.info.interviewers ?? []);
  const [search, setSearch] = useState("");
  const people = useQuery({ queryKey: ["interview-people", search], queryFn: () => interviewsApi.people(search), enabled: search.trim().length >= 2 });
  const save = useMutation({
    mutationFn: () => {
      const body = { ...v, starts_at: new Date(v.starts_at).toISOString(), interviewers: chosen.map((p) => p.id) };
      return row ? interviewsApi.update(row.id, body) : interviewsApi.create({ ...body, application: applicationId });
    },
    onSuccess: async () => {
      await Promise.all(["interviews", "applications", "application"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      onClose={onClose}
      title={row ? t("recruitment.interviews.change") : t("recruitment.interviews.schedule")}
      footer={
        <Button variant="accent" disabled={save.isPending || !v.starts_at || chosen.length === 0} onClick={() => save.mutate()}>
          {t("recruitment.interviews.send")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("recruitment.interviews.startsAt")} name="starts_at" type="datetime-local" dir="ltr" value={v.starts_at} onChange={(e) => setV({ ...v, starts_at: e.target.value })} error={errors.fields.starts_at} />
          <TextField label={t("recruitment.interviews.minutes")} name="minutes" type="number" min={10} max={480} dir="ltr" value={String(v.minutes)} onChange={(e) => setV({ ...v, minutes: Number(e.target.value) || 45 })} error={errors.fields.minutes} />
          <FormSelect label={t("recruitment.interviews.kind")} name="kind" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value as InterviewKind })} options={KINDS.map((k) => ({ value: k, label: t(`recruitment.interviews.kinds.${k}`) }))} />
          <FormSelect label={t("recruitment.interviews.template")} name="template" placeholder={t("common.choose")} value={v.template ?? ""} onChange={(e) => setV({ ...v, template: e.target.value ? Number(e.target.value) : null })} options={(templates.data?.results ?? []).filter((x) => x.is_active).map((x) => ({ value: String(x.id), label: format.name(x) }))} error={errors.fields.template} />
        </div>
        {v.kind === "video" ? (
          <TextField label={t("recruitment.interviews.link")} name="link" dir="ltr" value={v.link} onChange={(e) => setV({ ...v, link: e.target.value })} error={errors.fields.link} />
        ) : (
          <TextField label={t("recruitment.interviews.location")} name="location" value={v.location} onChange={(e) => setV({ ...v, location: e.target.value })} />
        )}
        <div className="flex flex-col gap-2">
          <SearchInput label={t("recruitment.interviews.findInterviewer")} value={search} onChange={(e) => setSearch(e.target.value)} />
          {(people.data ?? [])
            .filter((p) => !chosen.some((c) => c.id === p.id))
            .slice(0, 6)
            .map((p) => (
              <button key={p.id} type="button" className="rounded-tile px-3 py-1.5 text-start text-sm hover:bg-neutral-soft" onClick={() => setChosen([...chosen, p])}>
                {format.name(p)} <span className="text-muted" dir="ltr">{p.email}</span>
              </button>
            ))}
          <div role="list" aria-label={t("recruitment.interviews.interviewers")} className="flex flex-wrap gap-2">
            {chosen.map((p) => (
              <span role="listitem" key={p.id} className="inline-flex items-center gap-1 rounded-full bg-teal-soft py-1 ps-3 pe-1 text-sm">
                {format.name(p)}
                <IconButton size="sm" variant="plain" label={t("common.delete")} icon={<X className="size-3.5" />} onClick={() => setChosen(chosen.filter((c) => c.id !== p.id))} />
              </span>
            ))}
          </div>
          {errors.fields.interviewers && <p className="text-sm text-danger">{errors.fields.interviewers}</p>}
        </div>
        <CheckField label={t("recruitment.interviews.inviteCandidate")} checked={Boolean(v.invite_candidate)} onChange={(e) => setV({ ...v, invite_candidate: e.target.checked })} />
        {(errors.fields.detail || errors.general) && <Alert>{errors.fields.detail ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

/** An interviewer's own scorecard for one interview: criteria on the template's scale, a recommendation, comments.
 * Locked once sent; the others' scores appear after. */
export function ScorecardForm({ interview }: { interview: Interview }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const template = interview.info.template;
  const mine = interview.info.my_scorecard;
  const [scores, setScores] = useState<Record<string, number>>({});
  const [recommendation, setRecommendation] = useState<Recommendation | "">("");
  const [comments, setComments] = useState("");
  const submit = useMutation({
    mutationFn: () => interviewsApi.submit(interview.id, { scores, recommendation: recommendation as Recommendation, comments }),
    onSuccess: () => Promise.all(["interviews", "scorecards"].map((key) => queryClient.invalidateQueries({ queryKey: [key] }))),
  });
  const cards = useQuery({ queryKey: ["scorecards", "interview", interview.id], queryFn: () => interviewsApi.scorecards(interview.id), enabled: Boolean(mine?.submitted_at) });
  const errors = apiErrors(submit.error, t("common.saveFailed"));
  if (mine?.submitted_at) return cards.data ? <ScorecardsSummary data={cards.data} /> : null;
  if (new Date(interview.starts_at) > new Date()) return <p className="text-sm text-muted">{t("recruitment.interviews.scoreAfter")}</p>;
  const top = template?.scale_max ?? 5;
  const complete = recommendation && (template?.criteria ?? []).every((c) => scores[c.key!]);
  return (
    <section aria-label={t("recruitment.interviews.myScorecard")} className="flex flex-col gap-3 rounded-card bg-neutral-soft p-4">
      {(template?.criteria ?? []).map((c) => (
        <FormSelect
          key={c.key}
          label={format.lang === "en" ? c.text_en || c.text_ar : c.text_ar}
          name={`score_${c.key}`}
          placeholder={t("common.choose")}
          value={scores[c.key!] ? String(scores[c.key!]) : ""}
          onChange={(e) => setScores({ ...scores, [c.key!]: Number(e.target.value) })}
          options={Array.from({ length: top }, (_, n) => ({ value: String(n + 1), label: format.number(n + 1) }))}
        />
      ))}
      <FormSelect label={t("recruitment.interviews.recommendation")} name="recommendation" placeholder={t("common.choose")} value={recommendation} onChange={(e) => setRecommendation(e.target.value as Recommendation)} options={RECOMMENDATIONS.map((r) => ({ value: r, label: t(`recruitment.interviews.recommendations.${r}`) }))} error={errors.fields.recommendation} />
      <TextArea label={t("recruitment.interviews.comments")} name="comments" rows={3} value={comments} onChange={(e) => setComments(e.target.value)} />
      <p className="text-sm text-muted">{t("recruitment.interviews.lockedHint")}</p>
      {(errors.fields.scores || errors.fields.detail || errors.general) && <Alert>{errors.fields.scores ?? errors.fields.detail ?? errors.general}</Alert>}
      <Button variant="accent" className="self-start" disabled={!complete || submit.isPending} onClick={() => submit.mutate()}>
        {t("recruitment.interviews.submit")}
      </Button>
    </section>
  );
}

/** The calendar file and the CV of an interview, for the people in it. */
export function InterviewFiles({ interview }: { interview: Interview }) {
  const { t } = useTranslation();
  const ics = useMutation({ mutationFn: () => interviewsApi.ics(interview.id), onSuccess: saveFile });
  const cv = useMutation({ mutationFn: () => interviewsApi.cv(interview.id), onSuccess: (link) => window.open(`${link.url}?inline=1`, "_blank", "noopener") });
  return (
    <span className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" icon={<CalendarPlus className="size-4" />} iconPosition="start" disabled={ics.isPending} onClick={() => ics.mutate()}>
        {t("recruitment.interviews.addToCalendar")}
      </Button>
      {interview.info.has_cv && (
        <Button size="sm" variant="outline" icon={<FileText className="size-4" />} iconPosition="start" disabled={cv.isPending} onClick={() => cv.mutate()}>
          {t("recruitment.pipeline.cv")}
        </Button>
      )}
    </span>
  );
}
