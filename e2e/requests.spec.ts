import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Self-service screens (Phase 2 task 15): employee@ asks for a permission from the grouped "new request" menu;
 * manager@ opens it from the inbox and returns it from its detail; employee@ finds it with the "to correct"
 * filter, corrects it in its own form (filled in with what was asked) and sends it again, then withdraws it. */

/** A Wednesday 3 to 14 months ahead (a working day), a different one on most runs. */
function wednesday(): string {
  const day = new Date();
  day.setMonth(day.getMonth() + 3 + (Math.floor(Date.now() / 1000) % 12));
  day.setDate(day.getDate() + ((10 - day.getDay()) % 7));
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

test("a returned request is corrected in its own form and sent again", async ({ browser }) => {
  test.setTimeout(60_000);
  const day = wednesday();
  const employee = await signedIn(browser, "employee@cactus.localhost");
  await employee.goto("/requests");
  await employee.getByRole("button", { name: /^طلب جديد/ }).click();
  await expect(employee.getByRole("region", { name: "المهام والسفر" })).toBeVisible(); // the menu is grouped
  await employee.getByRole("button", { name: "استئذان", exact: true }).click();
  const form = employee.getByRole("dialog");
  await form.locator('select[name="kind"]').selectOption("during_day");
  await form.locator('input[name="date"]').fill(day);
  await form.locator('input[name="from_time"]').fill("10:00");
  await form.locator('input[name="to_time"]').fill("12:00");
  await expect(form.getByRole("status")).toContainText("2");
  await form.getByRole("button", { name: "إرسال" }).click();
  await expect(form).toBeHidden();

  // The manager reads it and returns it from the detail.
  const manager = await signedIn(browser, "manager@cactus.localhost");
  await manager.goto("/approvals");
  await manager.getByRole("searchbox", { name: "ابحث بالعنوان أو اسم مقدّم الطلب" }).fill(day);
  await manager.getByRole("row").filter({ hasText: `(${day})` }).getByRole("button").first().click();
  const detail = manager.getByRole("dialog");
  await detail.getByRole("button", { name: "إعادة", exact: true }).click();
  const decide = manager.getByRole("dialog");
  await decide.getByRole("textbox").fill("ساعة واحدة تكفي");
  await decide.getByRole("button", { name: "إعادة للتعديل" }).click();
  await expect(manager.getByRole("dialog")).toHaveCount(0);

  // The employee corrects it.
  await employee.reload();
  await employee.locator('select[name="status"]').selectOption({ label: "بحاجة لتعديل" });
  const row = employee.getByRole("row").filter({ hasText: `(${day})` });
  await expect(row).toContainText("أُعيد للتعديل");
  await row.getByRole("button", { name: "تعديل وإعادة الإرسال" }).click();
  const again = employee.getByRole("dialog");
  await expect(again.locator('input[name="from_time"]')).toHaveValue("10:00"); // what was asked
  await again.locator('input[name="to_time"]').fill("11:00");
  await expect(again.getByRole("status")).toContainText("1");
  await again.getByRole("button", { name: "إرسال" }).click();
  await expect(again).toBeHidden();

  await employee.locator('select[name="status"]').selectOption({ label: "مفتوحة" });
  const sent = employee.getByRole("row").filter({ hasText: `(${day})` });
  await expect(sent).toContainText("بانتظار الموافقة");
  await sent.getByRole("button").first().click();
  const mine = employee.getByRole("dialog");
  await expect(mine).toContainText("11:00");
  await mine.getByRole("button", { name: "إلغاء الطلب" }).click();
  await expect(mine).toContainText("ملغى");
});
