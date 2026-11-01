import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, TriangleAlert } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";

import { type ApplicationDetail, openings, pipelineApi, REJECTIONS, type Stage, STAGES } from "@/api/recruitment";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { Dialog } from "@/design/Dialog";
import { CheckField, FormSelect, SearchInput, TextArea } from "@/design/Field";
import { Pill, type PillTone } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

import { ApplicationInterviews } from "./Interviews";
import { ApplicationOffers } from "./Offers";

export const STAGE_TONES: Record<Stage, PillTone> = { applied: "sky", screening: "lavender", interview: "orange", offer: "teal", hired: "green", rejected: "salmon", withdrawn: "neutral" };
/** Stages a recruiter moves an application to by hand; offer and hired have their own steps. */
const MOVABLE: Stage[] = ["applied", "screening", "interview", "rejected", "withdrawn"];

/** The applicant pipeline (#116): one column per stage for the chosen opening; a card opens the application. */
export function PipelineBoard() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const list = useQuery({ queryKey: ["openings", ...scope], queryFn: () => openings.list({}) });
  const choices = list.data?.results ?? [];
  const chosen = Number(params.get("opening")) || choices.find((o) => o.status === "published")?.id || choices[0]?.id || null;
  const applications = useQuery({
    queryKey: ["applications", chosen, search, ...scope],
    queryFn: () => pipelineApi.applications({ opening: chosen!, search: search || undefined, page_size: 200 }),
    enabled: Boolean(chosen),
  });
  const rows = applications.data?.results ?? [];
  const title = (o: { title_ar: string; title_en: string }) => (format.lang === "en" ? o.title_en || o.title_ar : o.title_ar);
  return (
    <Card
      title={t("recruitment.pipeline.title")}
      action={
        <div className="flex flex-wrap items-end gap-2">
          <FormSelect
            label={t("recruitment.pipeline.opening")}
            name="opening"
            className="w-64"
            value={chosen ? String(chosen) : ""}
            onChange={(e) => setParams({ tab: "pipeline", opening: e.target.value }, { replace: true })}
            options={choices.map((o) => ({ value: String(o.id), label: `${title(o)} · ${t(`recruitment.openings.statuses.${o.status}`)}` }))}
          />
          <SearchInput label={t("recruitment.pipeline.search")} className="w-56" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      }
    >
      {!chosen ? (
        <p className="text-muted">{t("recruitment.openings.empty")}</p>
      ) : (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
          {STAGES.map((stage) => {
            const cards = rows.filter((a) => a.stage === stage);
            return (
              <section key={stage} aria-label={t(`recruitment.stages.${stage}`)} className="flex w-60 shrink-0 flex-col gap-2 rounded-card bg-neutral-soft p-3">
                <h3 className="flex items-center justify-between text-sm font-semibold">
                  {t(`recruitment.stages.${stage}`)}
                  <Pill tone={STAGE_TONES[stage]}>{format.number(cards.length)}</Pill>
                </h3>
                {cards.map((a) => (
                  <button key={a.id} type="button" onClick={() => setOpen(a.id)} className="flex flex-col gap-1 rounded-tile bg-white p-3 text-start shadow-soft hover:ring-2 hover:ring-teal-soft">
                    <span className="font-semibold text-ink">{a.candidate.full_name}</span>
                    <span className="num text-xs text-muted">
                      {format.date(a.created_at)} · {t(`recruitment.sources.${a.source}`)}
                    </span>
                    {a.matched_on && <span className="text-xs text-amber-800">{t("recruitment.pipeline.returning")}</span>}
                  </button>
                ))}
              </section>
            );
          })}
        </div>
      )}
      {open !== null && <ApplicationDialog id={open} onClose={() => setOpen(null)} />}
    </Card>
  );
}

export function ApplicationDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const { can } = useSession();
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ["application", id], queryFn: () => pipelineApi.application(id) });
  const [to, setTo] = useState<Stage | "">("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [tell, setTell] = useState(true);
  const refresh = async (data: ApplicationDetail) => {
    queryClient.setQueryData(["application", id], data);
    await queryClient.invalidateQueries({ queryKey: ["applications"] });
    await queryClient.invalidateQueries({ queryKey: ["openings"] });
  };
  const move = useMutation({
    mutationFn: () => pipelineApi.move(id, { stage: to as Stage, reason, note, tell: to === "rejected" && tell }),
    onSuccess: async (data) => {
      // cleared at once: the next move may be chosen while the lists reload
      setTo("");
      setReason("");
      setNote("");
      await refresh(data);
    },
  });
  const take = useMutation({ mutationFn: (fields: string[]) => pipelineApi.take(id, fields), onSuccess: refresh });
  const cv = useMutation({ mutationFn: () => pipelineApi.cv(id), onSuccess: (link) => window.open(`${link.url}?inline=1`, "_blank", "noopener") });
  const a = detail.data;
  const errors = apiErrors(move.error, t("common.saveFailed"));
  const manage = can("recruitment.manage");
  return (
    <Dialog open onClose={onClose} size="lg" title={a ? a.candidate.full_name : t("common.loading")}>
      {!a ? (
        <p className="text-muted">{detail.isError ? t("common.loadFailed") : t("common.loading")}</p>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={STAGE_TONES[a.stage]} size="md">
              {t(`recruitment.stages.${a.stage}`)}
            </Pill>
            {a.employee && (
              <Link to={`/employees/${a.employee.id}`} className="text-sm font-medium text-teal-dark hover:underline">
                {t("recruitment.hire.employeeFile", { no: a.employee.employee_no })}
              </Link>
            )}
            {a.rejection_reason && <span className="text-sm text-muted">{t(`recruitment.rejections.${a.rejection_reason}`)}</span>}
            {a.has_cv && (
              <Button size="sm" variant="outline" icon={<FileText className="size-4" />} iconPosition="start" disabled={cv.isPending} onClick={() => cv.mutate()}>
                {t("recruitment.pipeline.cv")}
              </Button>
            )}
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {(
              [
                ["email", <span key="e" dir="ltr">{a.candidate.email}</span>],
                ["phone", <span key="p" dir="ltr" className="num">{a.candidate.phone}</span>],
                ["nationality", a.candidate.nationality ? format.name(a.candidate.nationality) : "—"],
                ["city", a.candidate.city || "—"],
                ...(a.candidate.id_number !== undefined ? [["id_number", <span key="i" dir="ltr" className="num">{a.candidate.id_number || "—"}</span>]] : []),
                ...(a.candidate.expected_salary !== undefined ? [["expected_salary", <span key="s" className="num">{a.candidate.expected_salary ?? "—"}</span>]] : []),
               ] as [string, ReactNode][]
            ).map(([key, value]) => (
              <div key={key}>
                <dt className="text-muted">{t(`careers.fields.${key}`)}</dt>
                <dd className="font-medium text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          {a.matched_on && (
            <Alert tone="warning">
              <span className="flex flex-col gap-2">
                <span>{t("recruitment.pipeline.matched", { on: t(`recruitment.pipeline.matchedOn.${a.matched_on}`) })}</span>
                {manage && a.candidate.id_number !== undefined && (
                  <Button size="sm" variant="outline" className="self-start" disabled={take.isPending} onClick={() => take.mutate(["full_name", "phone", "city", "nationality", "id_number", "expected_salary"])}>
                    {t("recruitment.pipeline.takeTyped")}
                  </Button>
                )}
              </span>
            </Alert>
          )}
          {a.duplicates.length > 0 && (
            <p className="flex items-center gap-2 text-sm text-amber-800">
              <TriangleAlert aria-hidden="true" className="size-4" /> {t("recruitment.pipeline.duplicates", { count: a.duplicates.length })}
            </p>
          )}
          {a.answers.length > 0 && (
            <section aria-label={t("recruitment.pipeline.answers")} className="flex flex-col gap-2">
              <h3 className="font-semibold">{t("recruitment.pipeline.answers")}</h3>
              {a.answers.map((q) => (
                <p key={q.key} className="text-sm">
                  <span className="text-muted">{format.lang === "en" ? q.text_en || q.text_ar : q.text_ar}: </span>
                  <span className="font-medium">{q.kind === "yes_no" && q.answer ? t(`common.${q.answer}`) : q.answer || "—"}</span>
                </p>
              ))}
            </section>
          )}
          {a.cover_letter && <p className="whitespace-pre-line rounded-card bg-neutral-soft p-3 text-sm">{a.cover_letter}</p>}
          <section aria-label={t("recruitment.pipeline.history")} className="flex flex-col gap-2">
            <h3 className="font-semibold">{t("recruitment.pipeline.history")}</h3>
            <ol className="flex flex-col gap-1 text-sm">
              {a.events.map((e, i) => (
                <li key={i} className="flex flex-wrap gap-x-2">
                  <span className="num text-muted">{format.date(e.at, "short")}</span>
                  <span className="font-medium">{t(`recruitment.stages.${e.to}`)}</span>
                  {e.by && <span className="text-muted">· {format.name(e.by)}</span>}
                  {e.reason && <span>· {t(`recruitment.rejections.${e.reason}`)}</span>}
                  {e.note && <span>· {e.note}</span>}
                  {e.told && <span className="text-muted">· {t("recruitment.pipeline.told")}</span>}
                </li>
              ))}
            </ol>
          </section>
          <ApplicationInterviews applicationId={a.id} closed={["rejected", "withdrawn", "hired"].includes(a.stage)} />
          <ApplicationOffers applicationId={a.id} stage={a.stage} />
          {manage && a.stage !== "hired" && (
            <section aria-label={t("recruitment.pipeline.move")} className="flex flex-col gap-3 rounded-card bg-neutral-soft p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <FormSelect label={t("recruitment.pipeline.moveTo")} name="stage" placeholder={t("common.choose")} value={to} onChange={(e) => setTo(e.target.value as Stage)} options={MOVABLE.filter((s) => s !== a.stage && (a.stage !== "offer" || s === "rejected" || s === "withdrawn")).map((s) => ({ value: s, label: t(`recruitment.stages.${s}`) }))} error={errors.fields.stage} />
                {to === "rejected" && <FormSelect label={t("recruitment.pipeline.reason")} name="reason" placeholder={t("common.choose")} value={reason} onChange={(e) => setReason(e.target.value)} options={REJECTIONS.map((r) => ({ value: r, label: t(`recruitment.rejections.${r}`) }))} error={errors.fields.reason} />}
              </div>
              <TextArea label={t("recruitment.pipeline.note")} name="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} error={errors.fields.note} />
              {to === "rejected" && <CheckField label={t("recruitment.pipeline.tell")} checked={tell} onChange={(e) => setTell(e.target.checked)} />}
              {errors.general && <Alert>{errors.general}</Alert>}
              <Button variant="accent" className="self-start" disabled={!to || move.isPending} onClick={() => move.mutate()}>
                {t("recruitment.pipeline.moveButton")}
              </Button>
            </section>
          )}
        </div>
      )}
    </Dialog>
  );
}
