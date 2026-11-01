import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Goals (Phase 6 task 9): employee@'s demo goals (100 %) wait for manager@; manager@ sends them back with a note;
 * employee@ sees the note, can change them again and sends them once more (the demo ends as it started); HR sees the
 * department goal given to its people. */
test("goals go to the manager, come back with a note and are sent again", async ({ browser }) => {
  test.setTimeout(120_000);
  const employee = await signedIn(browser, "employee@cactus.localhost");
  await employee.goto("/performance");
  const mine = employee.getByRole("region", { name: "أهدافي" });
  await expect(mine).toContainText("بانتظار المدير");
  await expect(mine).toContainText("رفع رضا العملاء إلى 90٪");
  await expect(mine.getByRole("button", { name: "إرسال للمدير" })).toHaveCount(0);

  const manager = await signedIn(browser, "manager@cactus.localhost");
  await manager.goto("/performance?tab=team");
  const team = manager.getByRole("region", { name: "أهداف فريقي" });
  await team.getByRole("button", { name: /بانتظار المدير/ }).first().click();
  const sheet = manager.getByRole("region", { name: /^أهداف (?!فريقي)/ });
  await sheet.getByRole("button", { name: "إعادة للتعديل" }).click();
  const dialog = manager.getByRole("dialog");
  await dialog.locator('textarea[name="note"]').fill("حدّد رقماً للهدف الثاني");
  await dialog.getByRole("button", { name: "إعادة للتعديل" }).click();
  await expect(dialog).toBeHidden();
  await expect(sheet).toContainText("مسودة");

  await employee.reload();
  await expect(mine).toContainText("أعاد مديرك الأهداف: حدّد رقماً للهدف الثاني");
  await mine.getByRole("button", { name: "إرسال للمدير" }).click();
  await expect(mine).toContainText("بانتظار المدير");

  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/performance?tab=departmentGoals");
  await expect(hr.getByRole("region", { name: "أهداف الإدارات" }).getByRole("row").filter({ hasText: "رفع رضا العملاء" })).toBeVisible();
});
