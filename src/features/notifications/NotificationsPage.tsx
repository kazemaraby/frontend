import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { type AppNotification, endpoints } from "@/api";
import { useSession } from "@/auth/session";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { cn } from "@/design/cn";
import { Pagination } from "@/design/Pagination";
import { Tabs } from "@/design/Tabs";
import { Page } from "@/layout/Page";
import { useFormat } from "@/lib/useFormat";

const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const { t } = useTranslation();
  const format = useFormat();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { company, selectCompany } = useSession();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [page, setPage] = useState(1);
  const list = useQuery({
    queryKey: ["notifications", "page", filter, page],
    queryFn: () => endpoints.notifications({ page, page_size: PAGE_SIZE, unread: filter === "unread" ? 1 : undefined }),
    placeholderData: keepPreviousData,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });
  const readAll = useMutation({ mutationFn: endpoints.markAllRead, onSuccess: refresh });

  function open(n: AppNotification) {
    if (!n.read) void endpoints.markRead(n.id).then(refresh);
    if (n.company && n.company !== company?.id) selectCompany(n.company, null);
    if (n.url) navigate(n.url);
  }

  const total = list.data?.count ?? 0;
  return (
    <Page
      title={t("notifications.title")}
      tabs={
        <Tabs
          label={t("notifications.title")}
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setPage(1);
          }}
          items={[
            { id: "all", label: t("notifications.all") },
            { id: "unread", label: t("notifications.unreadTab") },
          ]}
        />
      }
      actions={
        <Button variant="outline" onClick={() => readAll.mutate()} disabled={readAll.isPending}>
          {t("notifications.markAllRead")}
        </Button>
      }
    >
      <Card>
        {list.isPending ? (
          <p className="text-muted">{t("common.loading")}</p>
        ) : (list.data?.results.length ?? 0) === 0 ? (
          <p className="py-8 text-center text-muted">{t("topbar.noNotifications")}</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {list.data!.results.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => open(n)}
                  className="flex w-full cursor-pointer items-start gap-3 rounded-tile bg-white px-5 py-4 text-start transition-shadow hover:shadow-soft"
                >
                  <span aria-hidden="true" className={cn("mt-2 size-2.5 shrink-0 rounded-full", n.read ? "bg-line" : "bg-teal-dark")} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-ink", !n.read && "font-semibold")}>{format.pick({ ar: n.title_ar, en: n.title_en })}</span>
                    {(n.body_ar || n.body_en) && <span className="mt-1 block text-sm text-muted">{format.pick({ ar: n.body_ar, en: n.body_en })}</span>}
                  </span>
                  <span className="num shrink-0 text-sm text-subtle">{format.relative(n.created_at)}</span>
                  {!n.read && <span className="sr-only">{t("notifications.unread")}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))} onPageChange={setPage} />
      </Card>
    </Page>
  );
}
