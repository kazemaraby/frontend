import { fileURLToPath } from "node:url";

import { expect, type Page, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Phase 1 Excel import (#8) against the real backend and Celery worker: template, a file with mistakes, a good
 * file. The good file can be imported on every run: the second time its rows are "unchanged". */
const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

async function check(page: Page, file: string) {
  await page.locator('input[type="file"]').setInputFiles(fixture(file));
  await page.getByRole("button", { name: "فحص الملف" }).click();
  await expect(page.getByText("جارٍ فحص الأسطر...")).toBeHidden({ timeout: 20_000 });
}

test("HR downloads the template, sees row errors, then imports a good file", async ({ browser }) => {
  test.setTimeout(60_000);
  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/employees");
  await hr.getByRole("button", { name: "استيراد" }).click();
  await expect(hr).toHaveURL("/employees/import");

  const [template] = await Promise.all([hr.waitForEvent("download"), hr.getByRole("button", { name: "تنزيل النموذج" }).click()]);
  expect(template.suggestedFilename()).toMatch(/^employees-template-.*\.xlsx$/);

  // A file with mistakes: each row lists its problems and nothing can be imported.
  await check(hr, "employees-errors.xlsx");
  await expect(hr.getByText("يحتوي أخطاء").first()).toBeVisible();
  const errors = hr.getByRole("table", { name: "الأخطاء" });
  await expect(errors.getByRole("row").filter({ hasText: "E2E-BAD-1" })).toContainText("رقم التحقق");
  await expect(errors.getByRole("row").filter({ hasText: "E2E-BAD-2" })).toContainText("Atlantis");
  await expect(hr.getByRole("button", { name: /^استيراد \d/ })).toHaveCount(0);
  const [report] = await Promise.all([hr.waitForEvent("download"), hr.getByRole("button", { name: "تنزيل نتيجة الفحص" }).click()]);
  expect(report.suggestedFilename()).toMatch(/^employees-check-.*\.xlsx$/);

  // A good file: new the first time, unchanged on later runs; either way it imports.
  await check(hr, "employees-valid.xlsx");
  await expect(hr.getByText("جاهز للاستيراد").first()).toBeVisible();
  await hr.getByRole("button", { name: /^استيراد/ }).last().click();
  await expect(hr.getByText("تم الاستيراد.")).toBeVisible({ timeout: 20_000 });

  await hr.goto("/employees");
  await hr.getByRole("searchbox", { name: /^ابحث بالاسم/ }).fill("E2E-IMP-2");
  await expect(hr.getByRole("row").filter({ hasText: "هيا القحطاني" })).toContainText("نشط");
});
