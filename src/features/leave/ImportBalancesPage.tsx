import { useTranslation } from "react-i18next";

import { ImportScreen } from "@/features/imports/ImportPage";

/** /settings/leave/import — opening leave balances from Excel (apps.leave.import_balances). */
export default function ImportBalancesPage() {
  const { t } = useTranslation();
  return (
    <ImportScreen
      kind="leave_opening"
      title={t("leaveTab.import.title")}
      templateNote={t("leaveTab.import.templateNote")}
      done={{ to: "/employees", label: t("imports.openEmployees") }}
    />
  );
}
