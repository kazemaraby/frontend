import { X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";

import { IconButton } from "./Button";
import { cn } from "./cn";

type Props = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** Buttons, shown at the end of the footer. */
  footer?: ReactNode;
  size?: "md" | "lg";
};

/** Modal on the native <dialog> element: the browser traps focus, Esc closes it, focus returns to the opener. */
export function Dialog({ open, onClose, title, children, footer, size = "md" }: Props) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-panel border-0 bg-white p-0 text-ink shadow-pop backdrop:bg-navy/40 backdrop:backdrop-blur-[2px]",
        size === "md" ? "max-w-lg" : "max-w-2xl",
      )}
    >
      {open && (
        <div className="flex max-h-[85dvh] flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-line px-6 py-4">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            <IconButton size="sm" variant="plain" tooltip={false} label={t("common.close")} icon={<X />} onClick={onClose} />
          </header>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
          {footer && <footer className="flex flex-wrap justify-end gap-2.5 border-t border-line px-6 py-4">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
