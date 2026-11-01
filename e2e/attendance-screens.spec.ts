import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Attendance screens (Phase 3 task 16): HR's "today" tab (everyone's day, the tiles, entering a punch for one
 * person), the reports (monthly summary on the screen and as Excel), and the employee's own month in their file. */
test("HR reads today's board and enters a punch from it", async ({ browser }) => {
  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/attendance");
  await expect(hr.getByRole("tab", { name: "اليوم" })).toHaveAttribute("aria-selected", "true");
  const table = hr.getByRole("table", { name: "دوام اليوم" });
  const roya = table.getByRole("row").filter({ hasText: "رؤيا حاوي" });
  await expect(roya).toContainText("EMP-004");
  await expect(hr.getByText("حاضرون اليوم")).toBeVisible();
  await roya.getByRole("button", { name: "إدخال بصمة لـ رؤيا حاوي" }).click();
  const dialog = hr.getByRole("dialog", { name: "إدخال بصمة" });
  await expect(dialog).toContainText("رؤيا حاوي · EMP-004");
  await dialog.getByRole("button", { name: "إلغاء" }).click();

  await hr.locator('select[name="status"]').selectOption("away");
  await expect(table.getByRole("row").filter({ hasText: "رؤيا حاوي" })).toHaveCount(0);
});

test("HR reads the monthly summary and exports it", async ({ browser }) => {
  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/attendance?tab=reports");
  const card = hr.getByRole("region", { name: "تقارير الحضور" });
  await card.locator('select[name="kind"]').selectOption("monthly");
  const table = card.getByRole("table", { name: "الملخص الشهري" });
  await expect(table.getByRole("row").filter({ hasText: "EMP-004" })).toBeVisible();
  await expect(table).toContainText("أيام التأخير");
  const [file] = await Promise.all([hr.waitForEvent("download"), card.getByRole("button", { name: "تصدير Excel" }).click()]);
  expect(file.suggestedFilename()).toMatch(/^attendance-monthly-.*\.xlsx$/);
  await card.locator('select[name="kind"]').selectOption("sync");
  await expect(card.getByRole("table", { name: "مزامنة الأجهزة" })).toBeVisible();
});

test("an employee sees their own month in their file", async ({ browser }) => {
  const employee = await signedIn(browser, "employee@cactus.localhost");
  await employee.goto("/me");
  await employee.getByRole("tab", { name: "الحضور" }).click();
  const grid = employee.getByRole("grid");
  await expect(grid).toBeVisible();
  await expect(grid.getByRole("gridcell").filter({ hasText: "08:00" }).first()).toBeVisible(); // the corrected Wednesday
  await expect(employee.getByText("أيام الحضور")).toBeVisible();
});
