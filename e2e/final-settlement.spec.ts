import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Final settlement (Phase 4 task 19): HR starts an employee's offboarding and signs part of the clearance;
 * payroll prepares the final settlement — a payroll of its own, worked out at once — and reads it on the payroll
 * page: the last day, the award, the leave paid, the Art. 88 date, and the clearance still waiting (the approval is
 * refused until it is signed off). Then it is undone: the run deleted, the employee kept. */
test("HR prepares a final settlement behind the clearance", async ({ browser }) => {
  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/employees");
  await hr.getByRole("searchbox", { name: /^ابحث بالاسم/ }).fill("حكيم أحمد");
  await hr.getByRole("button", { name: "عرض ملف حكيم أحمد" }).click();
  await expect(hr).toHaveURL(/\/employees\/\d+/);
  const profile = hr.url();

  await hr.getByRole("button", { name: "بدء إنهاء الخدمة" }).click();
  const start = hr.getByRole("dialog");
  const day = new Date();
  await start.locator('input[name="last_working_day"]').fill(day.toISOString().slice(0, 10));
  await start.getByRole("button", { name: "بدء إنهاء الخدمة" }).click();
  await expect(start).toBeHidden();

  const card = hr.getByRole("region", { name: "إنهاء الخدمة" });
  await expect(card).toContainText("إخلاء الطرف");
  const it = card.getByRole("listitem").filter({ hasText: "تقنية المعلومات" });
  await it.getByRole("button", { name: "توقيع الإخلاء" }).click();
  await expect(it).toContainText("تم الإخلاء");

  await expect(card.getByRole("button", { name: "إعداد المخالصة النهائية" })).toHaveCount(0); // payroll's to prepare

  const payroll = await signedIn(browser, "qa@cactus.localhost");
  await payroll.goto(profile);
  await payroll.getByRole("region", { name: "إنهاء الخدمة" }).getByRole("button", { name: "إعداد المخالصة النهائية" }).click();
  const settle = payroll.getByRole("dialog");
  await settle.getByRole("button", { name: "إنشاء واحتساب" }).click();
  await expect(payroll).toHaveURL(/\/payroll\?/);
  const summary = payroll.getByRole("region", { name: "المخالصة النهائية" });
  await expect(summary).toContainText("تُصرف في موعد أقصاه (المادة 88)");
  await expect(summary).toContainText("لم يُوقَّع إخلاء الطرف");
  await payroll.getByRole("button", { name: "إرسال للاعتماد" }).click();
  await expect(payroll.getByRole("alert").filter({ hasText: "لم يُوقَّع إخلاء الطرف" }).first()).toBeVisible();

  // undo: the run deleted, the employee kept
  await payroll.getByRole("button", { name: "حذف المسير" }).click();
  await expect(summary).toBeHidden();
  await hr.goto(profile);
  await card.getByRole("button", { name: "إبقاء الموظف" }).click();
  const keep = hr.getByRole("dialog");
  await keep.locator('textarea[name="note"]').fill("اختبار آلي");
  await keep.getByRole("button", { name: "إبقاء", exact: true }).click();
  await expect(keep).toBeHidden();
});
