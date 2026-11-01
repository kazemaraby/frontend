import path from "node:path";

import { expect, test } from "@playwright/test";

import { signIn } from "./helpers";

/** Expense claims (Phase 4 task 8, #61): the employee claims two expenses with their receipts (one in dollars with
 * its rate), sees the claim waiting with its total and withdraws it. */
test("an employee claims expenses with receipts and withdraws the claim", async ({ page }) => {
  const purpose = `زيارة عميل ${Date.now()}`;
  const receipt = path.join(import.meta.dirname, "fixtures", "proof.pdf");
  await signIn(page, "employee@cactus.localhost");
  await page.goto("/requests");
  await page.getByRole("button", { name: /^طلب جديد/ }).click();
  await page.getByRole("button", { name: "مطالبة مصروفات", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('input[name="purpose"]').fill(purpose);
  await dialog.locator('input[name="amount-1"]').fill("320");
  await dialog.locator('input[type="file"]').first().setInputFiles(receipt);
  await dialog.getByRole("button", { name: "إضافة مصروف" }).click();
  await dialog.locator('select[name="category-2"]').selectOption("meals");
  await dialog.locator('input[name="amount-2"]').fill("40");
  await dialog.locator('input[name="currency-2"]').fill("USD");
  await dialog.locator('input[name="rate-2"]').fill("3.75");
  await dialog.locator('input[type="file"]').nth(1).setInputFiles(receipt);
  await expect(dialog.getByRole("status").filter({ hasText: "الإجمالي" })).toContainText("470.00");
  await dialog.getByRole("button", { name: "إرسال" }).click();
  await expect(dialog).toBeHidden();

  const row = page.getByRole("row").filter({ hasText: purpose }).first();
  await expect(row).toContainText("بانتظار الموافقة");
  await row.getByRole("button").first().click();
  const detail = page.getByRole("dialog");
  await expect(detail).toContainText("470.00");
  await detail.getByRole("button", { name: "إلغاء الطلب" }).click();
  await expect(detail).toContainText("ملغى");
});
