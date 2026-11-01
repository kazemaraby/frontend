import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** End-of-service award (Phase 4 task 17): HR reads an employee's award in the salary tab — the service, the last
 * wage, the award and each step — and tries another reason: a dismissal under Art. 80 gives none, an employer's
 * ending gives the whole award, and Art. 77 adds the compensation; the leave balance paid at exit (task 18). */
test("HR works out an employee's end-of-service award", async ({ browser }) => {
  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/employees");
  await hr.getByRole("searchbox", { name: /^ابحث بالاسم/ }).fill("رؤيا حاوي");
  await hr.getByRole("button", { name: "عرض ملف رؤيا حاوي" }).click();
  await hr.getByRole("tab", { name: "الراتب" }).click();
  const card = hr.getByRole("region", { name: "مكافأة نهاية الخدمة" });
  await expect(card).toContainText("مدة الخدمة");
  await expect(card).toContainText("نصف شهر عن كل سنة من السنوات الخمس الأولى");

  await card.locator('select[name="reason"]').selectOption("dismissal");
  await expect(card).toContainText("لا مكافأة (المادة 80)");
  await card.locator('select[name="reason"]').selectOption("termination_by_employer");
  await expect(card).toContainText("المكافأة كاملة");
  await card.getByLabel("دون سبب مشروع (المادة 77)").check();
  await expect(card).toContainText("التعويض (المادة 77)");

  // Task 18: the leave balance paid at exit (Art. 111), at the daily wage
  const leave = hr.getByRole("region", { name: "تعويض رصيد الإجازات عند انتهاء الخدمة" });
  await expect(leave).toContainText("الأجر اليومي");
  await expect(leave).toContainText("÷ 30 ×");
});
