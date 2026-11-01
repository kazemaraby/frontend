import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Resignation (Phase 4 task 16): the employee sees the contract's notice and the dates before handing it in; HR
 * sees it waiting on the employee's file and sets the last working day (a shorter notice waives the rest); the
 * employee withdraws it within the days the law gives. */
test("an employee resigns, HR sets the last day, the employee withdraws it", async ({ browser }) => {
  const reason = `انتقال إلى مدينة أخرى ${Date.now()}`;
  const employee = await signedIn(browser, "employee@cactus.localhost");
  await employee.goto("/requests");
  await employee.getByRole("button", { name: /^طلب جديد/ }).click();
  await employee.getByRole("button", { name: "استقالة", exact: true }).click();
  const dialog = employee.getByRole("dialog");
  await expect(dialog.getByRole("status")).toContainText("تُعد مقبولة");
  await expect(dialog.getByRole("status")).toContainText("يمكنك سحبها حتى");
  await dialog.locator('textarea[name="reason"]').fill(reason);
  const send = dialog.getByRole("button", { name: "تقديم الاستقالة" });
  await expect(send).toBeDisabled(); // not before confirming
  await dialog.getByLabel("أرغب في الاستقالة من عملي.").check();
  await send.click();
  await expect(dialog).toBeHidden();

  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/employees");
  await hr.getByRole("searchbox", { name: /^ابحث بالاسم/ }).fill("رؤيا حاوي");
  await hr.getByRole("button", { name: "عرض ملف رؤيا حاوي" }).click();
  const card = hr.getByRole("region", { name: "استقالة بانتظار القرار" });
  await expect(card).toContainText(reason);
  await card.getByRole("button", { name: "تحديد آخر يوم عمل" }).click();
  const dating = hr.getByRole("dialog");
  const day = new Date();
  day.setDate(day.getDate() + 10);
  await dating.locator('input[name="last_working_day"]').fill(day.toISOString().slice(0, 10));
  await dating.getByRole("button", { name: "حفظ" }).click();
  await expect(dating).toBeHidden();
  await expect(card).toContainText("آخر يوم عمل");

  await employee.goto("/requests");
  const row = employee.getByRole("row").filter({ hasText: "استقالة" }).filter({ hasText: "بانتظار" }).first();
  await row.getByRole("button").first().click();
  const detail = employee.getByRole("dialog");
  await expect(detail).toContainText(reason);
  await detail.getByRole("button", { name: "إلغاء الطلب" }).click();
  await expect(detail).toContainText("ملغى");
});
