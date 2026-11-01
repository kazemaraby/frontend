/** Saudi validation mirrored from backend/common/validators.py, so forms can say what is wrong before saving.
 * The backend stays the authority: these functions only catch typing mistakes early. Each returns the normalised
 * value, or an error code translated under "validation.<code>". */

export type Checked = { value: string; error: null } | { value: string; error: ValidationCode };
export type ValidationCode =
  | "id_format"
  | "id_prefix"
  | "id_type"
  | "id_checksum"
  | "iban_country"
  | "iban_format"
  | "iban_checksum"
  | "saudi_mobile"
  | "arabic_name"
  | "english_name"
  | "file_type"
  | "file_content"
  | "file_size"
  | "file_xlsx";

const ok = (value: string): Checked => ({ value, error: null });
const fail = (value: string, error: ValidationCode): Checked => ({ value, error });

/** Arabic-Indic (U+0660–0669) / Persian (U+06F0–06F9) digits → ASCII (people type them on Arabic keyboards). */
export function normalizeDigits(value: string): string {
  return value.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (ch) => String(ch.charCodeAt(0) & 0xf));
}

const compact = (value: string) => normalizeDigits(value ?? "").replace(/[\s-]/g, "");

// --- national ID / iqama / border number --------------------------------------------------------

export type IdType = "national_id" | "iqama" | "border_no";

export function luhnOk(digits: string): boolean {
  let total = 0;
  [...digits].reverse().forEach((ch, i) => {
    let n = Number(ch);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    total += n;
  });
  return total % 10 === 0;
}

export function idTypeOf(number: string): IdType | null {
  return ({ "1": "national_id", "2": "iqama", "3": "border_no", "4": "border_no" } as const)[number[0]] ?? null;
}

export function checkIdNumber(input: string, expected?: IdType | ""): Checked {
  const number = compact(input);
  if (!/^\d{10}$/.test(number)) return fail(number, "id_format");
  const kind = idTypeOf(number);
  if (kind === null) return fail(number, "id_prefix");
  if (expected && kind !== expected) return fail(number, "id_type");
  if ((kind === "national_id" || kind === "iqama") && !luhnOk(number)) return fail(number, "id_checksum");
  return ok(number);
}

// --- IBAN -----------------------------------------------------------------------------------------

/** ISO 13616 mod 97-10, computed piecewise so the 50-digit number never leaves safe integers. */
export function ibanChecksumOk(iban: string): boolean {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const digits = parseInt(ch, 36).toString();
    for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder === 1;
}

export function checkSaudiIban(input: string): Checked {
  const iban = compact(input).toUpperCase();
  if (!iban.startsWith("SA")) return fail(iban, "iban_country");
  if (!/^SA\d{2}\d{2}[0-9A-Z]{18}$/.test(iban)) return fail(iban, "iban_format");
  if (!ibanChecksumOk(iban)) return fail(iban, "iban_checksum");
  return ok(iban);
}

/** SAMA bank code of a Saudi IBAN (characters 5–6): "80" = Al Rajhi. */
export const ibanBankCode = (iban: string) => iban.slice(4, 6);

/** "SA03 8000 0000 6080 1016 7519". */
export const formatIban = (iban: string) => iban.replace(/(.{4})(?=.)/g, "$1 ");

// --- phones ---------------------------------------------------------------------------------------

/** Saudi mobiles in any common spelling → +9665XXXXXXXX. Other numbers are left to the backend (libphonenumber). */
export function checkSaudiMobile(input: string): Checked {
  let digits = normalizeDigits(input ?? "").replace(/[\s\-()]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("966")) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (/^5\d{8}$/.test(digits)) return ok(`+966${digits}`);
  return fail(input, "saudi_mobile");
}

// --- names ----------------------------------------------------------------------------------------

const ARABIC_LETTER = /[\u0621-\u064A]/; // hamza … yeh: the same range as the backend
const LATIN_LETTER = /[A-Za-z]/;

export function checkArabicName(value: string): Checked {
  if (value && (!ARABIC_LETTER.test(value) || LATIN_LETTER.test(value))) return fail(value, "arabic_name");
  return ok(value);
}

export function checkEnglishName(value: string): Checked {
  if (value && (!LATIN_LETTER.test(value) || ARABIC_LETTER.test(value))) return fail(value, "english_name");
  return ok(value);
}

// --- files (common/files.py) -----------------------------------------------------------------------

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_FILES = ".pdf,.jpg,.jpeg,.png";
const SIGNATURES: Record<string, number[]> = {
  pdf: [0x25, 0x50, 0x44, 0x46, 0x2d], // %PDF-
  jpg: [0xff, 0xd8, 0xff],
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
};

/** PDF, JPEG or PNG up to 10 MB, checked by the first bytes (like the backend), not only the name. */
export async function checkFile(file: Blob & { name: string }): Promise<ValidationCode | null> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const signature = SIGNATURES[ext];
  if (!signature) return "file_type";
  if (file.size > MAX_FILE_BYTES) return "file_size";
  const head = new Uint8Array(await file.slice(0, signature.length).arrayBuffer());
  return signature.every((byte, i) => head[i] === byte) ? null : "file_content";
}

/** An Excel workbook (.xlsx, a zip file: "PK\x03\x04") up to 10 MB — for imports. */
export async function checkSpreadsheet(file: Blob & { name: string }): Promise<ValidationCode | null> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) return "file_xlsx";
  if (file.size > MAX_FILE_BYTES) return "file_size";
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return [0x50, 0x4b, 0x03, 0x04].every((byte, i) => head[i] === byte) ? null : "file_xlsx";
}
