import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Iqama and work-permit renewals (Phase 5 task 11): the admin sees EMP-003's renewal due with its fees, records the
 * fees as paid and reopens it (the dev data stays as it was), then reads the next 12 months' cost and exports it. */
test("renewals: the schedule, paid and reopened, and the forecast", async ({ browser }) => {
  const admin = await signedIn(browser, "qa@cactus.localhost");
  await admin.goto("/compliance?tab=renewals");
  const schedule = admin.getByRole("region", { name: "تجديد الإقامات ورخص العمل" });
  const row = schedule.getByRole("row").filter({ hasText: "EMP-003" });
  await expect(row).toContainText("مستحق");
  await expect(row).toContainText("المقابل المالي");

  await row.getByRole("button", { name: /^تسجيل سداد رسوم تجديد/ }).click();
  const dialog = admin.getByRole("dialog");
  await dialog.getByRole("button", { name: "حفظ" }).click();
  await expect(dialog).toBeHidden();
  await expect(row).toContainText("مدفوع");
  await row.getByRole("button", { name: /^إعادة فتح تجديد/ }).click();
  await expect(row).toContainText("مستحق");

  const forecast = admin.getByRole("region", { name: "تكاليف التجديد خلال 12 شهرًا" });
  await expect(forecast.getByRole("row").nth(1)).toBeVisible();
  const download = admin.waitForEvent("download");
  await forecast.getByRole("button", { name: "تصدير إلى Excel" }).click();
  expect((await download).suggestedFilename()).toMatch(/^renewals-forecast-.*\.xlsx$/);
});
