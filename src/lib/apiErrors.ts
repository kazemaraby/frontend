import { ApiError } from "@/api";

export type FormErrors = { fields: Record<string, string>; general: string | null };

/** DRF error bodies → one message per field + a general message.
 * {"iban": ["…"]} → fields.iban; {"detail": "…"} / {"code", "detail"} / non_field_errors → general. */
export function apiErrors(error: unknown, fallback: string): FormErrors {
  const result: FormErrors = { fields: {}, general: null };
  if (!(error instanceof ApiError)) return error ? { ...result, general: fallback } : result;
  const body = error.body;
  if (body && typeof body === "object" && !Array.isArray(body)) {
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      const message = Array.isArray(value) ? String(value[0] ?? "") : typeof value === "string" ? value : "";
      if (!message || key === "code") continue;
      if (key === "detail" || key === "non_field_errors") result.general = message;
      else result.fields[key] = message;
    }
  } else if (Array.isArray(body) && body.length) {
    result.general = String(body[0]);
  }
  if (!result.general && !Object.keys(result.fields).length) result.general = fallback;
  return result;
}
