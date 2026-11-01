import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Raises and bonuses (Phase 6 task 13): the demo has a draft review of last year's annual cycle with proposals for
 * manager@'s team. HR sees the matrix, the budgets and the amounts; manager@ sees only percentages for the team (not
 * their own), and going over the team's share is refused. Nothing is sent: the demo stays a draft. */
test("HR sets the review and a manager adjusts within the team's share", async ({ browser }) => {
  test.setTimeout(120_000);
  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/performance?tab=compensation");
  const cycle = hr.locator('select[name="compensation_cycle"]');
  const option = cycle.locator("option").filter({ hasText: /التقييم السنوي 2025/ });
  await cycle.selectOption((await option.getAttribute("value")) ?? "");
  const review = hr.getByRole("region", { name: /الزيادات والمكافآت: التقييم السنوي 2025/ });
  await expect(review).toContainText("مسودة");
  await expect(review.locator('input[name="raise_5_lower"]')).toHaveValue("8");
  await expect(review.getByRole("progressbar", { name: /الزيادات/ })).toBeVisible();
  await expect(review.getByRole("button", { name: "إرسال للاعتماد" })).toBeEnabled();
  const proposals = hr.getByRole("region", { name: "المقترحات" });
  await expect(proposals.getByRole("row").filter({ hasText: "كافي مروان" })).toContainText("%");
  await expect(proposals.getByRole("columnheader", { name: "الأساسي" })).toBeVisible(); // amounts for HR

  const manager = await signedIn(browser, "manager@cactus.localhost");
  await manager.goto("/performance?tab=compensation");
  const team = manager.getByRole("region", { name: "مقترحات فريقك" });
  const row = team.getByRole("row").filter({ hasText: "كافي مروان" });
  await expect(row).toBeVisible();
  await expect(team.getByRole("columnheader", { name: "الأساسي" })).toHaveCount(0); // no salary access
  await expect(manager.getByRole("progressbar", { name: "زيادات فريقك من حصته" })).toBeVisible();
  await row.getByRole("button", { name: /تعديل/ }).click();
  const dialog = manager.getByRole("dialog");
  await dialog.locator('input[name="raise_pct"]').fill("40");
  await dialog.getByRole("button", { name: "حفظ" }).click();
  await expect(dialog).toContainText("يتجاوز هذا حصة فريقك من الزيادات.");
  await manager.keyboard.press("Escape");
});
