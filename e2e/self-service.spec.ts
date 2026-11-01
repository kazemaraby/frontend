import { expect, test } from "@playwright/test";

import { signIn } from "./helpers";

/** Self-service (Phase 2 task 10): the employee asks for a short permission (the dialog counts the hours), sees it
 * waiting in their requests and withdraws it, so the month's limit is free again for the next run. */

/** A Monday some months ahead (a working day), a different one on most runs. */
function monday(): string {
  const day = new Date();
  day.setMonth(day.getMonth() + 6 + (Math.floor(Date.now() / 1000) % 12));
  day.setDate(day.getDate() + ((8 - day.getDay()) % 7));
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

test("an employee asks for a short permission and withdraws it", async ({ page }) => {
  const reason = `مراجعة بنك ${Date.now()}`;
  await signIn(page, "employee@cactus.localhost");
  await page.goto("/requests");
  await expect(page.getByRole("list", { name: "هذا الشهر" })).toContainText("الاستئذانات هذا الشهر");

  await page.getByRole("button", { name: /^طلب جديد/ }).click();
  await page.getByRole("button", { name: "استئذان", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('select[name="kind"]').selectOption("early_leave");
  await dialog.locator('input[name="date"]').fill(monday());
  await dialog.locator('input[name="from_time"]').fill("14:00");
  await dialog.locator('input[name="to_time"]').fill("15:30");
  await expect(dialog.getByRole("status")).toContainText("1.5");
  await dialog.locator('textarea[name="reason"]').fill(reason);
  await dialog.getByRole("button", { name: "إرسال" }).click();
  await expect(dialog).toBeHidden();

  const row = page.getByRole("row").filter({ hasText: "خروج مبكر" }).filter({ hasText: "بانتظار الموافقة" }).first();
  await expect(row).toBeVisible();
  await row.getByRole("button").first().click(); // the title opens the request
  const detail = page.getByRole("dialog");
  await expect(detail).toContainText(reason);
  await detail.getByRole("button", { name: "إلغاء الطلب" }).click();
  await expect(detail).toContainText("ملغى");
});
