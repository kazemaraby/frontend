import { Pencil, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import { Avatar } from "./Avatar";
import { IconButton } from "./Button";
import { cn } from "./cn";
import { Checkbox } from "./Field";

export type Column<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Applied to both the header and the cells of the column. */
  className?: string;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Screen-reader caption. */
  caption: string;
  selectable?: boolean;
  selected?: ReadonlySet<string>;
  onSelectedChange?: (keys: Set<string>) => void;
  rowLabel?: (row: T) => string;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  /** Below this width the table scrolls sideways instead of squeezing. */
  minWidth?: number;
  empty?: ReactNode;
  /** First load: shows a loading row instead of "no results". */
  loading?: boolean;
};

/** Each row is its own white rounded card. Checkbox column first, edit/delete actions last. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  selectable,
  selected: controlled,
  onSelectedChange,
  rowLabel,
  onEdit,
  onDelete,
  minWidth = 880,
  empty,
  loading = false,
}: Props<T>) {
  const { t } = useTranslation();
  const [internal, setInternal] = useState<Set<string>>(new Set());
  const selected = controlled ?? internal;
  const setSelected = (next: Set<string>) => (onSelectedChange ? onSelectedChange(next) : setInternal(next));

  const keys = rows.map(rowKey);
  const selectedOnPage = keys.filter((k) => selected.has(k)).length;
  const allSelected = keys.length > 0 && selectedOnPage === keys.length;

  function toggleAll() {
    const next = new Set(selected);
    keys.forEach((k) => (allSelected ? next.delete(k) : next.add(k)));
    setSelected(next);
  }

  function toggle(key: string) {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  }

  const hasActions = Boolean(onEdit || onDelete);
  const cell = "h-[60px] bg-white px-4 first:rounded-s-tile last:rounded-e-tile";

  return (
    // `relative` keeps the absolutely positioned sr-only labels inside the scroller; without it they escape
    // the overflow clip and widen the whole page on phones.
    <div className="relative -mx-1 overflow-x-auto px-1 pb-1">
      <table className="w-full border-separate border-spacing-y-2.5 text-[15px]" style={{ minWidth }}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-start text-sm text-muted">
            {selectable && (
              <th scope="col" className="w-12 px-4 pb-1 text-start font-normal">
                <Checkbox
                  label={t("common.selectAll")}
                  checked={allSelected}
                  indeterminate={selectedOnPage > 0 && !allSelected}
                  onChange={toggleAll}
                />
              </th>
            )}
            {columns.map((column) => (
              <th key={column.id} scope="col" className={cn("px-4 pb-1 text-start font-normal", column.className)}>
                {column.header}
              </th>
            ))}
            {hasActions && (
              <th scope="col" className="w-32 px-4 pb-1 text-start font-normal">
                {t("common.actions")}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length + (selectable ? 1 : 0) + (hasActions ? 1 : 0)} className={cn(cell, "text-center text-muted")}>
                {loading ? t("common.loading") : (empty ?? t("common.noResults"))}
              </td>
            </tr>
          )}
          {rows.map((row) => {
            const key = rowKey(row);
            const label = rowLabel?.(row) ?? key;
            return (
              <tr key={key} aria-selected={selectable ? selected.has(key) : undefined}>
                {selectable && (
                  <td className={cell}>
                    <Checkbox
                      label={t("common.selectRow", { name: label })}
                      checked={selected.has(key)}
                      onChange={() => toggle(key)}
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <td key={column.id} className={cn(cell, column.className)}>
                    {column.cell(row)}
                  </td>
                ))}
                {hasActions && (
                  <td className={cell}>
                    <div className="flex items-center gap-1.5">
                      {onEdit && (
                        <IconButton
                          size="sm"
                          variant="plain"
                          icon={<Pencil />}
                          label={t("common.editNamed", { name: label })}
                          onClick={() => onEdit(row)}
                        />
                      )}
                      {onDelete && (
                        <IconButton
                          size="sm"
                          variant="danger"
                          icon={<Trash2 />}
                          label={t("common.deleteNamed", { name: label })}
                          onClick={() => onDelete(row)}
                        />
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Avatar + name, the usual second column. */
export function PersonCell({ name, subtitle }: { name: string; subtitle?: ReactNode }) {
  return (
    <span className="flex items-center gap-3">
      <Avatar name={name} />
      <span className="min-w-0">
        <span className="block truncate font-medium text-ink">{name}</span>
        {subtitle && <span className="block truncate text-sm text-muted">{subtitle}</span>}
      </span>
    </span>
  );
}
