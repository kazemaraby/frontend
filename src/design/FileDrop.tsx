import { FileUp, X } from "lucide-react";
import { type DragEvent, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ACCEPTED_FILES, checkFile, MAX_FILE_BYTES, type ValidationCode } from "@/lib/validators";
import { useFormat } from "@/lib/useFormat";

import { IconButton } from "./Button";
import { cn } from "./cn";
import { FieldMessage } from "./Field";

type Props = {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
  /** Name of the file already stored (shown until a new one is chosen). */
  current?: string;
  error?: string | null;
  className?: string;
  /** File types offered by the picker and the check that runs on the chosen file (default: PDF / JPEG / PNG). */
  accept?: string;
  check?: (file: File) => Promise<ValidationCode | null>;
  /** Shown under the box before a file is chosen. */
  limits?: string;
};

/** Pick or drop one PDF / JPEG / PNG (checked here like the backend does: type by content, size limit). */
export function FileDrop({
  label,
  file,
  onChange,
  current,
  error,
  className,
  accept = ACCEPTED_FILES,
  check = checkFile,
  limits,
}: Props) {
  const { t } = useTranslation();
  const format = useFormat();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  async function take(candidate: File | undefined) {
    if (!candidate) return;
    const code = await check(candidate);
    if (code) {
      setProblem(t(`validation.${code}`, { mb: MAX_FILE_BYTES / (1024 * 1024) }));
      onChange(null);
      return;
    }
    setProblem(null);
    onChange(candidate);
  }

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setOver(false);
    void take(event.dataTransfer.files[0]);
  }

  const message = error ?? problem;
  const shown = file?.name ?? current;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        ref={input}
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        aria-describedby={`${id}-message`}
        onChange={(e) => {
          void take(e.target.files?.[0]);
          e.target.value = ""; // choosing the same file again still fires onChange
        }}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          className={cn(
            "flex min-h-14 flex-1 cursor-pointer items-center gap-3 rounded-tile border border-dashed px-4 py-3 text-start text-sm transition-colors",
            over ? "border-teal-dark bg-teal-soft" : message ? "border-danger" : "border-line-strong bg-white hover:bg-neutral-soft",
          )}
        >
          <FileUp aria-hidden="true" className="size-5 shrink-0 text-teal-dark" />
          <span className="min-w-0 flex-1">
            {shown ? (
              <span className="block truncate font-medium text-ink">{shown}</span>
            ) : (
              <span className="text-muted">{t("fileDrop.choose")}</span>
            )}
            <span className="num block text-xs text-muted">
              {file
                ? t("fileDrop.size", { kb: format.number(Math.max(1, Math.round(file.size / 1024))) })
                : (limits ?? t("fileDrop.limits", { mb: MAX_FILE_BYTES / (1024 * 1024) }))}
            </span>
          </span>
        </button>
        {file && <IconButton size="sm" variant="plain" label={t("fileDrop.remove")} icon={<X />} onClick={() => onChange(null)} />}
      </div>
      <FieldMessage id={`${id}-message`} error={message} />
    </div>
  );
}
