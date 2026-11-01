import { useQuery } from "@tanstack/react-query";
import { Pin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import { announcementsApi } from "@/api/announcements";
import { useScopeKey } from "@/auth/session";
import { Card, CardLink } from "@/design/Card";
import { Pill } from "@/design/Pill";
import { useFormat } from "@/lib/useFormat";

/** The dashboard's announcements (task 20): the latest ones for the user, pinned first, unread marked. */
export function AnnouncementsWidget() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const navigate = useNavigate();
  const list = useQuery({ queryKey: ["announcements", "current", ...scope], queryFn: () => announcementsApi.list(true) });
  const rows = (list.data?.results ?? []).slice(0, 4);
  if (!list.isPending && rows.length === 0) return null;
  return (
    <Card title={t("announcements.title")} action={<CardLink onClick={() => navigate("/announcements")}>{t("announcements.all")}</CardLink>}>
      <ul className="flex flex-col gap-2">
        {rows.map((a) => (
          <li key={a.id} className="rounded-tile bg-white px-3 py-2">
            <Link to={`/announcements/${a.id}`} className="flex items-start justify-between gap-2 font-medium text-ink hover:underline">
              <span className="flex items-center gap-1.5">{a.pinned && <Pin aria-hidden="true" className="size-3.5 text-teal-dark" />}{format.pick({ ar: a.title_ar, en: a.title_en || a.title_ar })}</span>
              {!a.info.read_at ? <Pill tone="sky">{t("announcements.new")}</Pill> : a.requires_ack && !a.info.acknowledged_at ? <Pill tone="amber">{t("announcements.toConfirm")}</Pill> : null}
            </Link>
            <p className="num text-xs text-muted">{format.date(a.publish_at)}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
