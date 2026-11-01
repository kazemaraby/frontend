import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** GOSI rates (Phase 4 task 7): the account's table shows the 2024 law's rising annuities rate for those first
 * registered from 3 July 2024, and the employer-only occupational hazards rate for non-Saudis. */
test("the GOSI rate table", async ({ browser }) => {
  const admin = await signedIn(browser, "qa@cactus.localhost");
  await admin.goto("/settings/payroll?tab=gosi");
  const table = admin.getByRole("table", { name: "نسب التأمينات الاجتماعية" });
  await expect(table.getByRole("row").filter({ hasText: "المعاشات" })).toHaveCount(6);
  await expect(table.getByRole("row").filter({ hasText: "المعاشات" }).filter({ hasText: "11%" })).toHaveCount(1);
  await expect(table.getByRole("row").filter({ hasText: "غير السعوديين" })).toContainText("2%");
  await expect(admin.getByRole("main")).toContainText("تحتاج إلى تأكيد");
});
