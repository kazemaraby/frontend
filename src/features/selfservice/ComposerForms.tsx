import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { leave } from "@/api/leave";
import { Alert } from "@/design/Alert";
import { Dialog } from "@/design/Dialog";
import { LetterRequestDialog } from "@/features/letters/LetterRequestDialog";
import { AskDialog } from "@/features/leave/LeavePage";
import { apiErrors } from "@/lib/apiErrors";

import type { ComposerKind } from "./composer";
import { AdvanceChangeDialog, AdvanceRequestDialog } from "./AdvanceDialogs";
import { CorrectionDialog } from "./CorrectionDialog";
import { ExitReentryDialog } from "./ExitReentryDialog";
import { ExpenseClaimDialog } from "./ExpenseClaimDialog";
import { GeneralRequestDialog } from "./GeneralRequestDialog";
import { OvertimeDialog } from "./OvertimeDialog";
import { ProfileUpdateDialog } from "./ProfileUpdateDialog";
import { ResignationDialog } from "./ResignationDialog";
import { ShortRequestDialog } from "./ShortRequestDialog";

/** The form of each kind (loaded on first use, so the forms stay out of the app's first download). */
export default function ComposerForms({ kind, editId, onClose }: { kind: ComposerKind; editId?: number; onClose: () => void }) {
  if (kind === "leave") return <LeaveForm editId={editId} onClose={onClose} />;
  if (kind === "letter") return <LetterRequestDialog editId={editId} onClose={onClose} />;
  if (kind === "profile") return <ProfileUpdateDialog editId={editId} onClose={onClose} />;
  if (kind === "general") return <GeneralRequestDialog editId={editId} onClose={onClose} />;
  if (kind === "correction") return <CorrectionDialog editId={editId} onClose={onClose} />;
  if (kind === "overtime") return <OvertimeDialog editId={editId} onClose={onClose} />;
  if (kind === "expense") return <ExpenseClaimDialog editId={editId} onClose={onClose} />;
  if (kind === "advance") return <AdvanceRequestDialog editId={editId} onClose={onClose} />;
  if (kind === "advance_change") return <AdvanceChangeDialog editId={editId} onClose={onClose} />;
  if (kind === "resignation") return <ResignationDialog editId={editId} onClose={onClose} />;
  if (kind === "exit_reentry") return <ExitReentryDialog editId={editId} onClose={onClose} />;
  return <ShortRequestDialog kind={kind} editId={editId} onClose={onClose} />;
}

function LeaveForm({ editId, onClose }: { editId?: number; onClose: () => void }) {
  const { t } = useTranslation();
  const stored = useQuery({ queryKey: ["leave", "request", editId], queryFn: () => leave.request(editId!), enabled: Boolean(editId) });
  if (!editId) return <AskDialog onClose={onClose} />;
  if (!stored.data)
    return (
      <Dialog open onClose={onClose} title={t("approvals.editAndResubmit")}>
        {stored.isError ? <Alert>{apiErrors(stored.error, t("common.loadFailed")).general}</Alert> : <p className="text-muted">{t("common.loading")}</p>}
      </Dialog>
    );
  return <AskDialog editing={stored.data} onClose={onClose} />;
}
