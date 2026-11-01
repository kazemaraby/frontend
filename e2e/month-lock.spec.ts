import { expect, type Page, test } from "@playwright/test";

import { signedIn } from "./helpers";

/** Month lock (Phase 3 task 15): hr@ locks September 2026 (its days are built a last time), the record of a September
 * day says it is locked and can't be built again, then opens the month again with a reason. Other specs enter
 * September punches, so the month is opened again even when the test fails half-way. */
async function months(hr: Page) {
  await hr.goto("/attendance?tab=months");
  const list = hr.getByRole("list", { name: "أشهر الحضور" });
  await expect(list).toBeVisible();
  while (!(await hr.getByText("2026", { exact: true }).isVisible())) await hr.getByRole("button", { name: "السنة السابقة" }).click();
  return list.getByRole("listitem").filter({ hasText: "سبتمبر" });
}

async function openAgain(hr: Page) {
  const september = await months(hr);
  if (!(await september.getByRole("button", { name: "فتح الشهر" }).isVisible())) return;
  await september.getByRole("button", { name: "فتح الشهر" }).click();
  const dialog = hr.getByRole("dialog");
  await dialog.locator('textarea[name="reason"]').fill("اختبار آلي: إعادة فتح الشهر");
  await dialog.getByRole("button", { name: "فتح الشهر" }).click();
  await expect(dialog).toBeHidden();
  await expect(september).toContainText("مفتوح · انتهى");
}

test("payroll locks an ended month and opens it again with a reason", async ({ browser }) => {
  test.setTimeout(120_000);
  const hr = await signedIn(browser, "hr@cactus.localhost");
  await openAgain(hr); // a run that stopped half-way left it locked
  try {
    const september = await months(hr);
    await september.getByRole("button", { name: "إقفال الشهر" }).click();
    const dialog = hr.getByRole("dialog");
    await expect(dialog).toContainText("للمرة الأخيرة");
    await dialog.getByRole("button", { name: "إقفال الشهر" }).click();
    await expect(dialog).toBeHidden({ timeout: 60_000 });
    await expect(september).toContainText("مقفل");
    await expect(september).toContainText("أقفله");

    await hr.goto("/attendance?tab=log");
    await hr.locator('input[name="date"]').fill("2026-09-14");
    await expect(hr.getByText("هذا الشهر مقفل: أيامه كما أُقفلت ولا يُعاد حسابها.")).toBeVisible();
    await expect(hr.getByRole("button", { name: "إعادة الحساب" })).toBeDisabled();
  } finally {
    await openAgain(hr);
  }
  await expect(await months(hr)).toContainText("فتحه");
});
