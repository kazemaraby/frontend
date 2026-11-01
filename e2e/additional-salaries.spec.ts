import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Additional salaries (Phase 4 task 8, #96): the tenant admin adds a bonus for an employee in October, sees it in
 * the month's list and totals, and in the employee's calculation, then removes it. */
test("a one-off bonus in the month", async ({ browser }) => {
  const note = `مكافأة اختبار ${Date.now()}`;
  const admin = await signedIn(browser, "qa@cactus.localhost");
  await admin.goto("/payroll?tab=additional");
  const card = admin.getByRole("region", { name: "الرواتب الإضافية" });
  await card.getByRole("button", { name: "إضافة مبلغ" }).click();
  const dialog = admin.getByRole("dialog");
  await dialog.getByRole("searchbox", { name: "ابحث عن موظف" }).fill("رؤيا");
  await dialog.locator('select[name="employee"]').selectOption({ label: "رؤيا حاوي · EMP-004" });
  await dialog.locator('select[name="component"]').selectOption({ label: "مكافأة (استحقاق)" });
  await dialog.locator('input[name="amount"]').fill("1500");
  await dialog.locator('input[name="note"]').fill(note);
  await dialog.getByRole("button", { name: "حفظ" }).click();
  await expect(dialog).toBeHidden();
  const row = card.getByRole("row").filter({ hasText: note });
  await expect(row).toContainText("1,500.00");
  await expect(row).toContainText("EMP-004");

  await row.getByRole("button", { name: "حذف" }).click();
  await expect(row).toHaveCount(0);
});
