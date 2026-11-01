import { expect, test } from "@playwright/test";

import { signIn } from "./helpers";

/** Leave types and policies (Phase 2 task 6): HR gives the company its own annual-leave policy, changes it, and goes
 * back to the account's; the seeded statutory types are listed with their entitlements. */

test("HR gives the company its own annual-leave policy and goes back", async ({ page }) => {
  await signIn(page, "hr@cactus.localhost");
  await page.goto("/settings");
  await page.getByRole("link", { name: /أنواع الإجازات وسياساتها/ }).click();
  const annual = page.getByRole("row").filter({ hasText: "إجازة سنوية" });
  const back = annual.getByRole("button", { name: "اتباع سياسة الحساب" });
  await expect(annual.getByRole("button", { name: /سياسة/ }).first()).toBeVisible();
  if (await back.count()) await back.click(); // a run that stopped half-way left the company's own policy
  await expect(annual).toContainText("21 يوماً في السنة");
  await expect(page.getByRole("row").filter({ hasText: "إجازة وضع" })).toContainText("للنساء فقط");

  await annual.getByRole("button", { name: "سياسة خاصة لهذه الشركة" }).click();
  await expect(annual.getByRole("button", { name: "اتباع سياسة الحساب" })).toBeVisible(); // now the company's own
  await annual.getByRole("button", { name: "تعديل سياسة إجازة سنوية" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("سياسة هذه الشركة الخاصة");
  await dialog.getByLabel("أيام في السنة").first().fill("25");
  await dialog.getByRole("button", { name: "حفظ" }).click();
  await expect(dialog).toBeHidden();
  await expect(annual).toContainText("25 يوماً في السنة");

  await annual.getByRole("button", { name: "اتباع سياسة الحساب" }).click();
  await expect(annual.getByRole("button", { name: "سياسة خاصة لهذه الشركة" })).toBeVisible();
  await expect(annual).toContainText("21 يوماً في السنة");
});
