import { useTranslation } from "react-i18next";

import { ImportScreen } from "@/features/imports/ImportPage";

/** /attendance/import-people — which employee each device person is, from Excel (apps.attendance.import_device_users). */
export default function ImportPeoplePage() {
  const { t } = useTranslation();
  return <ImportScreen kind="device_users" title={t("devices.importTitle")} templateNote={t("devices.importNote")} done={{ to: "/attendance?tab=devices", label: t("devices.backToDevices") }} />;
}
