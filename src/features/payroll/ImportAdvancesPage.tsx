import { useTranslation } from "react-i18next";

import { ImportScreen } from "@/features/imports/ImportPage";

/** /payroll/import-advances — advances running before the system, from Excel (apps.payroll.import_advances). */
export default function ImportAdvancesPage() {
  const { t } = useTranslation();
  return <ImportScreen kind="opening_advances" title={t("advances.importTitle")} templateNote={t("advances.templateNote")} done={{ to: "/employees", label: t("imports.openEmployees") }} />;
}
