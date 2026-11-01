import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Attendance violations (Phase 4 task 6): the payroll settings show the model work regulation's table (the
 * account's); the tenant admin takes a copy for the company, changes a row, and goes back to the account's table. */
test("the working-hours penalty table", async ({ browser }) => {
  const admin = await signedIn(browser, "qa@cactus.localhost");
  await admin.goto("/settings/payroll?tab=penalties");
  const table = admin.getByRole("table", { name: "مخالفات مواعيد العمل" });
  const row1 = table.getByRole("row").filter({ has: admin.getByRole("cell", { name: "1", exact: true }) });
  await expect(row1).toContainText("إنذار كتابي");
  await expect(row1).toContainText("حسم 5% من الأجر اليومي");
  const row7 = table.getByRole("row").filter({ has: admin.getByRole("cell", { name: "7", exact: true }) });
  await expect(row7).toContainText("يُحسم"); // plus the wage of the time lost
  await expect(admin.getByRole("main")).toContainText("المادة 71");

  await admin.getByRole("button", { name: "نسخة خاصة بهذه الشركة" }).click();
  await expect(admin.getByRole("main")).toContainText("نسختها الخاصة");
  await row1.getByRole("button", { name: "تعديل البند 1" }).click();
  const dialog = admin.getByRole("dialog");
  await dialog.locator('input[name="value-1"]').fill("7");
  await dialog.getByRole("button", { name: "حفظ" }).click();
  await expect(dialog).toBeHidden();
  await expect(row1).toContainText("حسم 7% من الأجر اليومي");

  await admin.getByRole("button", { name: "العودة إلى جدول الحساب" }).click();
  await expect(row1).toContainText("حسم 5% من الأجر اليومي");
});
