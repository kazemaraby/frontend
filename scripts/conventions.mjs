// The rules behind check-conventions.mjs, importable so they can be tested (conventions.test.mjs).

// Utilities that have a logical twin. Matched as whole class tokens, optionally behind variants (md:, hover:, -).
const V = String.raw`[^\s"'\x60{},]+`; // the value part of a class (stops at quotes, braces, commas)
export const PHYSICAL = new RegExp(
  String.raw`(?:^|[\s"'\x60{])(?:[\w-]+:)*-?(` +
    [
      String.raw`m[lr]-` + V,
      String.raw`p[lr]-` + V,
      String.raw`left-` + V,
      String.raw`right-` + V,
      String.raw`border-[lr](?:-` + V + ")?",
      String.raw`rounded-(?:[lr]|[tb][lr])(?:-` + V + ")?",
      String.raw`scroll-[mp][lr]-` + V,
      String.raw`(?:text|float|clear)-(?:left|right)`,
    ].join("|") +
    String.raw`)(?=[\s"'\x60}]|$)`,
  "g",
);

const ARABIC = /[؀-ۿ]/;
const COMMENT_LINE = /^\s*(\/\/|\/\*|\*)/;

/** The code part of a line ("" for comment lines). Comments may quote Arabic UI text or say "right-to-left". */
export function codeOf(line) {
  if (line.includes("conventions-ignore") || COMMENT_LINE.test(line)) return "";
  return line.replace(/\s\/\/.*$/, "").replace(/\{\/\*.*?\*\/\}/g, "");
}

export function physicalClasses(line) {
  return [...codeOf(line).matchAll(PHYSICAL)].map((m) => m[1]);
}

/** Arabic is allowed only in translation files and sample data. */
export function hasArabicInCode(line, file) {
  if (/src\/(i18n|mocks)\//.test(file)) return false;
  return ARABIC.test(codeOf(line));
}

export const PLURAL = /_(zero|one|two|few|many|other)$/;

export function flattenKeys(obj, prefix = "") {
  return Object.entries(obj).flatMap(([key, value]) =>
    value && typeof value === "object" ? flattenKeys(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

/** Keys without plural suffixes, so "inDays_one"/"inDays_other" count as "inDays". */
export const baseKeys = (obj) => new Set(flattenKeys(obj).map((k) => k.replace(PLURAL, "")));

export const T_CALL = /\bt\(\s*["']([\w.-]+)["']/g;
