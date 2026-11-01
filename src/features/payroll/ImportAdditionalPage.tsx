import { useTranslation } from "react-i18next";

import { ImportScreen } from "@/features/imports/ImportPage";

/** /payroll/import-additional — the month's additional salaries from Excel (apps.payroll.import_additional). */
export default function ImportAdditionalPage() {
  const { t } = useTranslation();
  return (
    <ImportScreen
      kind="additional_salaries"
      title={t("additional.importTitle")}
      templateNote={t("additional.templateNote")}
      done={{ to: "/payroll?tab=additional", label: t("additional.back") }}
    />
  );
}
