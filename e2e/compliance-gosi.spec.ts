import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** The GOSI register (Phase 5 task 7): GOSI set to the test-data mode; its subscribers list and the invoice of the
 * month before last (the demo data's approved payroll) fetched; the GOSI tab shows the register, the invoice against
 * the payroll and the month's contributions per establishment, with its Excel file. GOSI is set back to manual. */
test("GOSI register: subscribers, the invoice against the payroll, contributions", async ({ browser }) => {
  test.setTimeout(150_000); // the checks run on the Celery worker, which may still be busy with earlier tests' jobs
  const admin = await signedIn(browser, "qa@cactus.localhost");
  const before = new Date();
  before.setDate(1);
  before.setMonth(before.getMonth() - 2);
  const month = `${before.getFullYear()}-${String(before.getMonth() + 1).padStart(2, "0")}`;
  const setMode = async (mode: string) => {
    await admin.goto("/compliance?tab=integrations");
    await admin.getByRole("button", { name: "إعداد التأمينات الاجتماعية" }).click();
    const dialog = admin.getByRole("dialog");
    await dialog.locator('select[name="mode"]').selectOption({ label: mode });
    await dialog.getByRole("button", { name: "حفظ" }).click();
    await expect(dialog).toBeHidden();
  };
  await setMode("بيانات تجريبية");
  try {
    await admin.getByRole("tab", { name: "الاستيراد والمراجعة" }).click();
    const read = admin.getByRole("region", { name: "قراءة ملف حكومي" });
    const runs = admin.getByRole("region", { name: "الملفات المقروءة" });
    await read.locator('select[name="kind"]').selectOption({ label: "التأمينات: مشتركو المنشأة" });
    await read.getByRole("button", { name: "جلب (بيانات تجريبية)" }).click();
    await expect(runs.getByRole("row").filter({ hasText: "التأمينات: مشتركو المنشأة" }).first()).toContainText("جاهز", { timeout: 60_000 });
    await read.locator('select[name="kind"]').selectOption({ label: "التأمينات: الفاتورة الشهرية" });
    await read.locator('input[name="period"]').fill(month);
    await read.getByRole("button", { name: "جلب (بيانات تجريبية)" }).click();
    await expect(runs.getByRole("row").filter({ hasText: "التأمينات: الفاتورة الشهرية" }).first()).toContainText("جاهز", { timeout: 60_000 });

    await admin.goto("/compliance?tab=gosi");
    const register = admin.getByRole("region", { name: "سجل التأمينات" });
    await expect(register.getByRole("button", { name: "الكل" })).toHaveAttribute("aria-pressed", "true");
    await admin.locator('input[name="month"]').fill(month);
    const invoice = admin.getByRole("region", { name: "الفاتورة مقارنةً بالرواتب" });
    await expect(invoice.getByRole("row").filter({ hasText: "مختلف" }).first()).toBeVisible(); // 10 more billed
    await expect(invoice.getByRole("row").filter({ hasText: "ليس من موظفينا" })).toBeVisible();
    const contributions = admin.getByRole("region", { name: "اشتراكات الشهر" });
    await expect(contributions.getByRole("row").filter({ hasText: "7-1234567" })).toBeVisible();
    const download = admin.waitForEvent("download");
    await contributions.getByRole("button", { name: "تصدير إلى Excel" }).click();
    expect((await download).suggestedFilename()).toMatch(/^gosi-contributions-.*\.xlsx$/);
  } finally {
    await setMode("استيراد يدوي");
  }
});
