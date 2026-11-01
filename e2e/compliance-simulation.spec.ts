import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Nitaqat simulation (Phase 5 task 5): the admin hires three Saudis and lets one employee go in a simulation of the
 * company's establishment; the result shows the band and percent before and after, and nothing changes. */
test("Nitaqat simulation: hires and a leaver, before and after", async ({ browser }) => {
  const admin = await signedIn(browser, "qa@cactus.localhost");
  await admin.goto("/compliance?tab=nitaqat");
  const card = admin.getByRole("region", { name: "المنشأة 7-1234567" });
  await card.getByRole("button", { name: "محاكاة" }).click();
  const dialog = admin.getByRole("dialog");
  await expect(dialog).toContainText("محاكاة فقط: لا يُحفظ شيء");

  await dialog.locator('input[name="count-0"]').fill("3");
  await dialog.locator('input[name="wage-0"]').fill("5000");
  const leaving = dialog.getByRole("region", { name: "المغادرون" });
  await leaving.getByRole("searchbox").fill("EMP-003");
  const select = leaving.locator('select[name="leaving-employee"]');
  const option = select.locator("option", { hasText: "EMP-003" });
  await expect(option).toHaveCount(1);
  await select.selectOption((await option.getAttribute("value"))!);
  await expect(leaving).toContainText("EMP-003");
  await dialog.getByRole("button", { name: "احسب" }).click();

  const result = dialog.getByRole("region", { name: "قبل وبعد" });
  await expect(result.getByRole("row").filter({ hasText: "نسبة التوطين" })).toBeVisible();
  const before = Number((await result.getByRole("columnheader", { name: /^الآن/ }).textContent())?.match(/\d+/)?.[0]);
  const after = Number((await result.getByRole("columnheader", { name: /^بعد، على المتوسط/ }).textContent())?.match(/\d+/)?.[0]);
  expect(after).toBe(before + 2); // three hired, one leaving
  await dialog.getByRole("button", { name: "إغلاق", exact: true }).first().click();
  await expect(dialog).toBeHidden();
});
