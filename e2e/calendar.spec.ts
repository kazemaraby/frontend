import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** The work calendar (Phase 2 task 5) on the cactus demo tenant: holidays from the rules, a company event added by HR
 * and seen by an employee, and switching a holiday off and on in settings. */

const NEXT_YEAR = new Date().getFullYear() + 1;
const day = (d: number) => `${NEXT_YEAR}-09-${String(d).padStart(2, "0")}`;

test("HR adds a company event; an employee sees it with the National Day holiday", async ({ browser }) => {
  test.setTimeout(60_000);
  const title = `حفل اليوم الوطني ${Date.now()}`;
  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto(`/calendar?month=${NEXT_YEAR}-09`);
  const grid = hr.getByRole("grid");
  await expect(grid.getByRole("button", { name: /اليوم الوطني/ })).toHaveCount(1); // made from the rule

  await hr.getByRole("button", { name: "فعالية جديدة" }).click();
  const dialog = hr.getByRole("dialog");
  await dialog.locator('input[name="title_ar"]').fill(title);
  await dialog.locator('input[name="start_date"]').fill(day(22));
  await dialog.locator('input[name="end_date"]').fill(day(22));
  await dialog.getByLabel("طوال اليوم").uncheck();
  await dialog.locator('input[name="start_time"]').fill("19:00");
  await dialog.locator('input[name="location"]').fill("قاعة الاحتفالات");
  await dialog.getByRole("button", { name: "حفظ" }).click();
  await expect(dialog).toBeHidden();
  await expect(grid.getByRole("button", { name: new RegExp(title) })).toBeVisible();

  const employee = await signedIn(browser, "employee@cactus.localhost");
  await employee.goto(`/calendar?month=${NEXT_YEAR}-09`);
  await employee.getByRole("grid").getByRole("button", { name: new RegExp(title) }).click();
  const selected = employee.getByRole("region", { name: "اليوم المحدد" });
  await expect(selected).toContainText(title);
  await expect(selected).toContainText("قاعة الاحتفالات");
  await expect(employee.getByRole("button", { name: "فعالية جديدة" })).toHaveCount(0); // employees only read

  // HR removes it again.
  await hr.getByRole("grid").getByRole("button", { name: new RegExp(title) }).click();
  await hr.getByRole("region", { name: "اليوم المحدد" }).getByRole("button", { name: "تعديل" }).click();
  await hr.getByRole("dialog").getByRole("button", { name: "حذف" }).click();
  await expect(hr.getByRole("grid").getByRole("button", { name: new RegExp(title) })).toHaveCount(0);
});

test("HR switches a holiday off and on again in settings", async ({ browser }) => {
  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/settings");
  await hr.getByRole("link", { name: /العطل وأيام العمل/ }).click();
  const row = hr.getByRole("row").filter({ hasText: "اليوم الوطني" });
  await expect(row).toContainText("مفعّلة");
  await row.getByRole("button", { name: "إيقاف اليوم الوطني" }).click();
  await expect(row).toContainText("موقوفة");
  await row.getByRole("button", { name: "تفعيل اليوم الوطني" }).click();
  await expect(row).toContainText("مفعّلة");

  await hr.getByRole("tab", { name: "القواعد" }).click();
  await expect(hr.getByRole("row").filter({ hasText: "عطلة عيد الفطر" })).toContainText("اليوم 30 من رمضان");
});
