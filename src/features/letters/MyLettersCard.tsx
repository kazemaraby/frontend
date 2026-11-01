import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";

import { type Letter, letters } from "@/api/letters";
import { useScopeKey } from "@/auth/session";
import { IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { Pill } from "@/design/Pill";
import { openFile } from "@/features/employees/download";
import { useFormat } from "@/lib/useFormat";

export function letterTitle(format: ReturnType<typeof useFormat>, letter: Letter) {
  return format.pick({ ar: letter.title_ar, en: letter.title_en || letter.title_ar });
}

export function LetterStatus({ letter }: { letter: Letter }) {
  const { t } = useTranslation();
  return <Pill tone={letter.status === "valid" ? "green" : "salmon"}>{t(`letters.status.${letter.status}`)}</Pill>;
}

/** The user's own issued letters, with the PDF. */
export function MyLettersCard() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const mine = useQuery({ queryKey: ["letters", "mine", ...scope], queryFn: () => letters.list() });
  const rows = mine.data?.results ?? [];
  const columns: Column<Letter>[] = [
    {
      id: "letter",
      header: t("letters.letter"),
      cell: (l) => (
        <span className="flex flex-col">
          <span className="font-semibold text-ink">{letterTitle(format, l)}</span>
          <span className="num text-sm text-muted" dir="ltr">{l.reference}</span>
        </span>
      ),
    },
    { id: "issued", header: t("letters.issuedOn"), cell: (l) => <span className="num text-muted">{format.date(l.issued_on)}</span> },
    { id: "status", header: t("approvals.columns.status"), cell: (l) => <LetterStatus letter={l} /> },
    {
      id: "actions",
      header: <span className="sr-only">{t("common.actions")}</span>,
      cell: (l) => <IconButton size="sm" variant="plain" label={t("letters.download", { reference: l.reference })} icon={<Download />} onClick={() => void openFile(() => letters.link(l.id))} />,
    },
  ];
  if (!mine.isPending && rows.length === 0) return null;
  return (
    <Card variant="solid" title={t("letters.mine")}>
      <DataTable caption={t("letters.mine")} columns={columns} rows={rows} rowKey={(l) => String(l.id)} loading={mine.isPending} empty={t("letters.none")} minWidth={560} />
    </Card>
  );
}
