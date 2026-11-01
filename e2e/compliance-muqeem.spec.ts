import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Muqeem (Phase 5 task 9): Muqeem set to the test-data mode; its residents report read and opened for review (not
 * accepted here: the backend tests cover that, and the dev employees' documents stay as they are); its visa list read
 * and shown on the Muqeem tab with Hijri dates. Muqeem is set back to manual import. */
test("Muqeem: residents for review and the visa list", async ({ browser }) => {
  test.setTimeout(150_000); // the checks run on the Celery worker, which may still be busy with earlier tests' jobs
  const admin = await signedIn(browser, "qa@cactus.localhost");
  const setMode = async (mode: string) => {
    await admin.goto("/compliance?tab=integrations");
    await admin.getByRole("button", { name: "إعداد مقيم" }).click();
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
    for (const kind of ["مقيم: المقيمون على المنشأة", "مقيم: تأشيرات الخروج والعودة والخروج النهائي"]) {
      await read.locator('select[name="kind"]').selectOption({ label: kind });
      await read.getByRole("button", { name: "جلب (بيانات تجريبية)" }).click();
      await expect(runs.getByRole("row").filter({ hasText: kind }).first()).toContainText("جاهز", { timeout: 60_000 });
    }
    await runs.getByRole("row").filter({ hasText: "مقيم: المقيمون على المنشأة" }).first().getByRole("button", { name: /^مراجعة/ }).click();
    await expect(admin.getByText("لا يتغير شيء في ملف الموظف حتى تعتمد الفرق.")).toBeVisible();
    await admin.locator('select[name="status"]').selectOption({ label: "الكل" });
    await expect(admin.getByRole("table", { name: "الصفوف" }).getByRole("row").nth(1)).toBeVisible();

    await admin.goto("/compliance?tab=muqeem");
    const visas = admin.getByRole("region", { name: "التأشيرات" });
    await expect(visas.getByRole("row").filter({ hasText: "خروج نهائي" }).first()).toBeVisible();
    // the test data's visas are numbered V000…; the exit re-entry test adds real ones next to them
    const testVisa = visas.getByRole("row").filter({ hasText: "خروج وعودة مفردة" }).filter({ hasText: /V0{3,}/ }).first();
    await expect(testVisa).toContainText("مستخدمة");
    await visas.locator('select[name="status"]').selectOption({ label: "مستخدمة (غادر)" });
    await expect(visas.getByRole("row").filter({ hasText: "خروج نهائي" })).toHaveCount(0);
  } finally {
    await setMode("استيراد يدوي");
  }
});
