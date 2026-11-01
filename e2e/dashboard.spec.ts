import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Employee dashboard and leave balance report (Phase 2 task 16), on seed_demo data: employee@ (رؤيا حاوي) sees their
 * balances, colleagues away (manager@ works from home, كافي مروان is on a mission), upcoming birthdays, and starts a
 * leave request from a quick action; hr@ reads the balance report; employee@ has no report tab. */

test("the dashboard shows the employee's real data", async ({ browser }) => {
  const page = await signedIn(browser, "employee@cactus.localhost");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("مرحبًا، رؤيا");
  await expect(page.getByRole("region", { name: "رصيد إجازاتك" })).toContainText("إجازة سنوية");
  const away = page.getByRole("region", { name: "من في إجازة / من يعمل عن بُعد" });
  await expect(away).toContainText("عمل عن بعد");
  await expect(away).toContainText("مهمة عمل");
  await expect(page.getByRole("region", { name: "أعياد الميلاد القادمة" })).toContainText("كافي مروان");

  await page.getByRole("region", { name: "إجراءات سريعة" }).getByRole("button", { name: "طلب إجازة", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "طلب إجازة" });
  await expect(dialog.locator('select[name="leave_type"]')).toBeVisible();
  await dialog.getByRole("button", { name: "إلغاء" }).click();

  await page.goto("/leave");
  await expect(page.getByRole("tab", { name: "أرصدة الإجازات" })).toHaveCount(0); // only their own balance
});

test("HR reads the leave balance report by department and employee", async ({ browser }) => {
  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/leave");
  await hr.getByRole("tab", { name: "أرصدة الإجازات" }).click();
  await expect(hr.getByRole("table", { name: "حسب الإدارة" })).toContainText("تطوير البرمجيات");
  const people = hr.getByRole("table", { name: "حسب الموظف" });
  await expect(people.getByRole("row").filter({ hasText: "رؤيا حاوي" })).toContainText("EMP-004");
  await hr.getByRole("searchbox", { name: "ابحث بالاسم أو الرقم الوظيفي" }).fill("EMP-004");
  await expect(people.getByRole("row")).toHaveCount(2); // the header and رؤيا
  const download = hr.waitForEvent("download");
  await hr.getByRole("button", { name: "تصدير Excel" }).click();
  expect((await download).suggestedFilename()).toMatch(/^leave-balances-.*\.xlsx$/);
});
