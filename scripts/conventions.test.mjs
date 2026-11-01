import { describe, expect, it } from "vitest";

import { baseKeys, codeOf, hasArabicInCode, physicalClasses } from "./conventions.mjs";

describe("conventions guard", () => {
  it.each([
    ['className="ml-2 p-4"', ["ml-2"]],
    ['className="md:pr-6 hover:text-right"', ["pr-6", "text-right"]],
    ['cn("absolute left-0 -mr-1", x)', ["left-0", "mr-1"]],
    ["className={`rounded-l-lg border-r`}", ["rounded-l-lg", "border-r"]],
    ['className="rtl:right-4 float-left"', ["right-4", "float-left"]],
  ])("flags physical utilities in %s", (line, expected) => {
    expect(physicalClasses(line)).toEqual(expected);
  });

  it.each([
    'className="ms-2 pe-4 start-0 end-1 text-start rounded-s-lg border-e"',
    'className="inset-x-0 mx-auto px-4"', // symmetric utilities are fine
    "// mirrors the data: reads right-to-left in Arabic",
    " * the icon sits to the left of the text",
    'const forward = event.key === (rtl ? "ArrowLeft" : "ArrowRight");',
  ])("accepts %s", (line) => {
    expect(physicalClasses(line)).toEqual([]);
  });

  it("finds Arabic in components but not in translations, sample data or comments", () => {
    expect(hasArabicInCode('<p>مرحبا</p>', "src/features/x/Page.tsx")).toBe(true);
    expect(hasArabicInCode('"greeting": "مرحبا"', "src/i18n/ar.json")).toBe(false);
    expect(hasArabicInCode('name_ar: "سارة"', "src/mocks/org.ts")).toBe(false);
    expect(hasArabicInCode('/** e.g. "عرض الكل" */', "src/design/Card.tsx")).toBe(false);
    expect(codeOf('<p /> {/* "مرحبا" */}')).not.toMatch(/[؀-ۿ]/);
  });

  it("treats plural forms as one key", () => {
    expect(baseKeys({ a: { inDays_one: "", inDays_other: "" }, b: "" })).toEqual(new Set(["a.inDays", "b"]));
  });
});
