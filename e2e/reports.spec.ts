import { readFile } from "node:fs/promises";

import { expect, type Page, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Phase 1 reports: employee master report (#131) and document expiry report (#134), exported to Excel. */

async function exported(page: Page, button = "تصدير Excel") {
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: button }).click()]);
  const bytes = await readFile((await download.path())!);
  expect(bytes.subarray(0, 2).toString()).toBe("PK"); // an .xlsx is a zip file
  return download.suggestedFilename();
}

test("HR filters the employee list and exports exactly that to Excel", async ({ browser }) => {
  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/employees");
  await hr.getByRole("combobox", { name: "الجنسية" }).selectOption("0"); // non-Saudi
  await expect(hr.getByRole("row").filter({ hasText: "كافي مروان" })).toBeVisible();
  await expect(hr.getByRole("row").filter({ hasText: "رؤيا حاوي" })).toHaveCount(0); // Saudi

  const exportCall = hr.waitForRequest((r) => r.url().includes("/api/v1/employees/export"));
  expect(await exported(hr)).toMatch(/^employees-\d{4}-\d{2}-\d{2}\.xlsx$/);
  expect((await exportCall).url()).toContain("saudi=0"); // the same filters as the list
});

test("line managers have no export", async ({ browser }) => {
  const manager = await signedIn(browser, "manager@cactus.localhost");
  await manager.goto("/employees");
  await expect(manager.getByRole("row").nth(1)).toBeVisible();
  await expect(manager.getByRole("button", { name: "تصدير" })).toHaveCount(0);
});

test("HR sees expiring and expired documents and exports them", async ({ browser }) => {
  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/documents");
  await expect(hr.getByRole("heading", { level: 1 })).toHaveText("تقرير انتهاء الوثائق");
  await expect(hr.getByRole("row").filter({ hasText: "كافي مروان" }).filter({ hasText: "الإقامة" })).toBeVisible(); // ~25 days

  await hr.getByRole("tab", { name: "منتهية" }).click();
  const expired = hr.getByRole("row").filter({ hasText: "حكيم أحمد" });
  await expect(expired).toContainText("منتهية");
  await expect(hr.getByRole("row").filter({ hasText: "كافي مروان" })).toHaveCount(0);

  expect(await exported(hr)).toMatch(/^documents-\d{4}-\d{2}-\d{2}\.xlsx$/);
  await expired.getByRole("button", { name: "عرض الملف" }).click();
  await expect(hr).toHaveURL(/\/employees\/\d+\?tab=documents$/);
});
