import { ChevronDown, Search } from "lucide-react";
import {
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useEffect,
  useId,
  useRef,
} from "react";

import { cn } from "./cn";

/** Message under a form control; linked to it with aria-describedby. */
export function FieldMessage({ id, error, hint }: { id: string; error?: string | null; hint?: ReactNode }) {
  if (error) {
    return (
      <p id={id} className="text-xs font-medium text-danger">
        {error}
      </p>
    );
  }
  return hint ? (
    <p id={id} className="text-xs text-muted">
      {hint}
    </p>
  ) : null;
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  /** Element at the end of the input (e.g. show-password button). */
  trailing?: ReactNode;
  error?: string | null;
  hint?: ReactNode;
};

/** Labelled text input (forms). The label stays visible above the pill. */
export function TextField({ label, trailing, error, hint, id, className, dir, ...rest }: TextFieldProps) {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const messageId = `${inputId}-message`;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {label}
      </label>
      {/* The wrapper takes the input's direction too, so a trailing button sits at the end of an LTR field
          (email, password) even on an Arabic page instead of on top of the text. */}
      <div dir={dir} className="relative flex items-center">
        <input
          id={inputId}
          dir={dir}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? messageId : undefined}
          className={cn(
            "h-12 w-full rounded-full border bg-white ps-5 text-[15px] text-ink placeholder:text-subtle focus:border-teal-dark focus:outline-none",
            error ? "border-danger" : "border-line",
            trailing ? "pe-12" : "pe-5",
          )}
          {...rest}
        />
        {trailing && <span className="absolute end-1.5">{trailing}</span>}
      </div>
      <FieldMessage id={messageId} error={error} hint={hint} />
    </div>
  );
}

type FormSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: { value: string; label: string }[];
  /** Adds an empty first option ("— choose —"). */
  placeholder?: string;
  error?: string | null;
  hint?: ReactNode;
};

/** Select for forms: the label stays visible above it, like TextField. */
export function FormSelect({ label, options, placeholder, error, hint, id, className, ...rest }: FormSelectProps) {
  const fallbackId = useId();
  const selectId = id ?? fallbackId;
  const messageId = `${selectId}-message`;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={selectId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative flex items-center">
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? messageId : undefined}
          className={cn(
            "num h-12 w-full cursor-pointer appearance-none rounded-full border bg-white ps-5 pe-11 text-[15px] text-ink focus:border-teal-dark focus:outline-none",
            error ? "border-danger" : "border-line",
          )}
          {...rest}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute end-4 size-4 text-ink" />
      </div>
      <FieldMessage id={messageId} error={error} hint={hint} />
    </div>
  );
}

/** Checkbox with its label next to it (forms). */
export function CheckField({ label, className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string }) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2.5 text-[15px] text-ink", className)}>
      <input type="checkbox" className="size-[18px] cursor-pointer rounded border-line-strong accent-navy" {...rest} />
      {label}
    </label>
  );
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string; error?: string | null };

/** Labelled multi-line input (comments, request details). */
export function TextArea({ label, hint, error, id, className, ...rest }: TextAreaProps) {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <textarea
        id={inputId}
        rows={4}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${inputId}-message` : undefined}
        className={cn(
          "w-full resize-y rounded-tile border bg-white px-4 py-3 text-[15px] text-ink placeholder:text-subtle focus:border-teal-dark focus:outline-none",
          error ? "border-danger" : "border-line",
        )}
        {...rest}
      />
      <FieldMessage id={`${inputId}-message`} error={error} hint={hint} />
    </div>
  );
}

type SearchProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string };

/** Search pill: magnifier at the start, placeholder in grey. */
export function SearchInput({ label, className, ...rest }: SearchProps) {
  return (
    <label className={cn("relative flex h-11 items-center", className)}>
      <span className="sr-only">{label}</span>
      <Search aria-hidden="true" className="pointer-events-none absolute start-4 size-[18px] text-muted" />
      <input
        type="search"
        className="h-full w-full rounded-full border border-line bg-white ps-11 pe-4 text-[15px] text-ink placeholder:text-muted focus:border-teal-dark focus:outline-none"
        {...rest}
      />
    </label>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: { value: string; label: string }[];
};

/** Native select styled as a pill (keeps the platform picker on phones). */
export function Select({ label, options, className, ...rest }: SelectProps) {
  return (
    <label className={cn("relative inline-flex h-11 items-center", className)}>
      <span className="sr-only">{label}</span>
      <select
        className="num h-full w-full cursor-pointer appearance-none rounded-full border border-line bg-white ps-5 pe-11 text-[15px] text-ink focus:border-teal-dark focus:outline-none"
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute end-4 size-4 text-ink" />
    </label>
  );
}

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  indeterminate?: boolean;
};

export function Checkbox({ label, indeterminate = false, className, ...rest }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      className={cn("size-[18px] cursor-pointer rounded border-line-strong accent-navy", className)}
      {...rest}
    />
  );
}
