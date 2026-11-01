import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** The compliance dashboard and report (Phase 5 task 12): the admin runs the checks now (no alerts are sent), reads
 * the establishment's risk score, opens the documents' items from the dashboard into the report, and exports it. */
test("compliance dashboard: run the checks, the score, the report", async ({ browser }) => {
  const admin = await signedIn(browser, "qa@cactus.localhost");
  await admin.goto("/compliance");
  await admin.getByRole("button", { name: "تشغيل الفحص الآن" }).click();
  const card = admin.getByRole("region", { name: "المنشأة 7-1234567" });
  await expect(card.getByRole("img", { name: /^مؤشر مخاطر 7-1234567/ })).toBeVisible();
  await expect(admin.getByText(/^فُحص في/)).toBeVisible();

  await admin.getByRole("region", { name: "البنود المفتوحة حسب المجال" }).getByRole("button", { name: /^المستندات/ }).click();
  await expect(admin.getByRole("tab", { name: "التقرير" })).toHaveAttribute("aria-selected", "true");
  const report = admin.getByRole("region", { name: "تقرير الامتثال" });
  await expect(report.locator('select[name="area"]')).toHaveValue("documents");
  await expect(report.getByRole("row").nth(1)).toBeVisible();
  const download = admin.waitForEvent("download");
  await report.getByRole("button", { name: "تصدير إلى Excel" }).click();
  expect((await download).suggestedFilename()).toMatch(/^compliance-report-.*\.xlsx$/);
});
