import { useQuery } from "@tanstack/react-query";
import { FileText, MessageSquare, Search, User } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { hr } from "@/api/hr";
import { useScopeKey } from "@/auth/session";
import { cn } from "@/design/cn";
import { useDebounced } from "@/lib/useDebounced";
import { useFormat } from "@/lib/useFormat";

type Option = { key: string; group: "employees" | "documents" | "requests"; icon: ReactNode; label: string; detail: string; to: string };

/** Top-bar search (#7): employees, documents and requests the user may see (the API checks each kind against its
 * own permission). Combobox pattern: arrows move, Enter opens, Escape closes. */
export function GlobalSearch({ className, autoFocus, onDone }: { className?: string; autoFocus?: boolean; onDone?: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const navigate = useNavigate();
  const scopeKey = useScopeKey();
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const q = useDebounced(text.trim());
  const results = useQuery({
    queryKey: ["search", ...scopeKey, q],
    queryFn: ({ signal }) => hr.search(q, signal),
    enabled: q.length >= 2,
    staleTime: 30_000,
  });

  const data = results.data;
  const options: Option[] = [
    ...(data?.employees ?? []).map((e) => ({
      key: `e${e.id}`,
      group: "employees" as const,
      icon: <User className="size-4" />,
      label: format.name(e),
      detail: [e.employee_no, e.job_title && format.pick(e.job_title)].filter(Boolean).join(" · "),
      to: `/employees/${e.id}`,
    })),
    ...(data?.documents ?? []).map((d) => ({
      key: `d${d.id}`,
      group: "documents" as const,
      icon: <FileText className="size-4" />,
      label: `${format.pick(d.document_type)} · ${d.number}`,
      detail: format.name(d.employee),
      to: `/employees/${d.employee.id}?tab=documents`,
    })),
    ...(data?.requests ?? []).map((r) => ({
      key: `r${r.id}`,
      group: "requests" as const,
      icon: <MessageSquare className="size-4" />,
      label: format.pick({ ar: r.title_ar, en: r.title_en }),
      detail: t(`requestStatus.${r.status}`, { defaultValue: r.status }),
      to: `/approvals?tab=mine&request=${r.id}`,
    })),
  ];

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  function go(option: Option | undefined) {
    if (!option) return;
    setOpen(false);
    setText("");
    onDone?.();
    navigate(option.to);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (options.length ? (i + step + options.length) % options.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(options[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const showList = open && q.length >= 2;
  return (
    <div ref={root} className={cn("relative", className)}>
      <label className="relative flex h-11 items-center">
        <span className="sr-only">{t("topbar.search")}</span>
        <Search aria-hidden="true" className="pointer-events-none absolute start-4 size-[18px] text-muted" />
        <input
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && options[active] ? `${listId}-${options[active].key}` : undefined}
          autoFocus={autoFocus}
          value={text}
          placeholder={t("topbar.searchPlaceholder")}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="h-full w-full rounded-full border-0 bg-white ps-11 pe-4 text-[15px] text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-teal-dark/30"
        />
      </label>
      {showList && (
        <div className="absolute start-0 top-full z-50 mt-2 w-[min(26rem,calc(100vw-2rem))] rounded-tile bg-white p-2 shadow-pop">
          <ul id={listId} role="listbox" aria-label={t("search.results")} className="max-h-[60dvh] overflow-y-auto">
            {results.isFetching && !data && <li className="px-3 py-3 text-sm text-muted">{t("common.loading")}</li>}
            {data && options.length === 0 && <li className="px-3 py-3 text-sm text-muted">{t("search.none", { q })}</li>}
            {options.map((option, index) => (
              <li key={option.key} role="presentation">
                {(index === 0 || options[index - 1].group !== option.group) && (
                  <p role="presentation" className="px-3 pb-1 pt-2 text-xs font-semibold text-muted">
                    {t(`search.groups.${option.group}`)}
                  </p>
                )}
                <div
                  id={`${listId}-${option.key}`}
                  role="option"
                  aria-selected={index === active}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => go(option)}
                  onPointerMove={() => setActive(index)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2",
                    index === active ? "bg-neutral-soft" : "hover:bg-neutral-soft",
                  )}
                >
                  <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-teal-soft text-teal-dark">
                    {option.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{option.label}</span>
                    {option.detail && <span className="num block truncate text-xs text-muted">{option.detail}</span>}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
