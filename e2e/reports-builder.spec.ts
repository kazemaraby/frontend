import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

const OUT = process.env.SHOT_DIR;

/** The custom report builder (Phase 6 task 18): HR builds totals by department (count and the average basic salary),
 * previews them (small groups' salary totals hidden), saves the report, downloads it as PDF and deletes it again. */
test("HR builds, saves and downloads a custom report", async ({ browser }) => {
  test.setTimeout(150_000);
  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/reports?tab=builder");
  const card = hr.getByRole("region", { name: "منشئ التقارير" });
  await card.locator('select[name="dataset"]').selectOption("employees");
  await card.getByRole("tab", { name: "مجاميع حسب مجموعة" }).click();
  await card.locator('select[name="group_0"]').selectOption("department");
  await card.getByRole("button", { name: "إضافة مجموع" }).click();
  await card.getByRole("button", { name: "إضافة مجموع" }).click();
  await card.locator('select[name="fn_1"]').selectOption("avg");
  await card.locator('select[name="agg_field_1"]').selectOption("basic_salary");
  const answer = hr.waitForResponse((r) => r.url().includes("/report-builder/preview"));
  await card.getByRole("button", { name: "معاينة" }).click();
  const result = await (await answer).json();
  expect((await answer).ok()).toBe(true);
  const results = hr.getByRole("region", { name: "النتيجة" });
  await expect(results.getByRole("row")).toHaveCount(result.rows.length + 1);
  if (result.suppressed) await expect(results).toContainText("أُخفيت مجاميع");
  if (OUT) await hr.screenshot({ path: `${OUT}/builder.png`, fullPage: true });

  await card.locator('input[name="report_name"]').fill("الموظفون حسب الإدارة (اختبار)");
  await card.getByRole("button", { name: "حفظ التقرير" }).click();
  await expect(card.getByRole("status")).toContainText("حُفظ.");
  const saved = hr.getByRole("region", { name: "تقاريري المحفوظة" }).getByRole("listitem").filter({ hasText: "الموظفون حسب الإدارة (اختبار)" });
  const pdf = hr.waitForEvent("download");
  await saved.getByRole("button", { name: "تصدير PDF" }).click();
  expect((await pdf).suggestedFilename()).toMatch(/\.pdf$/);
  await saved.getByRole("button", { name: /حذف/ }).click();
  await expect(saved).toHaveCount(0);
});
