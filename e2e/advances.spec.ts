import { expect, test } from "@playwright/test";

import { signIn } from "./helpers";

/** Advances (Phase 4 task 9): the employee asks for an advance — the form shows the monthly installment and the
 * limits (2 months' wage; Art. 92: an installment at most 10 % of the wage) and refuses a too-large installment —
 * sends it, sees it waiting and withdraws it (one open advance at a time). */
test("an employee asks for an advance and withdraws it", async ({ page }) => {
  const reason = `ظرف عائلي ${Date.now()}`;
  await signIn(page, "employee@cactus.localhost");
  await page.goto("/requests");
  await page.getByRole("button", { name: /^طلب جديد/ }).click();
  await page.getByRole("button", { name: "طلب سلفة", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('input[name="amount"]').fill("12000");
  await dialog.locator('input[name="installments"]').fill("6");
  await expect(dialog).toContainText("المادة 92"); // 2,000 a month is more than 10 % of the wage
  await dialog.locator('input[name="amount"]').fill("3000");
  const status = dialog.getByRole("status");
  await expect(status).toContainText("500.00");
  await expect(status).toContainText("24,500"); // 2 months' wage (12,250)
  await dialog.locator('textarea[name="reason"]').fill(reason);
  await dialog.getByRole("button", { name: "إرسال" }).click();
  await expect(dialog).toBeHidden();

  const row = page.getByRole("row").filter({ hasText: "سلفة 3000" }).filter({ hasText: "بانتظار الموافقة" }).first();
  await expect(row).toBeVisible();
  await row.getByRole("button").first().click();
  const detail = page.getByRole("dialog");
  await expect(detail).toContainText(reason);
  await detail.getByRole("button", { name: "إلغاء الطلب" }).click();
  await expect(detail).toContainText("ملغى");
});
