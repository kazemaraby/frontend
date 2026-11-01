import { CalendarPlus, CircleCheck, Clock, FileText, Inbox, PackageCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import type { Dashboard } from "@/api/dashboard";
import { Card } from "@/design/Card";
import { type ComposerKind, useComposer } from "@/features/selfservice/composer";

/** What waits for the user (approvals, requests to correct, custody to confirm) and the requests they start most. */
export function QuickActions({ counts }: { counts: Dashboard["counts"] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const composer = useComposer();
  const waiting = [
    { id: "approvals", show: true, title: t("dashboard.myApprovals"), link: t("dashboard.viewApprovals", { count: counts.approvals }), icon: CircleCheck, to: "/approvals" },
    { id: "returned", show: counts.returned > 0, title: t("dashboard.toCorrect"), link: t("dashboard.requestsCount", { count: counts.returned }), icon: Inbox, to: "/requests" },
    { id: "custody", show: counts.custody_to_confirm > 0, title: t("dashboard.custodyToConfirm"), link: t("dashboard.itemsCount", { count: counts.custody_to_confirm }), icon: PackageCheck, to: "/custody" },
  ].filter((a) => a.show);
  const starters: { kind: ComposerKind; icon: typeof Clock }[] = [
    { kind: "leave", icon: CalendarPlus },
    { kind: "permission", icon: Clock },
    { kind: "letter", icon: FileText },
  ];
  const available = starters.filter((s) => composer.kinds.includes(s.kind));
  return (
    <Card title={t("dashboard.quickActions")}>
      <ul className="grid grid-cols-2 gap-3">
        {waiting.map((a) => (
          <li key={a.id}>
            <button type="button" onClick={() => navigate(a.to)} className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-card bg-white p-4 text-start transition-shadow hover:shadow-soft">
              <span className="min-w-0">
                <span className="block font-semibold text-ink">{a.title}</span>
                <span className="num mt-1 block text-sm font-medium text-teal-dark">{a.link}</span>
              </span>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-navy text-white">
                <a.icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
              </span>
            </button>
          </li>
        ))}
      </ul>
      {available.length > 0 && (
        <ul aria-label={t("dashboard.startRequest")} className="mt-3 flex flex-wrap gap-2">
          {available.map((s) => (
            <li key={s.kind}>
              <button type="button" onClick={() => composer.open(s.kind)} className="flex h-10 cursor-pointer items-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-ink transition-shadow hover:shadow-soft">
                <s.icon aria-hidden="true" className="size-4 text-teal-dark" />
                {t(`selfService.kinds.${s.kind}`)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
