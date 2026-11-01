import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Nitaqat and the Saudization report (Phase 5 task 4): the admin works today's Nitaqat out, reads the company's
 * establishment (no activity chosen yet in the dev data: the problem is shown with the counts), opens who counts how
 * much, then the Saudization report by branch and its Excel file. */
test("Nitaqat per establishment and the Saudization report", async ({ browser }) => {
  const admin = await signedIn(browser, "qa@cactus.localhost");
  await admin.goto("/compliance?tab=nitaqat");
  await admin.getByRole("button", { name: "احتساب الآن" }).click();
  const card = admin.getByRole("region", { name: "المنشأة 7-1234567" });
  await expect(card).toContainText("الموظفون");
  await expect(card.getByRole("img", { name: /^نسبة توطين 7-1234567: / })).toBeVisible(); // the gauge (the trend chart is "… أسبوعًا بأسبوع")

  await card.getByRole("button", { name: "من يُحتسب وبكم" }).click();
  const dialog = admin.getByRole("dialog");
  await expect(dialog.getByRole("row").filter({ hasText: "EMP-004" })).toBeVisible();
  await dialog.getByRole("button", { name: /إغلاق/ }).click();

  await admin.getByRole("tab", { name: "التوطين" }).click();
  const report = admin.getByRole("region", { name: "تقرير التوطين" });
  await report.locator('select[name="by"]').selectOption({ label: "الفرع" });
  await expect(report.getByRole("row").filter({ hasText: "الفرع الرئيسي" })).toBeVisible();
  const download = admin.waitForEvent("download");
  await report.getByRole("button", { name: "تصدير إلى Excel" }).click();
  expect((await download).suggestedFilename()).toMatch(/^saudization-branch-.*\.xlsx$/);
});
