import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Shifts (Phase 3 task 2): hr@ creates a day shift; its working hours come from the times minus the unpaid lunch,
 * the Labor Law's limits are checked as the times change (Art. 98 hours, Art. 101 break), a shift without Ramadan
 * times is flagged, then the shift is deleted again. */
test("HR builds a shift whose hours come from its times", async ({ browser }) => {
  test.setTimeout(60_000);
  const hr = await signedIn(browser, "hr@cactus.localhost");
  const name = `صباحية ${Date.now() % 100000}`;
  await hr.goto("/settings/attendance");
  await hr.getByRole("button", { name: "إضافة وردية" }).click();
  const dialog = hr.getByRole("dialog");
  await dialog.locator('input[name="name_ar"]').fill(name);
  await dialog.locator('input[name="normal_start_0"]').fill("07:00");
  await dialog.locator('input[name="normal_end_0"]').fill("13:00");
  await expect(dialog.getByText(/المادة 101/)).toBeVisible(); // six hours in a row with no break

  await dialog.getByRole("button", { name: "إضافة استراحة" }).click();
  await dialog.locator('input[name="break_start_0"]').fill("10:00");
  await dialog.locator('input[name="break_end_0"]').fill("11:00");
  await expect(dialog.getByRole("status", { name: "حساب الوردية" })).toContainText("5:30 ساعة عمل"); // 6 hours − 30 min unpaid
  await expect(dialog.getByText(/أضف أوقات رمضان/)).toHaveCount(0); // 5.5 hours fit Ramadan's 6

  await dialog.locator('input[name="normal_end_0"]').fill("16:00");
  await expect(dialog.getByText(/المادة 101/)).toBeVisible(); // 10:30–16:00 without a rest
  await dialog.locator('input[name="normal_end_0"]').fill("15:30");
  await expect(dialog.getByRole("status", { name: "حساب الوردية" })).toContainText("8:00 ساعة عمل");
  await expect(dialog.getByText(/أضف أوقات رمضان/)).toBeVisible(); // 8 hours in Ramadan is too much
  await dialog.locator('input[name="normal_end_0"]').fill("16:00");
  await expect(dialog.getByText(/8 ساعات عمل يومياً كحد أقصى/)).toBeVisible(); // Art. 98
  await expect(dialog.getByRole("button", { name: "حفظ" })).toBeDisabled();

  await dialog.locator('input[name="normal_end_0"]').fill("15:30");
  await dialog.getByRole("checkbox", { name: "لهذه الوردية أوقات خاصة في رمضان" }).check();
  await dialog.locator('input[name="ramadan_start_0"]').fill("09:00");
  await dialog.locator('input[name="ramadan_end_0"]').fill("14:00");
  await expect(dialog.getByRole("status", { name: "حساب الوردية" })).toContainText("أوقات رمضان");
  await dialog.getByRole("button", { name: "حفظ" }).click();
  await expect(dialog).toBeHidden();

  const row = hr.getByRole("list", { name: "الورديات" }).getByRole("listitem").filter({ hasText: name });
  await expect(row).toContainText("8:00 ساعة عمل");
  await expect(row).toContainText("4:30 ساعة عمل"); // Ramadan 09:00–14:00 minus the 30-minute lunch

  await row.getByRole("button", { name: `تعديل ${name}` }).click();
  await hr.getByRole("dialog").getByRole("button", { name: "حذف", exact: true }).click();
  await expect(row).toHaveCount(0);
});
