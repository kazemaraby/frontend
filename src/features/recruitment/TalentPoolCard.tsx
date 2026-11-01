import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type Candidate, candidateDataApi, openings, pipelineApi } from "@/api/recruitment";
import { useScopeKey, useSession } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { Dialog } from "@/design/Dialog";
import { CheckField, FormSelect, SearchInput, TextField } from "@/design/Field";
import { Pagination } from "@/design/Pagination";
import { Pill } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

import { ApplicationDialog, STAGE_TONES } from "./PipelineBoard";

const PAGE_SIZE = 25;

/** Candidates (#120): everyone in the user's scope, or only the talent pool (those who agreed to be considered for
 * other jobs, while that consent holds). Recruiters tag them, merge a person's duplicate records and add a pooled
 * candidate to another opening. */
export function TalentPoolCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const { can } = useSession();
  const scope = useScopeKey();
  const manage = can("recruitment.manage");
  const [pool, setPool] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [tagging, setTagging] = useState<Candidate | null>(null);
  const [adding, setAdding] = useState<Candidate | null>(null);
  const [merging, setMerging] = useState<Candidate | null>(null);
  const [application, setApplication] = useState<number | null>(null);
  const [erasing, setErasing] = useState<Candidate | null>(null);
  const list = useQuery({
    queryKey: ["candidates", pool, search, page, ...scope],
    queryFn: () => pipelineApi.candidates({ pool: pool ? "1" : undefined, search: search || undefined, page }),
    placeholderData: (previous) => previous,
  });
  const columns: Column<Candidate>[] = [
    {
      id: "name",
      header: t("recruitment.pool.candidate"),
      cell: (c) => (
        <span className="flex flex-col">
          <span className="font-semibold text-ink">{c.full_name}</span>
          <span className="text-sm text-muted" dir="ltr">
            {c.email}
          </span>
        </span>
      ),
    },
    {
      id: "tags",
      header: t("recruitment.pool.tags"),
      cell: (c) => (
        <span className="flex flex-wrap gap-1">
          {c.tags.length ? c.tags.map((tag) => <Pill key={tag} tone="teal">{tag}</Pill>) : "—"}
        </span>
      ),
    },
    {
      id: "applications",
      header: t("recruitment.pool.applications"),
      cell: (c) => (
        <span className="flex flex-col gap-1">
          {c.applications.slice(0, 3).map((a) => (
            <button key={a.id} type="button" onClick={() => setApplication(a.id)} className="flex items-center gap-2 text-start text-sm hover:underline">
              {format.lang === "en" ? a.opening.title_en || a.opening.title_ar : a.opening.title_ar}
              <Pill tone={STAGE_TONES[a.stage]}>{t(`recruitment.stages.${a.stage}`)}</Pill>
            </button>
          ))}
        </span>
      ),
    },
    { id: "last", header: t("recruitment.pool.lastActivity"), cell: (c) => <span className="num text-sm">{c.last_activity_at ? format.date(c.last_activity_at) : "—"}</span> },
    {
      id: "erase",
      header: t("recruitment.pool.eraseOn"),
      cell: (c) => <span className="num text-sm">{c.protected ? t("recruitment.pool.kept") : format.date(c.erase_on)}</span>,
    },
    ...(manage
      ? [
          {
            id: "actions",
            header: t("common.actions"),
            cell: (c: Candidate) => (
              <span className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setTagging(c)}>
                  {t("recruitment.pool.editTags")}
                </Button>
                {c.talent_pool && (
                  <Button size="sm" variant="outline" onClick={() => setAdding(c)}>
                    {t("recruitment.pool.addToOpening")}
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setMerging(c)}>
                  {t("recruitment.pool.duplicates")}
                </Button>
                {!c.protected && (
                  <Button size="sm" variant="ghost" onClick={() => setErasing(c)}>
                    {t("recruitment.pool.erase")}
                  </Button>
                )}
              </span>
            ),
          },
        ]
      : []),
  ];
  const count = list.data?.count ?? 0;
  return (
    <Card
      title={t("recruitment.pool.title")}
      subtitle={t("recruitment.pool.subtitle")}
      action={
        <div className="flex flex-wrap items-center gap-3">
          <CheckField
            label={t("recruitment.pool.onlyPool")}
            checked={pool}
            onChange={(e) => {
              setPool(e.target.checked);
              setPage(1);
            }}
          />
          <SearchInput
            label={t("recruitment.pool.search")}
            className="w-64"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      }
    >
      <DataTable caption={t("recruitment.pool.title")} columns={columns} rows={list.data?.results ?? []} rowKey={(c) => String(c.id)} loading={list.isPending} empty={t("recruitment.pool.empty")} />
      {count > PAGE_SIZE && <Pagination page={page} pageCount={Math.ceil(count / PAGE_SIZE)} onPageChange={setPage} />}
      {tagging && <TagsDialog candidate={tagging} onClose={() => setTagging(null)} />}
      {adding && <AddDialog candidate={adding} onClose={() => setAdding(null)} />}
      {merging && <MergeDialog candidate={merging} onClose={() => setMerging(null)} />}
      {application !== null && <ApplicationDialog id={application} onClose={() => setApplication(null)} />}
      {erasing && <EraseDialog candidate={erasing} onClose={() => setErasing(null)} />}
    </Card>
  );
}

function TagsDialog({ candidate, onClose }: { candidate: Candidate; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [text, setText] = useState(candidate.tags.join(t("common.listSeparator")));
  const save = useMutation({
    mutationFn: () =>
      pipelineApi.setTags(
        candidate.id,
        text.split(/[,\u060C]/).map((tag) => tag.trim()).filter(Boolean),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["candidates"] });
      onClose();
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={`${t("recruitment.pool.editTags")} · ${candidate.full_name}`}
      footer={
        <Button variant="accent" disabled={save.isPending} onClick={() => save.mutate()}>
          {t("common.save")}
        </Button>
      }
    >
      <TextField label={t("recruitment.pool.tags")} hint={t("recruitment.pool.tagsHint")} name="tags" value={text} onChange={(e) => setText(e.target.value)} error={apiErrors(save.error, "").fields.tags} />
    </Dialog>
  );
}

function AddDialog({ candidate, onClose }: { candidate: Candidate; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ["openings", "open"], queryFn: () => openings.list({ status: "draft,published" }) });
  const [opening, setOpening] = useState("");
  const save = useMutation({
    mutationFn: () => pipelineApi.addToOpening(candidate.id, Number(opening)),
    onSuccess: async () => {
      await Promise.all(["candidates", "applications", "openings"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      onClose={onClose}
      title={`${t("recruitment.pool.addToOpening")} · ${candidate.full_name}`}
      footer={
        <Button variant="accent" disabled={!opening || save.isPending} onClick={() => save.mutate()}>
          {t("recruitment.pool.add")}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <FormSelect label={t("recruitment.pipeline.opening")} name="opening" placeholder={t("common.choose")} value={opening} onChange={(e) => setOpening(e.target.value)} options={(list.data?.results ?? []).map((o) => ({ value: String(o.id), label: format.lang === "en" ? o.title_en || o.title_ar : o.title_ar }))} error={errors.fields.opening} />
        {(errors.fields.detail || errors.general) && <Alert>{errors.fields.detail ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

function MergeDialog({ candidate, onClose }: { candidate: Candidate; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const found = useQuery({ queryKey: ["candidate-duplicates", candidate.id], queryFn: () => pipelineApi.duplicates(candidate.id) });
  const merge = useMutation({
    mutationFn: (drop: number) => pipelineApi.merge(candidate.id, drop),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["candidates"] });
      onClose();
    },
  });
  const errors = apiErrors(merge.error, t("common.saveFailed"));
  return (
    <Dialog open onClose={onClose} title={`${t("recruitment.pool.duplicates")} · ${candidate.full_name}`}>
      <div className="flex flex-col gap-3">
        {found.isPending ? (
          <p className="text-muted">{t("common.loading")}</p>
        ) : (found.data ?? []).length === 0 ? (
          <p className="text-muted">{t("recruitment.pool.noDuplicates")}</p>
        ) : (
          <>
            <p className="text-sm text-muted">{t("recruitment.pool.mergeHint", { name: candidate.full_name })}</p>
            {found.data!.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-card bg-neutral-soft p-3">
                <span className="flex flex-col text-sm">
                  <span className="font-semibold">{d.full_name}</span>
                  <span dir="ltr" className="text-muted">
                    {d.email} · {d.phone}
                  </span>
                </span>
                <Button size="sm" variant="outline" disabled={merge.isPending} onClick={() => merge.mutate(d.id)}>
                  {t("recruitment.pool.merge")}
                </Button>
              </div>
            ))}
          </>
        )}
        {(errors.fields.detail || errors.general) && <Alert>{errors.fields.detail ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}

function EraseDialog({ candidate, onClose }: { candidate: Candidate; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const erase = useMutation({
    mutationFn: () => candidateDataApi.erase(candidate.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["candidates"] });
      onClose();
    },
  });
  const errors = apiErrors(erase.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      onClose={onClose}
      title={`${t("recruitment.pool.erase")} · ${candidate.full_name}`}
      footer={
        <Button variant="primary" disabled={erase.isPending} onClick={() => erase.mutate()}>
          {t("recruitment.pool.eraseConfirm")}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <p>{t("recruitment.pool.eraseBody")}</p>
        {(errors.fields.detail || errors.general) && <Alert>{errors.fields.detail ?? errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
