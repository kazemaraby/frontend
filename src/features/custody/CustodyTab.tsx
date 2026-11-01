import { useTranslation } from "react-i18next";

import { type Employee, holds } from "@/api";

import { CustodyRecords, OutstandingTiles } from "./CustodyRecords";

/** The employee file's custody tab: what they hold and owe, and the records; HR hands over and receives here. */
export function CustodyTab({ employee }: { employee: Employee }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      <OutstandingTiles employee={employee.id} />
      <CustodyRecords employee={employee} manage={holds(employee, "selfservice.manage_custody")} title={t("custody.records")} />
    </div>
  );
}
