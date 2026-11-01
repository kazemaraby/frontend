import { useTranslation } from "react-i18next";

import { cn } from "./cn";

type Props = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** e.g. "عرض 1–7 من 150 موظفًا" */
  summary?: string;
  /** How many page numbers to show around the current one. */
  window?: number;
};

export function Pagination({ page, pageCount, onPageChange, summary, window = 3 }: Props) {
  const { t } = useTranslation();
  const size = Math.min(window, pageCount);
  const first = Math.min(Math.max(1, page - Math.floor(size / 2)), Math.max(1, pageCount - size + 1));
  const pages = Array.from({ length: size }, (_, i) => first + i);

  return (
    <nav aria-label={t("common.pagination")} className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <p className="num text-sm text-muted">{summary}</p>
      <ul className="flex items-center gap-2">
        {pages.map((n) => (
          <li key={n}>
            <button
              type="button"
              onClick={() => onPageChange(n)}
              aria-current={n === page ? "page" : undefined}
              aria-label={t("common.pageN", { page: n })}
              className={cn(
                "num size-10 cursor-pointer rounded-full text-sm font-medium transition-colors",
                n === page ? "bg-navy text-white" : "border border-line-strong bg-white text-ink hover:bg-neutral-soft",
              )}
            >
              {n}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
