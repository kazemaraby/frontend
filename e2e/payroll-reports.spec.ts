import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Payroll reports (Phase 4 task 21): the register of an approved month (the demo's January 2025, locked by the
 * payslips spec) with its totals, the cost by department, and the register as Excel (payroll.export, audited). */
test("payroll reports of an approved month", async ({ browser }) => {
  const payroll = await signedIn(browser, "qa@cactus.localhost");
  await payroll.goto("/payroll?month=2025-01&currency=SAR&tab=reports");
  const card = payroll.getByRole("region", { name: "تقارير الرواتب" });
  await expect(card.getByRole("row").filter({ hasText: "رؤيا حاوي" })).toBeVisible();
  const totals = card.getByRole("status", { name: "الإجماليات" });
  await expect(totals).toContainText("الصافي");

  await card.locator('select[name="report"]').selectOption("cost");
  await expect(card.locator('select[name="by"]')).toBeVisible();
  await expect(totals).toContainText("التكلفة على المنشأة");

  await card.locator('select[name="report"]').selectOption("register");
  const [file] = await Promise.all([payroll.waitForEvent("download"), card.getByRole("button", { name: "تصدير Excel" }).click()]);
  expect(file.suggestedFilename()).toMatch(/^payroll-register-2025-01-.*\.xlsx$/);
});
