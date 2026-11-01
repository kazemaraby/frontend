import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Custody (Phase 2 task 14): hr@ hands the demo Lenovo laptop to employee@ (رؤيا حاوي), who confirms receiving
 * it; hr@ receives it back in good condition, so the laptop is available again for the next run. */

const LAPTOP = /Lenovo ThinkPad/;

test("HR hands over a laptop, the employee confirms it, HR receives it back", async ({ browser }) => {
  test.setTimeout(60_000);
  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/custody");
  const records = hr.getByRole("table", { name: "سجلات العهد" });
  // A run that stopped half-way left the laptop out: receive it first.
  const leftover = records.getByRole("row").filter({ hasText: LAPTOP });
  if (await leftover.count()) {
    await leftover.first().getByRole("button", { name: /^استلام/ }).click();
    await hr.getByRole("dialog").getByRole("button", { name: "استلام", exact: true }).click();
    await expect(leftover).toHaveCount(0);
  }

  await hr.getByRole("button", { name: "تسليم عهدة" }).click();
  const dialog = hr.getByRole("dialog");
  await dialog.getByRole("searchbox").fill("رؤيا حاوي");
  await dialog.locator('select[name="employee"]').selectOption({ label: "رؤيا حاوي · EMP-004" });
  await dialog.locator('select[name="item"]').selectOption({ label: "حاسب محمول Lenovo ThinkPad · IT-0002" });
  await dialog.locator('input[name="condition_out"]').fill("مع الشاحن والحقيبة");
  await dialog.getByRole("button", { name: "تسليم", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(records.getByRole("row").filter({ hasText: LAPTOP })).toContainText("لم يؤكد الاستلام بعد");

  const employee = await signedIn(browser, "employee@cactus.localhost");
  await employee.goto("/custody");
  const mine = employee.getByRole("table", { name: "سجلات العهد" }).getByRole("row").filter({ hasText: LAPTOP });
  await mine.getByRole("button", { name: "تأكيد الاستلام" }).click();
  await expect(mine).not.toContainText("لم يؤكد الاستلام بعد");

  await hr.reload();
  const row = records.getByRole("row").filter({ hasText: LAPTOP });
  await expect(row).not.toContainText("لم يؤكد الاستلام بعد");
  await row.getByRole("button", { name: /^استلام/ }).click();
  const receive = hr.getByRole("dialog");
  await expect(receive.locator('select[name="condition_in"]')).toHaveValue("good");
  await receive.getByRole("button", { name: "استلام", exact: true }).click();
  await expect(receive).toBeHidden();
  await expect(row).toHaveCount(0);

  await hr.getByRole("tab", { name: "سجل الأصناف" }).click();
  await expect(hr.getByRole("table", { name: "سجل الأصناف" }).getByRole("row").filter({ hasText: LAPTOP })).toContainText("متاح");
});
