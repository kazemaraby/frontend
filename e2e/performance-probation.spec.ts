import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Probation evaluation (Phase 6 task 11): the demo's new hire under manager@ is 10 days from the end of probation,
 * so the evaluation is open. manager@ fills it in (choosing "end" shows what follows) and saves it without sending
 * (sending would start the decision's approval: the demo stays open); HR sees it too. */
test("the manager evaluates a probation before it ends", async ({ browser }) => {
  test.setTimeout(120_000);
  const manager = await signedIn(browser, "manager@cactus.localhost");
  await manager.goto("/performance?tab=probation");
  const list = manager.getByRole("region", { name: "تقييم فترة التجربة" });
  const row = list.getByRole("row").filter({ hasText: "سلمان العتيبي" });
  await expect(row).toContainText(/مفتوح|أُعيد/);
  await row.getByRole("button", { name: "تقييم" }).click();
  const dialog = manager.getByRole("dialog");
  await dialog.locator('textarea[name="strengths"]').fill("يتعلم بسرعة ويتعاون مع الفريق");
  await dialog.locator('select[name="recommendation"]').selectOption("end");
  await expect(dialog).toContainText("تبدأ إجراءات إخلاء الطرف");
  await dialog.locator('select[name="recommendation"]').selectOption("confirm");
  await dialog.getByRole("button", { name: "حفظ" }).click();
  await expect(dialog.getByRole("button", { name: "حفظ" })).toBeEnabled();
  await manager.keyboard.press("Escape");
  await expect(row).toContainText("تثبيت الموظف");

  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/performance?tab=probation");
  await expect(hr.getByRole("region", { name: "تقييم فترة التجربة" }).getByRole("row").filter({ hasText: "سلمان العتيبي" })).toBeVisible();
});
