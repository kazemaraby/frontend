import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Attendance settings (Phase 3 task 1): hr@ reads the working-hours rules with their articles (qa@, the
 * administrator, overrides one for the company), creates a group and applies Ramadan 1448 to it, then puts everything back for the next run. */
test("HR sets working hours, a group and its Ramadan hours", async ({ browser }) => {
  test.setTimeout(60_000);
  const hr = await signedIn(browser, "hr@cactus.localhost");
  const group = `مناوبة ${Date.now() % 100000}`;
  await hr.goto("/settings/attendance?tab=rules");

  // HR reads the law's values (each with its article, to be confirmed); only the administrator changes them.
  const rulesOf = (page: typeof hr) => page.getByRole("table", { name: "حدود ساعات العمل في نظام العمل" });
  const dailyOf = (page: typeof hr) => rulesOf(page).getByRole("row").filter({ hasText: "الحد الأقصى لساعات العمل يومياً" });
  await expect(dailyOf(hr)).toContainText("المادة 98");
  await expect(dailyOf(hr)).toContainText("للتأكيد");
  await expect(dailyOf(hr).getByRole("textbox", { name: /هذه الشركة/ })).toBeDisabled();
  await expect(hr.getByText("يغيّر هذه القيم مدير النظام فقط.")).toBeVisible();

  const admin = await signedIn(browser, "qa@cactus.localhost");
  await admin.goto("/settings/attendance?tab=rules");
  await dailyOf(admin).getByRole("textbox", { name: /هذه الشركة/ }).fill("7");
  await admin.getByRole("region", { name: "حدود ساعات العمل في نظام العمل" }).getByRole("button", { name: "حفظ قيم الشركة" }).click();
  await expect(dailyOf(admin).getByRole("cell").last()).toHaveText("7");
  await dailyOf(admin).getByRole("textbox", { name: /هذه الشركة/ }).fill("");
  await admin.getByRole("region", { name: "حدود ساعات العمل في نظام العمل" }).getByRole("button", { name: "حفظ قيم الشركة" }).click();
  await expect(dailyOf(admin).getByRole("cell").last()).toHaveText("8");

  // A group with one member.
  await hr.getByRole("tab", { name: "المجموعات" }).click();
  await hr.getByRole("button", { name: "إضافة مجموعة" }).click();
  let dialog = hr.getByRole("dialog");
  await dialog.locator('input[name="name_ar"]').fill(group);
  await dialog.getByRole("searchbox", { name: "ابحث عن موظف لإضافته" }).fill("رؤيا");
  await dialog.getByRole("button", { name: /رؤيا حاوي/ }).click();
  await expect(dialog.getByRole("list", { name: /الأعضاء/ })).toContainText("رؤيا حاوي");
  await dialog.getByRole("button", { name: "حفظ" }).click();
  await expect(dialog).toBeHidden();
  await expect(hr.getByRole("list", { name: "مجموعات الموظفين" })).toContainText(group);

  await hr.getByRole("tab", { name: "رمضان" }).click();
  // Ramadan 1448 for that group only (its hours are the shifts' Ramadan times, not set here).
  const ramadan = hr.getByRole("list", { name: "ساعات العمل في رمضان" });
  const row = ramadan.getByRole("listitem").filter({ hasText: "رمضان 1448" });
  await hr.getByRole("button", { name: "تعديل رمضان 1448" }).click();
  dialog = hr.getByRole("dialog");
  await expect(dialog.locator('input[name="daily_hours"]')).toHaveCount(0);
  await dialog.locator('select[name="applies_to"]').selectOption("groups");
  await dialog.getByRole("button", { name: "حفظ" }).click();
  await expect(dialog.getByText("اختر المجموعات.")).toBeVisible();
  await dialog.getByRole("checkbox", { name: new RegExp(group) }).check();
  await dialog.getByRole("button", { name: "حفظ" }).click();
  await expect(dialog).toBeHidden();
  await expect(row).toContainText(group);

  // Back as it was: everyone; the group removed.
  await hr.getByRole("button", { name: "تعديل رمضان 1448" }).click();
  dialog = hr.getByRole("dialog");
  await dialog.locator('select[name="applies_to"]').selectOption("everyone");
  await dialog.getByRole("button", { name: "حفظ" }).click();
  await expect(row).toContainText("الجميع");
  await hr.getByRole("tab", { name: "المجموعات" }).click();
  await hr.getByRole("button", { name: `تعديل ${group}` }).click();
  await hr.getByRole("dialog").getByRole("button", { name: "حذف" }).click();
  await expect(hr.getByRole("list", { name: "مجموعات الموظفين" })).not.toContainText(group);
});
