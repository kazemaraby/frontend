import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Qiwa contract documentation (Phase 5 task 6): Qiwa set to the test-data mode, its contracts report fetched and
 * checked, then the Qiwa tab lists what needs doing with a filter per kind. Qiwa is set back to manual import. */
test("Qiwa contracts: fetch test data and see what needs doing", async ({ browser }) => {
  test.setTimeout(120_000); // the check runs on the Celery worker, which may still be busy with earlier tests' jobs
  const admin = await signedIn(browser, "qa@cactus.localhost");
  const setMode = async (mode: string) => {
    await admin.goto("/compliance?tab=integrations");
    await admin.getByRole("button", { name: "إعداد قوى" }).click();
    const dialog = admin.getByRole("dialog");
    await dialog.locator('select[name="mode"]').selectOption({ label: mode });
    await dialog.getByRole("button", { name: "حفظ" }).click();
    await expect(dialog).toBeHidden();
  };
  await setMode("بيانات تجريبية");
  try {
    await admin.getByRole("tab", { name: "الاستيراد والمراجعة" }).click();
    const read = admin.getByRole("region", { name: "قراءة ملف حكومي" });
    await read.locator('select[name="kind"]').selectOption({ label: "قوى: عقود المنشأة" });
    await read.getByRole("button", { name: "جلب (بيانات تجريبية)" }).click();
    const run = admin.getByRole("region", { name: "الملفات المقروءة" }).getByRole("row").filter({ hasText: "قوى: عقود المنشأة" }).first();
    await expect(run).toContainText("جاهز", { timeout: 90_000 });

    await admin.goto("/compliance?tab=qiwa");
    const card = admin.getByRole("region", { name: "توثيق العقود في قوى" });
    await expect(card.getByRole("button", { name: "الكل" })).toHaveAttribute("aria-pressed", "true");
    await expect(card).not.toContainText("لم يُقرأ تقرير عقود قوى بعد");
    const chips = card.getByRole("group", { name: "عرض" }).getByRole("button");
    if ((await chips.count()) > 1) {
      await chips.nth(1).click();
      await expect(chips.nth(1)).toHaveAttribute("aria-pressed", "true");
      await expect(card.getByRole("row").nth(1)).toBeVisible();
    }
  } finally {
    await setMode("استيراد يدوي");
  }
});
