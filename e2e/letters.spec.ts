import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Letters (Phase 2 task 13): employee@ asks for an experience certificate, hr@ approves it and the PDF shows in
 * the employee's letters; hr@ then revokes it in /settings/letters (the demo employment certificate stays valid).
 * The public verification page opens without signing in. */

test("an employee asks for a letter, HR approves it, then revokes it", async ({ browser }) => {
  test.setTimeout(60_000);
  const employee = await signedIn(browser, "employee@cactus.localhost");
  await employee.goto("/requests");
  await employee.getByRole("button", { name: /^طلب جديد/ }).click();
  await employee.getByRole("button", { name: "طلب خطاب", exact: true }).click();
  const dialog = employee.getByRole("dialog");
  await dialog.locator('select[name="template"]').selectOption({ label: "شهادة خبرة" });
  await dialog.locator('input[name="addressee"]').fill(`سفارة ${Date.now() % 100000}`);
  await dialog.getByRole("button", { name: "إرسال" }).click();
  await expect(dialog).toBeHidden();
  await expect(employee.getByRole("row").filter({ hasText: "شهادة خبرة" }).filter({ hasText: "بانتظار الموافقة" }).first()).toBeVisible();

  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/approvals");
  await hr.getByRole("row").filter({ hasText: "شهادة خبرة" }).first().getByRole("button", { name: "موافقة", exact: true }).click();
  const decide = hr.getByRole("dialog");
  await decide.getByRole("button", { name: "موافقة", exact: true }).click();
  await expect(decide).toBeHidden();

  await employee.reload();
  const mine = employee.getByRole("table", { name: "خطاباتي" });
  await expect(mine.getByRole("row").filter({ hasText: "شهادة خبرة" }).filter({ hasText: "ساري" }).first()).toBeVisible();

  await hr.goto("/settings/letters");
  const issued = hr.getByRole("table", { name: "الخطابات الصادرة" });
  const row = issued.getByRole("row").filter({ hasText: "رؤيا حاوي" }).filter({ hasText: "شهادة خبرة" }).filter({ hasText: "ساري" }).first();
  await row.getByRole("button", { name: /^إلغاء LTR-/ }).click();
  const revoke = hr.getByRole("dialog");
  await revoke.locator('textarea[name="reason"]').fill("اختبار آلي");
  await revoke.getByRole("button", { name: "إلغاء الخطاب" }).click();
  await expect(revoke).toBeHidden();
  await expect(issued.getByRole("row").filter({ hasText: "اختبار آلي" }).first()).toContainText("ملغى");
});

test("the verification page opens without signing in", async ({ page }) => {
  await page.goto("/verify/not-a-real-code");
  await expect(page.getByRole("heading", { name: "التحقق من خطاب" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("لا يوجد خطاب بهذا الرمز.");
  await expect(page).toHaveURL(/\/verify\//); // not sent to the sign-in page
});
