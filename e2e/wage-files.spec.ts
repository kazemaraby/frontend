import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Wage files (Phase 4 task 14): on January 2025's approved payroll (made by payslips.spec), the tenant admin asks
 * for the bank transfer list; two employees with incomplete data are named, the file is made without them (they're
 * listed on it), and it downloads through a signed link. */
test("a bank file of an approved payroll", async ({ browser }) => {
  test.setTimeout(90_000);
  const admin = await signedIn(browser, "qa@cactus.localhost");
  await admin.goto("/payroll?month=2025-01");
  await expect(admin.getByText("معتمد ومقفل").first()).toBeVisible();
  await admin.getByRole("button", { name: "ملف حماية الأجور" }).click();
  const dialog = admin.getByRole("dialog");
  await dialog.locator('select[name="format"]').selectOption("generic_csv");
  await dialog.getByRole("button", { name: "إنشاء الملف" }).click();
  await expect(dialog).toContainText("صحّح هذه أولًا");
  await expect(dialog).toContainText("لا آيبان صحيح");
  await dialog.getByRole("button", { name: /إنشاء الملف دونهم/ }).click();
  const made = dialog.getByRole("row").filter({ hasText: "قائمة تحويل بنكي" }).first();
  await expect(made).toContainText("خارج الملف: 2");

  const link = admin.waitForResponse((r) => /\/files\/\d+\/download/.test(r.url()));
  const tab = admin.context().waitForEvent("page");
  await made.getByRole("button", { name: /^تنزيل / }).click();
  expect((await link).status()).toBe(200);
  await (await tab).close();
});
