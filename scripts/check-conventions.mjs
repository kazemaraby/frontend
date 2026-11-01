// Fails the build when code breaks the CLAUDE.md frontend conventions:
//  1. physical direction utilities (ml-, pr-, left-, text-right, rounded-l…) instead of logical ones
//  2. Arabic text inside components (user-facing strings belong in src/i18n; mock data in src/mocks)
//  3. ar.json and en.json do not have the same keys
//  4. a literal t("key") that is missing from either language file
// The rules live in conventions.mjs (tested in conventions.test.mjs).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { T_CALL, baseKeys, hasArabicInCode, physicalClasses } from "./conventions.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const src = join(root, "src");

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const files = walk(src).filter((f) => /\.(tsx?|css)$/.test(f) && !/\.test\.tsx?$/.test(f));
const problems = [];
const report = (file, line, message) => problems.push(`${relative(root, file)}:${line}  ${message}`);

for (const file of files) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      for (const cls of physicalClasses(line)) {
        report(file, i + 1, `physical utility "${cls}": use ms-/me-/ps-/pe-/start-/end-/rounded-s-/text-start…`);
      }
      if (hasArabicInCode(line, relative(root, file))) {
        report(file, i + 1, "Arabic text in code: move it to src/i18n/ar.json (or src/mocks for sample data)");
      }
    });
}

const load = (lang) => JSON.parse(readFileSync(join(src, "i18n", `${lang}.json`), "utf8"));
const ar = baseKeys(load("ar"));
const en = baseKeys(load("en"));
for (const key of ar) if (!en.has(key)) problems.push(`src/i18n/en.json  missing key "${key}"`);
for (const key of en) if (!ar.has(key)) problems.push(`src/i18n/ar.json  missing key "${key}"`);

for (const file of files.filter((f) => /\.tsx?$/.test(f))) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      for (const [, key] of line.matchAll(T_CALL)) {
        if (!ar.has(key)) report(file, i + 1, `t("${key}") has no translation in ar.json/en.json`);
      }
    });
}

if (problems.length) {
  console.error(`Convention check failed (${problems.length}):\n  ` + problems.join("\n  "));
  process.exit(1);
}
console.log(`Convention check passed (${files.length} files, ${ar.size} i18n keys).`);
