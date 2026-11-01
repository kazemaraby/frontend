import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Leave pay in advance (Phase 4 task 5, Art. 109): the employee's leave form offers it for annual leave only. */
test("annual leave can be paid in advance, sick leave can't", async ({ browser }) => {
  const employee = await signedIn(browser, "employee@cactus.localhost");
  await employee.goto("/leave");
  await employee.getByRole("button", { name: "طلب إجازة" }).click();
  const dialog = employee.getByRole("dialog");
  const advance = dialog.getByRole("checkbox", { name: "صرف راتب الإجازة مقدمًا" });

  await dialog.locator('select[name="leave_type"]').selectOption({ label: "إجازة سنوية" });
  await expect(advance).toBeVisible();
  await expect(dialog).toContainText("المادة 109");
  await advance.check();
  await expect(advance).toBeChecked();

  await dialog.locator('select[name="leave_type"]').selectOption({ label: "إجازة مرضية" });
  await expect(advance).toHaveCount(0);
  await dialog.getByRole("button", { name: "إلغاء" }).click();
  await expect(dialog).toBeHidden();
});
