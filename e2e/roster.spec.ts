import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Roster (Phase 3 task 3): hr@ assigns رؤيا حاوي the night shift from next Sunday, gives her that Monday off as a
 * one-day change, then undoes the change and removes the assignment so the demo roster stays as seeded. */
test("HR assigns a shift and changes one day", async ({ browser }) => {
  test.setTimeout(60_000);
  const hr = await signedIn(browser, "hr@cactus.localhost");
  const sunday = new Date();
  sunday.setDate(sunday.getDate() - sunday.getDay() + 7);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  await hr.goto("/attendance?tab=scheduling");
  await hr.getByRole("button", { name: "تعيين وردية" }).click();
  const dialog = hr.getByRole("dialog");
  await dialog.locator('select[name="target"]').selectOption("employee");
  await dialog.getByRole("searchbox").fill("رؤيا");
  await dialog.locator('select[name="who"]').selectOption({ label: "رؤيا حاوي · EMP-004" });
  await dialog.locator('select[name="what"]').selectOption({ label: "ليلية" });
  await dialog.locator('input[name="start_date"]').fill(iso(sunday));
  await dialog.getByRole("button", { name: "حفظ" }).click();
  await expect(dialog).toBeHidden();

  await hr.getByRole("button", { name: "الأسبوع التالي" }).click();
  const row = hr.getByRole("table", { name: "تنظيم المواعيد" }).getByRole("row").filter({ hasText: "رؤيا حاوي" });
  await expect(row.getByRole("button", { name: /ليلية · 7:30 ساعة عمل/ }).first()).toBeVisible();

  // Monday off, for that day only.
  await row.getByRole("button", { name: /ليلية/ }).nth(1).click();
  const change = hr.getByRole("dialog");
  await change.locator('select[name="choice"]').selectOption("off");
  await change.locator('input[name="reason"]').fill("تبديل مع زميل");
  await change.getByRole("button", { name: "حفظ" }).click();
  await expect(change).toBeHidden();
  await expect(row.getByRole("button", { name: "يوم راحة" })).toBeVisible();

  // Back as it was.
  await row.getByRole("button", { name: "يوم راحة" }).click();
  await hr.getByRole("dialog").getByRole("button", { name: "إلغاء التغيير" }).click();
  await expect(row.getByRole("button", { name: "يوم راحة" })).toHaveCount(0);
  const assignments = hr.getByRole("list", { name: "التعيينات" });
  await assignments.getByRole("button", { name: "حذف تعيين رؤيا حاوي" }).click();
  await expect(assignments).not.toContainText("رؤيا حاوي");
  await expect(row.getByRole("button", { name: /منتظمة/ }).first()).toBeVisible();
});
