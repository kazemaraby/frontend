import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Performance setup (Phase 6 task 8): HR sees the demo cycle under way with its people, the 70/30 template and the
 * scale; adds a competency and deletes it again; employee@ sees the cycle under way (no setup tabs). */
test("HR keeps the performance setup and employees see the cycle under way", async ({ browser }) => {
  test.setTimeout(120_000);
  const year = new Date().getFullYear();
  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/performance?tab=cycles");
  const cycles = hr.getByRole("region", { name: "دورات التقييم" });
  const row = cycles.getByRole("row").filter({ hasText: `التقييم السنوي ${year}` });
  await expect(row).toContainText("جارية");
  await row.getByRole("button", { name: /^[0-9٠-٩]+$/ }).click();
  await expect(hr.getByRole("dialog").getByRole("listitem").first()).toBeVisible();
  await hr.keyboard.press("Escape");

  await hr.getByRole("tab", { name: "نماذج التقييم" }).click(); // the setup's inner tabs
  await expect(hr.getByRole("region", { name: "نماذج التقييم" }).getByRole("row").filter({ hasText: "التقييم السنوي" })).toContainText("70");
  await hr.getByRole("tab", { name: "مقاييس التقييم" }).click();
  await expect(hr.getByRole("region", { name: "مقاييس التقييم" })).toContainText("استثنائي");

  await hr.getByRole("tab", { name: "الجدارات" }).click();
  const library = hr.getByRole("region", { name: "مكتبة الجدارات" });
  await library.getByRole("button", { name: "جدارة جديدة" }).click();
  const dialog = hr.getByRole("dialog");
  const code = `e2e-${Date.now()}`;
  await dialog.locator('input[name="code"]').fill(code);
  await dialog.locator('input[name="name_ar"]').fill("جدارة الاختبار");
  await dialog.getByRole("button", { name: "حفظ" }).click();
  await expect(dialog).toBeHidden();
  const added = library.getByRole("row").filter({ hasText: "جدارة الاختبار" }).first();
  await added.getByRole("button", { name: /^حذف/ }).click();
  await expect(library.getByRole("row").filter({ hasText: "جدارة الاختبار" })).toHaveCount(0);

  const employee = await signedIn(browser, "employee@cactus.localhost");
  await employee.goto("/performance");
  await expect(employee.getByRole("tab", { name: "نماذج التقييم" })).toHaveCount(0);
  await expect(employee.getByRole("region", { name: "دورات التقييم الجارية" })).toContainText(`التقييم السنوي ${year}`);
});
