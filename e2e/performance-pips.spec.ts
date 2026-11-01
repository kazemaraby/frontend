import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Improvement plans (Phase 6 task 12): the demo has an active plan for manager@'s team member EMP-003. manager@
 * records a check-in on it, drafts one for employee@ (who doesn't see a draft) and deletes it again; HR opens the
 * close dialog, where "ended" is offered, and leaves the demo plan open. */
test("a manager runs an improvement plan and HR may close it", async ({ browser }) => {
  test.setTimeout(120_000);
  const manager = await signedIn(browser, "manager@cactus.localhost");
  await manager.goto("/performance?tab=pips");
  const list = manager.getByRole("region", { name: "خطط تحسين الأداء" });
  const row = list.getByRole("row").filter({ hasText: "كافي مروان" });
  await expect(row).toContainText("جارية");
  await row.getByRole("button", { name: "عرض" }).click();
  const note = "التزم بموعد تقرير هذا الأسبوع";
  await manager.locator('textarea[name="check_in_note"]').fill(note);
  await manager.getByRole("button", { name: "تسجيل متابعة" }).click();
  await expect(manager.getByRole("region", { name: "المتابعات" })).toContainText(note);
  await expect(manager.getByRole("button", { name: "إغلاق الخطة" })).toHaveCount(0); // HR's

  await list.getByRole("button", { name: "خطة جديدة" }).click();
  const dialog = manager.getByRole("dialog", { name: "خطة جديدة" });
  const option = dialog.locator('select[name="employee"] option').filter({ hasText: "EMP-004" });
  await dialog.locator('select[name="employee"]').selectOption(await option.getAttribute("value") ?? "");
  await dialog.locator('textarea[name="reason"]').fill("تأخر في الرد على العملاء");
  await dialog.locator('input[name="start_date"]').fill("2026-11-01");
  await dialog.locator('input[name="end_date"]').fill("2026-12-31");
  await dialog.locator('textarea[name="objective_0"]').fill("الرد خلال يوم عمل");
  await dialog.locator('textarea[name="success_0"]').fill("95٪ من الطلبات");
  await dialog.locator('input[name="due_0"]').fill("2026-12-15");
  await dialog.getByRole("button", { name: "حفظ" }).click();
  await expect(dialog).toBeHidden();
  const draft = list.getByRole("row").filter({ hasText: "رؤيا حاوي" });
  await expect(draft).toContainText("مسودة");

  const employee = await signedIn(browser, "employee@cactus.localhost");
  await employee.goto("/performance?tab=pips");
  await expect(employee.getByRole("region", { name: "خطط تحسين الأداء" })).toContainText("لا خطط تحسين.");

  await draft.getByRole("button", { name: /حذف/ }).click();
  await expect(draft).toHaveCount(0);

  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/performance?tab=pips");
  await hr.getByRole("region", { name: "خطط تحسين الأداء" }).getByRole("row").filter({ hasText: "كافي مروان" }).getByRole("button", { name: "عرض" }).click();
  await hr.getByRole("button", { name: "إغلاق الخطة" }).click();
  const close = hr.getByRole("dialog", { name: "إغلاق الخطة" });
  await close.locator('select[name="outcome"]').selectOption("extended");
  await expect(close.locator('input[name="until"]')).toBeVisible();
  await hr.keyboard.press("Escape");
});
