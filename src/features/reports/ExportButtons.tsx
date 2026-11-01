import { useMutation } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { ExportFormat } from "@/api/index";
import { Button } from "@/design/Button";
import { apiErrors } from "@/lib/apiErrors";
import { saveFile } from "@/lib/saveFile";

/** Excel and PDF of a report (Phase 6 task 17): `download` asks the report's endpoint for that format. */
export function ExportButtons({ download, disabled }: { download: (as: ExportFormat) => Promise<{ blob: Blob; filename: string }>; disabled?: boolean }) {
  const { t } = useTranslation();
  const exporting = useMutation({ mutationFn: async (as: ExportFormat) => saveFile(await download(as)) });
  return (
    <span className="flex flex-wrap items-center gap-2">
      {(["xlsx", "pdf"] as const).map((as) => (
        <Button key={as} size="sm" variant="outline" icon={<Download className="size-4" />} disabled={disabled || exporting.isPending} aria-label={t(`exports.${as}Label`)} onClick={() => exporting.mutate(as)}>
          {t(`exports.${as}`)}
        </Button>
      ))}
      {exporting.isPending && <span className="text-sm text-muted">{t("reports.exporting")}</span>}
      {exporting.error && <span role="alert" className="text-sm text-danger">{apiErrors(exporting.error, t("reports.exportFailed")).general}</span>}
    </span>
  );
}
