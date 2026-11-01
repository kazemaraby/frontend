import { expect, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Government data (Phase 5 task 1): GOSI switched to the test-data mode, its subscribers fetched and matched to our
 * employees, a wage difference accepted and a person who isn't ours ignored with a reason. GOSI is set back to manual
 * import at the end, so the dev data keeps its real setup. */
test("government data: fetch test data, review and resolve", async ({ browser }) => {
  test.setTimeout(120_000); // the check runs on the Celery worker, which may still be busy with earlier tests' jobs
  const admin = await signedIn(browser, "qa@cactus.localhost");
  const setMode = async (mode: string) => {
    await admin.goto("/compliance?tab=integrations");
    await admin.getByRole("button", { name: "إعداد التأمينات الاجتماعية" }).click();
    const dialog = admin.getByRole("dialog");
    await dialog.locator('select[name="mode"]').selectOption({ label: mode });
    await dialog.getByRole("button", { name: "حفظ" }).click();
    await expect(dialog).toBeHidden();
    await expect(admin.getByRole("row").filter({ hasText: "التأمينات الاجتماعية" })).toContainText(mode);
  };
  await setMode("بيانات تجريبية");
  try {
    await admin.getByRole("tab", { name: "الاستيراد والمراجعة" }).click();
    await admin.getByRole("region", { name: "قراءة ملف حكومي" }).locator('select[name="kind"]').selectOption({ label: "التأمينات: مشتركو المنشأة" });
    await admin.getByRole("button", { name: "جلب (بيانات تجريبية)" }).click();
    const run = admin.getByRole("region", { name: "الملفات المقروءة" }).getByRole("row").filter({ hasText: "التأمينات: مشتركو المنشأة" }).first();
    await expect(run).toContainText("جاهز", { timeout: 90_000 });
    await run.getByRole("button", { name: /^مراجعة/ }).click();

    await expect(admin.getByText("لا يتغير شيء في ملف الموظف حتى تعتمد الفرق.")).toBeVisible();
    const different = admin.getByRole("row").filter({ hasText: "مختلف" }).first();
    await expect(different).toContainText("لديهم");
    await different.getByRole("button", { name: "اعتماد قيمتهم" }).click();
    await expect(admin.getByRole("row").filter({ hasText: "مقبول" }).first()).toBeVisible();

    const stranger = admin.getByRole("row").filter({ hasText: "2999999999" });
    await stranger.getByRole("button", { name: "تجاهل" }).click();
    const dialog = admin.getByRole("dialog");
    await dialog.locator('textarea[name="note"]').fill("ليس من موظفي المنشأة");
    await dialog.getByRole("button", { name: "حفظ" }).click();
    await expect(dialog).toBeHidden();
    await expect(stranger).toContainText("متجاهَل");
  } finally {
    await setMode("استيراد يدوي");
  }
});
