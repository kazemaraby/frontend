import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Dialog } from "@/design/Dialog";
import { FileDrop } from "@/design/FileDrop";
import { apiErrors } from "@/lib/apiErrors";

/** One file for a record (the signed contract, an insurance card). */
export function UploadDialog({
  title,
  current,
  upload,
  onClose,
}: {
  title: string;
  current?: string;
  upload: (file: File) => Promise<unknown>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const save = useMutation({ mutationFn: () => upload(file!), onSuccess: onClose });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!file || save.isPending} onClick={() => save.mutate()}>
            {t("common.upload")}
          </Button>
        </>
      }
    >
      <FileDrop label={t("documents.file")} file={file} onChange={setFile} current={current} error={errors.fields.file} />
      {errors.general && <Alert className="mt-4">{errors.general}</Alert>}
    </Dialog>
  );
}
