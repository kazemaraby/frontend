import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Export and scheduled reports (Phase 6 task 17): the dashboard downloads as PDF and Excel; HR schedules a report,
 * only people allowed to see it can be picked as recipients, sends it now, and deletes the schedule again (the demo
 * stays clean); a report's own screen has the PDF too; a link that isn't the reader's opens nothing. */
test("HR exports the dashboard and schedules a report", async ({ browser }) => {
  test.setTimeout(150_000);
  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/reports");
  const pdf = hr.waitForEvent("download");
  await hr.getByRole("button", { name: "تصدير PDF" }).click();
  expect((await pdf).suggestedFilename()).toMatch(/^hr-dashboard-.*\.pdf$/);

  await hr.getByRole("tab", { name: "التقارير المجدولة" }).click();
  const card = hr.getByRole("region", { name: "التقارير المجدولة" });
  await card.getByRole("button", { name: "جدولة تقرير" }).click();
  const dialog = hr.getByRole("dialog", { name: "جدولة تقرير" });
  await dialog.locator('input[name="name"]').fill("قائمة الموظفين (اختبار)");
  await dialog.locator('select[name="report"]').selectOption("employees");
  await expect(dialog.getByText("manager@cactus.localhost")).toHaveCount(0); // a line manager may not export it
  await dialog.locator('select[name="format"]').selectOption("pdf");
  await dialog.getByRole("button", { name: "حفظ" }).click();
  await expect(dialog).toBeHidden();
  const row = card.getByRole("row").filter({ hasText: "قائمة الموظفين (اختبار)" });
  await expect(row).toContainText("مفعلة");
  await row.getByRole("button", { name: "إرسال الآن" }).click();
  await expect(card.getByRole("status")).toContainText("أُرسل إلى شخص واحد");
  await expect(row).toContainText("أُرسل");
  await row.getByRole("button", { name: /حذف/ }).click();
  await expect(row).toHaveCount(0);

  await hr.goto("/leave?tab=balances");
  const leavePdf = hr.waitForEvent("download");
  await hr.getByRole("button", { name: "تصدير PDF" }).first().click();
  expect((await leavePdf).suggestedFilename()).toMatch(/\.pdf$/);

  await hr.goto("/reports/files/not-a-real-link");
  await expect(hr.getByRole("alert")).toContainText("انتهت صلاحية هذا الرابط أو أنه ليس لك.");
});
