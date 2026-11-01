import { describe, expect, it } from "vitest";

import ar from "./ar.json";
import en from "./en.json";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((all, [key, value]) => {
    return typeof value === "string" ? { ...all, [prefix + key]: value } : { ...all, ...flatten(value, `${prefix}${key}.`) };
  }, {});
}

const AR = flatten(ar as Tree);
const EN = flatten(en as Tree);
const PLURAL = /_(zero|one|two|few|many|other)$/;
const pluralBases = (strings: Record<string, string>) =>
  new Set(Object.keys(strings).filter((k) => PLURAL.test(k)).map((k) => k.replace(PLURAL, "")));

describe("translations", () => {
  it("every Arabic plural has all six forms (i18next would silently fall back)", () => {
    for (const base of pluralBases(AR)) {
      for (const form of ["zero", "one", "two", "few", "many", "other"]) {
        expect(AR, `ar ${base}_${form}`).toHaveProperty([`${base}_${form}`]);
      }
    }
  });

  it("every English plural has one and other", () => {
    for (const base of pluralBases(EN)) {
      expect(EN).toHaveProperty([`${base}_one`]);
      expect(EN).toHaveProperty([`${base}_other`]);
    }
  });

  it("no empty strings and the same placeholders in both languages", () => {
    const placeholders = (s: string) => (s.match(/\{\{\s*\w+\s*\}\}/g) ?? []).map((p) => p.replace(/\s/g, "")).sort();
    for (const [key, value] of Object.entries(AR)) {
      expect(value.trim(), `ar ${key}`).not.toBe("");
      const base = key.replace(PLURAL, "");
      const enValue = EN[key] ?? EN[`${base}_other`];
      expect(enValue, `en ${key}`).toBeDefined();
      const mine = placeholders(value).filter((p) => p !== "{{count}}");
      const theirs = placeholders(enValue).filter((p) => p !== "{{count}}");
      if (/_(zero|one|two)$/.test(key)) {
        // Arabic zero / one / two forms spell the number out ("من موظف واحد"), so they may drop it.
        for (const p of mine) expect(theirs, `placeholders of ${key}`).toContain(p);
      } else {
        expect(mine, `placeholders of ${key}`).toEqual(theirs);
      }
    }
  });
});
