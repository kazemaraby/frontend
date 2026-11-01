import { useEffect } from "react";
import { Navigate } from "react-router";

import { useSession } from "@/auth/session";
import NoAccess from "@/features/misc/NoAccessPage";

/** /me: the signed-in user's own employee file (links in "your iqama expires" alerts). */
export default function MyFilePage() {
  const { me, company, selectCompany } = useSession();
  const mine = me?.employee;
  const elsewhere = Boolean(mine && company && company.id !== mine.company);
  useEffect(() => {
    if (elsewhere && mine) selectCompany(mine.company, null); // the file belongs to another of the user's companies
  }, [elsewhere, mine, selectCompany]);
  if (!mine) return <NoAccess />;
  if (elsewhere) return null;
  return <Navigate to={`/employees/${mine.id}`} replace />;
}
