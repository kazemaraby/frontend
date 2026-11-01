import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { selfService, type TicketBalance, type Usage } from "@/api/selfservice";
import { useScopeKey, useSession } from "@/auth/session";
import { Card } from "@/design/Card";
import { MyRequests } from "@/features/approvals/MyRequests";
import { RequestDetail } from "@/features/approvals/RequestDetail";
import { MyLettersCard } from "@/features/letters/MyLettersCard";
import { Page } from "@/layout/Page";
import { useFormat } from "@/lib/useFormat";

import { NewRequestMenu } from "./composer";

/** /requests — self-service: this month's use of the limits (permissions #51, remote work #54) and the ticket
 * balance, the user's requests of every type (filter, open, correct a returned one) and their issued letters.
 * "طلب جديد" starts any request (the composer, also on /approvals and through `?new=<kind>`). */
export default function SelfServicePage() {
  const { t } = useTranslation();
  const scope = useScopeKey();
  const { me, hasModule } = useSession();
  const [openId, setOpenId] = useState<number | null>(null);
  const month = new Date().toLocaleDateString("en-CA").slice(0, 7);
  const usage = useQuery({
    queryKey: ["selfservice", "usage", month, ...scope],
    queryFn: () => selfService.usage(month),
    retry: false,
    enabled: Boolean(me?.employee), // the limits are an employee's
  });
  const tickets = useQuery({
    queryKey: ["selfservice", "tickets", ...scope],
    queryFn: () => selfService.ticketBalance(),
    retry: false,
    enabled: Boolean(me?.employee),
  });

  return (
    <Page
      title={t("selfService.title")}
      actions={
        <>
          {hasModule("payroll") && me?.employee && (
            <Link to="/payslips" className="inline-flex h-11 items-center gap-2 rounded-full border border-line-strong bg-white px-5 text-[15px] text-ink hover:bg-neutral-soft">
              {t("payslips.title")}
            </Link>
          )}
          <NewRequestMenu />
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {usage.data && <UsageCards usage={usage.data} tickets={tickets.data} />}
        <Card variant="solid" title={t("selfService.mine")}>
          <MyRequests onOpen={setOpenId} />
        </Card>
        {me?.employee && <MyLettersCard />}
      </div>
      {openId && <RequestDetail id={openId} onClose={() => setOpenId(null)} />}
    </Page>
  );
}

function UsageCards({ usage, tickets }: { usage: Usage; tickets?: TicketBalance }) {
  const { t } = useTranslation();
  const format = useFormat();
  const cards = [
    { key: "permissions", used: usage.permissions.used, limit: usage.permissions.limit },
    { key: "hours", used: Number(usage.permission_hours.used), limit: Number(usage.permission_hours.limit) },
    { key: "remote", used: usage.remote_days.used, limit: usage.remote_days.limit },
  ];
  return (
    <ul aria-label={t("selfService.usage")} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <li key={c.key} className="rounded-panel bg-white p-5 shadow-soft">
          <p className="text-sm text-muted">{t(`selfService.usageCards.${c.key}`)}</p>
          <p className="num mt-2 text-2xl font-semibold text-ink">
            {format.number(c.used, [0, 2])} <span className="text-base font-normal text-muted">/ {format.number(c.limit, [0, 2])}</span>
          </p>
          <div className="mt-3 h-2 rounded-full bg-neutral-soft" role="progressbar" aria-valuemin={0} aria-valuemax={c.limit} aria-valuenow={c.used}>
            <div className="h-2 rounded-full bg-teal-dark" style={{ width: `${Math.min(100, c.limit ? (100 * c.used) / c.limit : 0)}%` }} />
          </div>
        </li>
      ))}
      {tickets?.policy && (
        <li className="rounded-panel bg-white p-5 shadow-soft">
          <p className="text-sm text-muted">{t("selfService.usageCards.tickets")}</p>
          <p className="num mt-2 text-2xl font-semibold text-ink">{format.number(Number(tickets.available), [0, 2])}</p>
          {tickets.next_due && <p className="mt-1 text-sm text-muted">{t("selfService.ticket.nextDue", { day: format.date(tickets.next_due) })}</p>}
        </li>
      )}
    </ul>
  );
}

