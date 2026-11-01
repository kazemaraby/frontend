import { useMutation } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";

import { exportsApi } from "@/api/reports";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { Page } from "@/layout/Page";
import { saveFile } from "@/lib/saveFile";

/** /reports/files/:token — a scheduled report's link from its e-mail (task 17): signed in, only its recipient gets
 * the file, until the link expires. */
export default function ReportFilePage() {
  const { t } = useTranslation();
  const { token = "" } = useParams();
  const download = useMutation({ mutationFn: async () => saveFile(await exportsApi.file(token)) });
  const { mutate } = download;
  useEffect(() => mutate(), [mutate]);
  return (
    <Page title={t("reportFile.title")}>
      <Card className="flex flex-col items-center gap-4 py-12 text-center">
        {download.isError ? (
          <p role="alert" className="text-danger">{t("reportFile.gone")}</p>
        ) : (
          <p role="status" className="text-muted">{download.isSuccess ? t("reportFile.done") : t("reportFile.downloading")}</p>
        )}
        {!download.isError && (
          <Button variant="outline" icon={<Download className="size-4" />} disabled={download.isPending} onClick={() => download.mutate()}>
            {t("reportFile.again")}
          </Button>
        )}
      </Card>
    </Page>
  );
}
