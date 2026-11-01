import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Salary components and structures (Phase 4 task 3): the tenant admin adds a formula component, sees the formula
 * checked as it is typed (a sample value, then an unknown name), saves and deletes it, and sees the default structure.
 * HR sees an employee's monthly components in the salary tab of their file, and the month's calculation (task 4). */
test("salary components, structures and an employee's monthly components", async ({ browser }) => {
  const admin = await signedIn(browser, "qa@cactus.localhost");
  await admin.goto("/settings/payroll?tab=components");
  const list = admin.getByRole("table", { name: "مكونات الراتب" });
  await expect(list.getByRole("row").filter({ hasText: "BASIC" })).toContainText("التأمينات");

  const code = `E2E${Date.now().toString(36).toUpperCase()}`.slice(0, 20);
  await admin.getByRole("button", { name: "إضافة مكون" }).click();
  const dialog = admin.getByRole("dialog");
  await dialog.getByRole("textbox", { name: /الرمز/ }).fill(code);
  await dialog.getByRole("textbox", { name: /الاسم \(عربي\)/ }).fill("بدل اختبار");
  await dialog.getByRole("combobox", { name: "طريقة الحساب" }).selectOption({ label: "معادلة" });
  const formula = dialog.getByRole("textbox", { name: "المعادلة" });
  await formula.fill("round(BASIC * 0.1, 2)");
  await expect(dialog.getByRole("status")).toContainText("على قيم تجريبية");
  await formula.fill("SALARY * 2");
  await expect(dialog).toContainText("اسم غير معروف: SALARY");
  await formula.fill("round(BASIC * 0.1, 2)");
  await dialog.getByRole("button", { name: "حفظ" }).click();
  await expect(dialog).toBeHidden();
  const added = list.getByRole("row").filter({ hasText: code });
  await expect(added).toContainText("round(BASIC * 0.1, 2)");
  await added.getByRole("button", { name: `تعديل ${code}` }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "حذف" }).click();
  await expect(added).toHaveCount(0);

  await admin.getByRole("tab", { name: "هياكل الرواتب" }).click();
  await expect(admin.getByRole("table", { name: "هياكل الرواتب" }).getByRole("row").filter({ hasText: "الهيكل الأساسي" })).toContainText("افتراضي");

  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/employees");
  await hr.getByRole("searchbox", { name: /^ابحث بالاسم/ }).fill("رؤيا حاوي");
  await hr.getByRole("button", { name: "عرض ملف رؤيا حاوي" }).click();
  await hr.getByRole("tab", { name: "الراتب والبنك" }).click();
  const month = hr.getByRole("region", { name: "مكونات الراتب الشهرية" });
  await expect(month.getByRole("row").filter({ hasText: "الراتب الأساسي" })).toContainText("9,000.00");
  await expect(month.getByRole("row").filter({ hasText: "بدل السكن" })).toContainText("2,250.00");

  // The engine's month (task 4): a full month counts 30 days and pays the monthly amounts.
  const calc = hr.getByRole("region", { name: "حساب الشهر" });
  await expect(calc).toContainText("أيام فعلية 31");
  await expect(calc.getByRole("row").filter({ hasText: "الراتب الأساسي" })).toContainText("الشهر كاملًا");
  await expect(calc.getByRole("row").filter({ hasText: "إجمالي الاستحقاقات" })).toContainText("12,250.00");

  // GOSI (task 7): a Saudi registered before the 2024 law, on basic + housing (11,250).
  await expect(calc.getByRole("row").filter({ hasText: "التأمينات (حصة الموظف)" })).toContainText("1,096.88");
  await expect(calc.getByRole("row").filter({ hasText: "التأمينات (حصة المنشأة)" })).toContainText("1,321.88");
  const file = hr.getByRole("region", { name: "التأمينات الاجتماعية" });
  await expect(file).toContainText("مسجل قبل 3 يوليو 2024");
  await expect(file).toContainText("المعاشات: 9% / 9%");
});
