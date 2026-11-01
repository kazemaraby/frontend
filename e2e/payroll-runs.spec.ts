import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** The payroll screen (Phase 4 task 12, the design's إدارة الرواتب): the tenant admin makes and calculates last
 * month's payroll, sees the tiles and an employee's row (basic, allowances, net), opens the calculation behind it,
 * holds and releases the pay, splits the batches, and deletes the payroll again (approval, which locks it for good,
 * is covered by the backend tests). */
test("make, read and delete a month's payroll", async ({ browser }) => {
  test.setTimeout(90_000);
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const month = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}`;
  const admin = await signedIn(browser, "qa@cactus.localhost");
  await admin.goto(`/payroll?month=${month}`);

  // A payroll left by an interrupted run of this test goes first.
  const remove = admin.getByRole("button", { name: "حذف المسير" });
  await expect(admin.getByText(/لا يوجد مسير لهذا الشهر|حالة المسير/).first()).toBeVisible(); // the page has loaded
  if (await remove.isVisible()) {
    await remove.click();
    await expect(admin.getByText("لا يوجد مسير لهذا الشهر")).toBeVisible();
  }

  await admin.getByRole("button", { name: "مسير رواتب جديد" }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "إنشاء واحتساب" }).click();
  await expect(admin.getByText("محتسب", { exact: true })).toBeVisible({ timeout: 30_000 });
  const row = admin.getByRole("row").filter({ hasText: "EMP-004" });
  await expect(row).toContainText("رؤيا حاوي");
  await expect(row).toContainText("9,000");
  await expect(admin.getByText(/عدد الموظفين في المسير/)).toBeVisible();

  await row.getByRole("button", { name: "عرض احتساب رؤيا حاوي" }).click();
  const calc = admin.getByRole("dialog");
  await expect(calc.getByRole("region", { name: "حساب الشهر" })).toContainText("الراتب الأساسي");
  await calc.getByRole("button", { name: /إغلاق/ }).first().click();

  await row.getByRole("button", { name: "إيقاف صرف رؤيا حاوي" }).click();
  await expect(row).toContainText("موقوف الصرف");
  await row.getByRole("button", { name: "إلغاء إيقاف صرف رؤيا حاوي" }).click();
  await expect(row).not.toContainText("موقوف الصرف");

  await admin.getByRole("tab", { name: "دفعات الرواتب" }).click();
  await admin.getByRole("button", { name: "دفعة واحدة" }).click();
  await expect(admin.getByRole("table", { name: "دفعات الرواتب" })).toContainText("كل الموظفين");

  await admin.getByRole("tab", { name: "إدارة الرواتب" }).click();
  await admin.getByRole("button", { name: "حذف المسير" }).click();
  await expect(admin.getByText("لا يوجد مسير لهذا الشهر")).toBeVisible();
});
