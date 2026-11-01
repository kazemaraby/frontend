import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Appraisals (Phase 6 task 10): the demo's first-half cycle has manager@'s team reviewed and waiting for calibration.
 * HR sees the distribution and each person's score, and confirms one rating unchanged (no reason needed); employee@
 * sees their appraisal at calibration with their own ratings and not yet the manager's or the result; manager@ sees
 * the reviews they wrote. Nothing is released, so the demo stays as it is. */
test("HR calibrates and the employee doesn't see the result before the release", async ({ browser }) => {
  test.setTimeout(120_000);
  const year = new Date().getFullYear();
  const half = `تقييم النصف الأول ${year}`;

  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/performance?tab=calibration");
  await hr.locator('select[name="cycle"]').selectOption({ label: half });
  const card = hr.getByRole("region", { name: "المعايرة" });
  await expect(card.getByRole("region", { name: "توزيع التقديرات" })).toBeVisible();
  const row = card.getByRole("row").filter({ hasText: "المعايرة" }).first();
  await expect(row).toContainText(/[0-9٠-٩][.٫][0-9٠-٩] → [0-9٠-٩]/);
  await row.getByRole("button", { name: "معايرة" }).click();
  const dialog = hr.getByRole("dialog");
  await dialog.getByRole("button", { name: "حفظ" }).click(); // the same rating: no reason needed
  await expect(dialog).toBeHidden();

  const employee = await signedIn(browser, "employee@cactus.localhost");
  await employee.goto("/performance?tab=appraisal");
  await employee.locator('select[name="cycle"]').selectOption({ label: half });
  const mine = employee.getByRole("region", { name: "تقييمي" });
  await expect(mine).toContainText("المعايرة");
  await expect(mine).toContainText("تقييم الموظف:");
  await expect(mine).not.toContainText("تقييم المدير:");
  await expect(mine).not.toContainText("التقدير النهائي");

  const manager = await signedIn(browser, "manager@cactus.localhost");
  await manager.goto("/performance?tab=reviews");
  await manager.locator('select[name="cycle"]').selectOption({ label: half });
  await expect(manager.getByRole("region", { name: "تقييمات فريقي" }).getByRole("button")).toHaveCount(2);
});
