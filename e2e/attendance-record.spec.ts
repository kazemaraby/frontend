import { type Page, expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Attendance record (Phase 3 task 5): hr@ enters رؤيا حاوي's in at 08:30 and out at 16:00 by hand on Monday
 * 14 September 2026 (the regular shift: 08:00–16:00, an hour's unpaid lunch), works the day out and sees it as late by
 * 30 minutes with 6:30 worked. Punches are never deleted: a rerun adds repeats, which count once. */
const DAY = "2026-09-14";

async function enter(hr: Page, time: string, kind: string, day = DAY) {
  await hr.getByRole("button", { name: "إدخال بصمة" }).click();
  const dialog = hr.getByRole("dialog");
  await dialog.getByRole("searchbox").fill("رؤيا");
  await dialog.locator('select[name="employee"]').selectOption({ label: "رؤيا حاوي · EMP-004" });
  await dialog.locator('input[name="time"]').fill(`${day}T${time}`);
  await dialog.locator('select[name="kind"]').selectOption(kind);
  await dialog.locator('textarea[name="note"]').fill("اختبار آلي: نسيت البصمة");
  await dialog.getByRole("button", { name: "حفظ" }).click();
  await expect(dialog).toBeHidden();
}

test("a day is worked out from the shift and the punches", async ({ browser }) => {
  test.setTimeout(60_000);
  const hr = await signedIn(browser, "hr@cactus.localhost");
  await hr.goto("/attendance?tab=devices");
  await enter(hr, "08:30", "in");
  await enter(hr, "16:00", "out");

  await hr.getByRole("tab", { name: "سجل الحضور" }).click();
  await hr.locator('input[name="date"]').fill(DAY);
  await hr.getByRole("button", { name: "إعادة الحساب" }).click();
  const row = hr.getByRole("table", { name: "سجل الحضور" }).getByRole("row").filter({ hasText: "رؤيا حاوي" });
  await expect(row).toContainText("متأخر");
  await expect(row).toContainText("0:30");
  await expect(row).toContainText("6:30"); // 08:30–16:00 less the hour's lunch
  await expect(row).toContainText("08:30");
});

/** Overtime (Phase 3 task 6): 08:00–18:00 on Monday 21 September 2026 is two hours beyond the regular shift; it
 * shows as overtime "after hours", not approved (only an approved overtime request counts it, decision 2). */
test("time beyond the shift shows as overtime waiting for approval", async ({ browser }) => {
  test.setTimeout(60_000);
  const hr = await signedIn(browser, "hr@cactus.localhost");
  const day = "2026-09-21";
  await hr.goto("/attendance?tab=devices");
  await enter(hr, "08:00", "in", day);
  await enter(hr, "18:00", "out", day);
  await hr.getByRole("tab", { name: "سجل الحضور" }).click();
  await hr.locator('input[name="date"]').fill(day);
  await hr.getByRole("button", { name: "إعادة الحساب" }).click();
  const row = hr.getByRole("table", { name: "سجل الحضور" }).getByRole("row").filter({ hasText: "رؤيا حاوي" });
  await expect(row).toContainText("2:00");
  await expect(row).toContainText("بعد الدوام");
  await expect(row).toContainText("غير معتمد");
});
